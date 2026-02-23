"""Generate deterministic hidden tests for build-gpt judge problems.

This script expands hidden test coverage with scenario buckets:
- boundary
- adversarial
- random
- regression
- stress

Default output is 20 hidden cases per supported problem (within the 15-25 target).
"""

from __future__ import annotations

import argparse
import json
import math
import random
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

ProblemGenerator = Callable[[random.Random], list["Case"]]


@dataclass
class Case:
    bucket: str
    inputs: dict[str, Any] | None = None
    input_code: str | None = None
    expected: Any = None
    expected_is_code: bool = False


def _inputs_to_code(inputs: dict[str, Any]) -> str:
    lines: list[str] = []
    for name, value in inputs.items():
        if not isinstance(name, str) or not name.isidentifier():
            raise ValueError(f"Invalid input variable name: {name!r}")
        lines.append(f"{name} = {repr(value)}")
    rendered = "\n".join(lines)
    if rendered:
        rendered += "\n"
    return rendered



def _round_nested(value: Any, digits: int = 8) -> Any:
    if isinstance(value, float):
        return round(value, digits)
    if isinstance(value, list):
        return [_round_nested(v, digits) for v in value]
    if isinstance(value, tuple):
        return tuple(_round_nested(v, digits) for v in value)
    if isinstance(value, dict):
        return {_round_nested(k, digits): _round_nested(v, digits) for k, v in value.items()}
    return value


def _serialize_case(case_id: str, case: Case) -> dict[str, Any]:
    out: dict[str, Any] = {"id": case_id}
    if case.input_code is None and case.inputs is None:
        raise ValueError("Case must provide either inputs or input_code")

    code = case.input_code if case.input_code is not None else _inputs_to_code(case.inputs or {})
    if not code.endswith("\n"):
        code += "\n"

    out["input_code"] = code

    if case.expected_is_code:
        out["expected"] = repr(case.expected)
        out["expected_is_code"] = True
    else:
        out["expected"] = case.expected

    return out


def _assign_hidden_ids(cases: list[Case]) -> list[dict[str, Any]]:
    prefixes = {
        "boundary": "b",
        "adversarial": "a",
        "random": "r",
        "regression": "g",
        "stress": "s",
    }
    counts: dict[str, int] = {v: 0 for v in prefixes.values()}
    out: list[dict[str, Any]] = []
    for case in cases:
        prefix = prefixes.get(case.bucket)
        if prefix is None:
            raise ValueError(f"Unsupported bucket: {case.bucket}")
        counts[prefix] += 1
        out.append(
            _serialize_case(f"{prefix}{counts[prefix]:02d}", case)
        )
    return out


def _assign_public_ids(cases: list[Case]) -> list[dict[str, Any]]:
    return [
        _serialize_case(f"case{index + 1}", case)
        for index, case in enumerate(cases)
    ]


def _case_signature(case: Case) -> tuple[str, str, bool]:
    serialized = _serialize_case("__sig__", case)
    return (
        serialized["input_code"],
        json.dumps(serialized.get("expected"), sort_keys=True),
        bool(serialized.get("expected_is_code", False)),
    )


def _assert_case_count(problem_id: str, cases: list[Case], minimum: int = 15, maximum: int = 25) -> None:
    if not (minimum <= len(cases) <= maximum):
        raise ValueError(
            f"{problem_id}: generated {len(cases)} cases, expected between {minimum} and {maximum}"
        )


RANKING_MARGIN_MIN = 1e-4
FLOAT_EXPECTED_DIGITS = 8
GENERATION_CHECK_ATOL = 5e-6
GENERATION_CHECK_RTOL = 1e-9


def _cosine_similarity(a: list[float], b: list[float], *, dtype: Any = np.float64) -> float:
    a_arr = np.asarray(a, dtype=dtype)
    b_arr = np.asarray(b, dtype=dtype)
    dot = np.sum(a_arr * b_arr, dtype=dtype)
    na = np.sqrt(np.sum(a_arr * a_arr, dtype=dtype), dtype=dtype)
    nb = np.sqrt(np.sum(b_arr * b_arr, dtype=dtype), dtype=dtype)
    if float(na) == 0.0 or float(nb) == 0.0:
        return 0.0
    return float(dot / (na * nb))


def _most_similar_scored(
    query_id: int, embedding_matrix: list[list[float]], *, dtype: Any = np.float64
) -> list[tuple[float, int]]:
    query = embedding_matrix[query_id]
    scored: list[tuple[float, int]] = []
    for idx, vec in enumerate(embedding_matrix):
        if idx == query_id:
            continue
        sim = _cosine_similarity(query, vec, dtype=dtype)
        scored.append((sim, idx))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored


def _analogy_scored(
    a_id: int, b_id: int, c_id: int, embedding_matrix: list[list[float]], *, dtype: Any = np.float64
) -> list[tuple[float, int]]:
    a = np.asarray(embedding_matrix[a_id], dtype=dtype)
    b = np.asarray(embedding_matrix[b_id], dtype=dtype)
    c = np.asarray(embedding_matrix[c_id], dtype=dtype)
    target = (a - b + c).tolist()

    scored: list[tuple[float, int]] = []
    excluded = {a_id, b_id, c_id}
    for idx, vec in enumerate(embedding_matrix):
        if idx in excluded:
            continue
        sim = _cosine_similarity(target, vec, dtype=dtype)
        scored.append((sim, idx))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored


def _merge_tokens(ids: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    out: list[int] = []
    i = 0
    while i < len(ids):
        if i + 1 < len(ids) and ids[i] == pair[0] and ids[i + 1] == pair[1]:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out


def _pair_stats(ids: list[int]) -> dict[tuple[int, int], int]:
    stats: dict[tuple[int, int], int] = {}
    for i in range(len(ids) - 1):
        pair = (ids[i], ids[i + 1])
        stats[pair] = stats.get(pair, 0) + 1
    return stats


def _train_bpe(text: str, num_merges: int) -> tuple[list[int], OrderedDict[tuple[int, int], int]]:
    ids = list(text.encode("utf-8"))
    merges: OrderedDict[tuple[int, int], int] = OrderedDict()
    next_id = 256

    for _ in range(num_merges):
        stats = _pair_stats(ids)
        if not stats:
            break
        best_pair = min(stats.items(), key=lambda item: (-item[1], item[0]))[0]
        merges[best_pair] = next_id
        ids = _merge_tokens(ids, best_pair, next_id)
        next_id += 1

    return ids, merges


def _decode_bpe(ids: list[int], merges: OrderedDict[tuple[int, int], int] | dict[tuple[int, int], int]) -> str:
    vocab: dict[int, list[int]] = {i: [i] for i in range(256)}
    for pair, new_id in merges.items():
        left = vocab[pair[0]]
        right = vocab[pair[1]]
        vocab[new_id] = left + right

    out_bytes: list[int] = []
    for token in ids:
        out_bytes.extend(vocab.get(token, [token]))
    return bytes(out_bytes).decode("utf-8")


def _encode_with_merges(
    text: str, merges: OrderedDict[tuple[int, int], int] | dict[tuple[int, int], int]
) -> list[int]:
    ids = list(text.encode("utf-8"))
    for pair, new_id in merges.items():
        ids = _merge_tokens(ids, pair, new_id)
    return ids


def _most_similar_ref(
    query_id: int, embedding_matrix: list[list[float]], k: int, *, dtype: Any = np.float64
) -> list[int]:
    scored = _most_similar_scored(query_id, embedding_matrix, dtype=dtype)
    limit = max(0, min(k, len(scored)))
    return [idx for _, idx in scored[:limit]]


def _analogy_ref(
    a_id: int, b_id: int, c_id: int, embedding_matrix: list[list[float]], *, dtype: Any = np.float64
) -> int:
    scored = _analogy_scored(a_id, b_id, c_id, embedding_matrix, dtype=dtype)
    if not scored:
        raise ValueError("Vector analogy needs at least one candidate token")
    return scored[0][1]


def _descending_cosine_targets(count: int, *, max_cos: float, min_cos: float) -> list[float]:
    if count <= 0:
        return []
    if count == 1:
        return [max_cos]
    step = (max_cos - min_cos) / (count - 1)
    return [max_cos - step * index for index in range(count)]


def _random_unit_vector(rng: random.Random, dim: int) -> list[float]:
    components = [rng.uniform(-1.0, 1.0) for _ in range(dim)]
    norm = math.sqrt(sum(v * v for v in components))
    if norm == 0.0:
        components[0] = 1.0
        norm = 1.0
    return [v / norm for v in components]


def _random_unit_orthogonal_to(rng: random.Random, basis: list[float]) -> list[float]:
    dim = len(basis)
    probe = _random_unit_vector(rng, dim)
    dot = sum(a * b for a, b in zip(probe, basis))
    orth = [probe[i] - dot * basis[i] for i in range(dim)]
    norm = math.sqrt(sum(v * v for v in orth))
    if norm == 0.0:
        for i, value in enumerate(basis):
            if abs(value) < 0.9:
                orth = [0.0] * dim
                orth[i] = 1.0
                dot = sum(a * b for a, b in zip(orth, basis))
                orth = [orth[j] - dot * basis[j] for j in range(dim)]
                norm = math.sqrt(sum(v * v for v in orth))
                break
    if norm == 0.0:
        raise ValueError("Unable to build orthogonal vector")
    return [v / norm for v in orth]


def _build_similarity_vector(
    target_unit: list[float], cos_value: float, rng: random.Random
) -> list[float]:
    if not (-1.0 <= cos_value <= 1.0):
        raise ValueError("cos_value must be in [-1, 1]")
    orth = _random_unit_orthogonal_to(rng, target_unit)
    sin_value = math.sqrt(max(0.0, 1.0 - cos_value * cos_value))
    scale = rng.uniform(0.7, 1.3)
    return [
        round(scale * (cos_value * target_unit[i] + sin_value * orth[i]), 6)
        for i in range(len(target_unit))
    ]


def _assert_most_similar_stability(
    *,
    label: str,
    query_id: int,
    embedding_matrix: list[list[float]],
    k: int,
    require_margin: bool,
) -> None:
    expected32 = _most_similar_ref(query_id, embedding_matrix, k, dtype=np.float32)
    expected64 = _most_similar_ref(query_id, embedding_matrix, k, dtype=np.float64)
    if expected32 != expected64:
        raise ValueError(
            f"{label}: float32 vs float64 ranking mismatch ({expected32} vs {expected64})"
        )

    if require_margin:
        scored32 = _most_similar_scored(query_id, embedding_matrix, dtype=np.float32)
        limit = max(0, min(k, len(scored32)))
        if 0 < limit < len(scored32):
            margin = scored32[limit - 1][0] - scored32[limit][0]
            if margin < RANKING_MARGIN_MIN:
                raise ValueError(
                    f"{label}: top-k boundary margin {margin:.2e} is below "
                    f"{RANKING_MARGIN_MIN:.1e}"
                )


def _assert_analogy_stability(
    *,
    label: str,
    a_id: int,
    b_id: int,
    c_id: int,
    embedding_matrix: list[list[float]],
    require_margin: bool,
) -> None:
    expected32 = _analogy_ref(a_id, b_id, c_id, embedding_matrix, dtype=np.float32)
    expected64 = _analogy_ref(a_id, b_id, c_id, embedding_matrix, dtype=np.float64)
    if expected32 != expected64:
        raise ValueError(
            f"{label}: float32 vs float64 ranking mismatch ({expected32} vs {expected64})"
        )

    if require_margin:
        scored32 = _analogy_scored(a_id, b_id, c_id, embedding_matrix, dtype=np.float32)
        if len(scored32) >= 2:
            margin = scored32[0][0] - scored32[1][0]
            if margin < RANKING_MARGIN_MIN:
                raise ValueError(
                    f"{label}: winner margin {margin:.2e} is below {RANKING_MARGIN_MIN:.1e}"
                )


def _construct_most_similar_case(
    rng: random.Random, *, rows: int, cols: int, k: int
) -> tuple[int, int, list[list[float]]]:
    if rows < 2:
        raise ValueError("Most-similar case requires at least 2 rows")
    if cols < 2:
        raise ValueError("Most-similar case requires at least 2 dimensions")

    query_id = rng.randrange(rows)
    query_vector = _random_unit_vector(rng, cols)
    candidates = rows - 1
    cosine_targets = _descending_cosine_targets(candidates, max_cos=0.95, min_cos=-0.85)
    candidate_vectors = [
        _build_similarity_vector(query_vector, cos_value, rng) for cos_value in cosine_targets
    ]
    rng.shuffle(candidate_vectors)

    matrix = [[0.0] * cols for _ in range(rows)]
    matrix[query_id] = [round(v, 6) for v in query_vector]
    candidate_indices = [idx for idx in range(rows) if idx != query_id]
    for idx, vec in zip(candidate_indices, candidate_vectors, strict=True):
        matrix[idx] = vec

    clamped_k = max(0, min(k, rows - 1))
    return query_id, clamped_k, matrix


def _construct_vector_analogy_case(
    rng: random.Random, *, rows: int, cols: int
) -> tuple[int, int, int, list[list[float]]]:
    if rows < 5:
        raise ValueError("Vector-analogy case requires at least 5 rows")
    if cols < 2:
        raise ValueError("Vector-analogy case requires at least 2 dimensions")

    matrix = [[0.0] * cols for _ in range(rows)]
    ids = list(range(rows))
    rng.shuffle(ids)
    a_id, b_id, c_id = ids[0], ids[1], ids[2]
    candidate_ids = ids[3:]

    target_unit = _random_unit_vector(rng, cols)
    a = _random_unit_vector(rng, cols)
    b = _random_unit_vector(rng, cols)
    c = [target_unit[i] - a[i] + b[i] for i in range(cols)]

    matrix[a_id] = [round(v, 6) for v in a]
    matrix[b_id] = [round(v, 6) for v in b]
    matrix[c_id] = [round(v, 6) for v in c]

    cosine_targets = _descending_cosine_targets(len(candidate_ids), max_cos=0.96, min_cos=-0.75)
    for idx, cos_value in zip(candidate_ids, cosine_targets, strict=True):
        matrix[idx] = _build_similarity_vector(target_unit, cos_value, rng)

    return a_id, b_id, c_id, matrix


def _frequencies_ref(d_model: int, *, dtype: Any = np.float32) -> list[float]:
    half = d_model // 2
    frequencies: list[float] = []
    base = dtype(10000.0)
    one = dtype(1.0)
    for i in range(half):
        exponent = dtype((2.0 * i) / float(d_model))
        value = one / (base**exponent)
        frequencies.append(float(value))
    return frequencies


def _pe_vector_ref(pos: int, d_model: int, *, dtype: Any = np.float32) -> list[float]:
    frequencies = _frequencies_ref(d_model, dtype=dtype)
    out: list[float] = [0.0] * d_model
    pos_v = np.asarray(pos, dtype=dtype)
    for i, f in enumerate(frequencies):
        angle = float(pos_v * np.asarray(f, dtype=dtype))
        out[2 * i] = float(np.asarray(math.sin(angle), dtype=dtype))
        out[2 * i + 1] = float(np.asarray(math.cos(angle), dtype=dtype))
    return out


def _pe_matrix_ref(seq_len: int, d_model: int, *, dtype: Any = np.float32) -> list[list[float]]:
    return [_pe_vector_ref(pos, d_model, dtype=dtype) for pos in range(seq_len)]


def _attention_weights_ref(
    q: list[list[float]], k: list[list[float]], *, dtype: Any = np.float32
) -> list[list[float]]:
    q_arr = np.asarray(q, dtype=dtype)
    k_arr = np.asarray(k, dtype=dtype)
    scale = np.sqrt(np.asarray(q_arr.shape[1], dtype=dtype), dtype=dtype)
    scores = (q_arr @ k_arr.T) / scale
    max_scores = np.max(scores, axis=1, keepdims=True)
    exps = np.exp(scores - max_scores, dtype=dtype)
    denom = np.sum(exps, axis=1, keepdims=True, dtype=dtype)
    weights = exps / denom
    return [[float(v) for v in row] for row in weights.astype(dtype)]


def _causal_attention_ref(
    q: list[list[float]], k: list[list[float]], v: list[list[float]], *, dtype: Any = np.float32
) -> list[list[float]]:
    q_arr = np.asarray(q, dtype=dtype)
    k_arr = np.asarray(k, dtype=dtype)
    v_arr = np.asarray(v, dtype=dtype)

    seq_len = q_arr.shape[0]
    d_k = q_arr.shape[1]
    scale = np.sqrt(np.asarray(d_k, dtype=dtype), dtype=dtype)

    scores = (q_arr @ k_arr.T) / scale
    mask = np.triu(np.ones((seq_len, seq_len), dtype=bool), k=1)
    minus_inf = np.asarray(float("-inf"), dtype=dtype)
    masked_scores = np.where(mask, minus_inf, scores)

    max_scores = np.max(masked_scores, axis=1, keepdims=True)
    exps = np.exp(masked_scores - max_scores, dtype=dtype)
    denom = np.sum(exps, axis=1, keepdims=True, dtype=dtype)
    weights = exps / denom

    out = weights @ v_arr
    return [[float(vv) for vv in row] for row in out.astype(dtype)]


def _matmul_ref(a: list[list[float]], b: list[list[float]], *, dtype: Any = np.float32) -> list[list[float]]:
    a_arr = np.asarray(a, dtype=dtype)
    b_arr = np.asarray(b, dtype=dtype)
    if a_arr.shape[1] != b_arr.shape[0]:
        raise ValueError("Incompatible matrix shapes for matmul")
    out = a_arr @ b_arr
    return [[float(v) for v in row] for row in out.astype(dtype)]


def _multi_head_causal_attention_ref(
    x: list[list[float]],
    w_q: list[list[float]],
    w_k: list[list[float]],
    w_v: list[list[float]],
    w_o: list[list[float]],
    num_heads: int,
    *,
    dtype: Any = np.float32,
) -> list[list[float]]:
    seq_len = len(x)
    d_model = len(x[0]) if seq_len else 0
    if d_model == 0:
        return []
    if d_model % num_heads != 0:
        raise ValueError("d_model must be divisible by num_heads")

    d_head = d_model // num_heads
    q = _matmul_ref(x, w_q, dtype=dtype)
    k = _matmul_ref(x, w_k, dtype=dtype)
    v = _matmul_ref(x, w_v, dtype=dtype)

    def _split_heads(m: list[list[float]]) -> list[list[list[float]]]:
        heads: list[list[list[float]]] = []
        for head_idx in range(num_heads):
            head_rows: list[list[float]] = []
            start = head_idx * d_head
            end = start + d_head
            for token_idx in range(seq_len):
                head_rows.append(m[token_idx][start:end])
            heads.append(head_rows)
        return heads

    q_heads = _split_heads(q)
    k_heads = _split_heads(k)
    v_heads = _split_heads(v)

    head_outputs: list[list[list[float]]] = []
    for head_idx in range(num_heads):
        head_outputs.append(
            _causal_attention_ref(q_heads[head_idx], k_heads[head_idx], v_heads[head_idx], dtype=dtype)
        )

    merged: list[list[float]] = []
    for token_idx in range(seq_len):
        row: list[float] = []
        for head_idx in range(num_heads):
            row.extend(head_outputs[head_idx][token_idx])
        merged.append(row)

    return _matmul_ref(merged, w_o, dtype=dtype)


def _gelu_array(x_arr: np.ndarray, *, dtype: Any = np.float32) -> np.ndarray:
    x_t = np.asarray(x_arr, dtype=dtype)
    tanh_vals = np.vectorize(math.tanh, otypes=[float])(
        math.sqrt(2.0 / math.pi) * (x_t + 0.044715 * x_t ** 3)
    )
    tanh_arr = np.asarray(tanh_vals, dtype=dtype)
    half = np.asarray(0.5, dtype=dtype)
    one = np.asarray(1.0, dtype=dtype)
    return half * x_t * (one + tanh_arr)


def _gelu_ref(x: Any, *, dtype: Any = np.float32) -> Any:
    out = _gelu_array(np.asarray(x, dtype=dtype), dtype=dtype)
    return out.astype(dtype).tolist()


def _ffn_ref(
    x: list[list[float]],
    w1: list[list[float]],
    b1: list[float],
    w2: list[list[float]],
    b2: list[float],
    *,
    dtype: Any = np.float32,
) -> list[list[float]]:
    x_arr = np.asarray(x, dtype=dtype)
    w1_arr = np.asarray(w1, dtype=dtype)
    b1_arr = np.asarray(b1, dtype=dtype)
    w2_arr = np.asarray(w2, dtype=dtype)
    b2_arr = np.asarray(b2, dtype=dtype)

    hidden = x_arr @ w1_arr + b1_arr
    activated = _gelu_array(hidden, dtype=dtype)
    out = activated @ w2_arr + b2_arr
    return out.astype(dtype).tolist()


def _layer_norm_array(
    x_arr: np.ndarray,
    gamma_arr: np.ndarray,
    beta_arr: np.ndarray,
    eps: float,
    *,
    dtype: Any = np.float32,
) -> np.ndarray:
    x_t = np.asarray(x_arr, dtype=dtype)
    gamma_t = np.asarray(gamma_arr, dtype=dtype)
    beta_t = np.asarray(beta_arr, dtype=dtype)
    eps_t = np.asarray(eps, dtype=dtype)

    mean = np.mean(x_t, axis=-1, keepdims=True, dtype=dtype)
    centered = x_t - mean
    var = np.mean(centered * centered, axis=-1, keepdims=True, dtype=dtype)
    norm = centered / np.sqrt(var + eps_t)
    return norm * gamma_t + beta_t


def _layer_norm_ref(
    x: list[list[float]],
    gamma: list[float],
    beta: list[float],
    eps: float,
    *,
    dtype: Any = np.float32,
) -> list[list[float]]:
    out = _layer_norm_array(
        np.asarray(x, dtype=dtype),
        np.asarray(gamma, dtype=dtype),
        np.asarray(beta, dtype=dtype),
        eps,
        dtype=dtype,
    )
    return out.astype(dtype).tolist()


def _pre_norm_block_ref(
    x: list[list[float]],
    gamma: list[float],
    beta: list[float],
    w: list[list[float]],
    b: list[float],
    eps: float,
    *,
    dtype: Any = np.float32,
) -> list[list[float]]:
    x_arr = np.asarray(x, dtype=dtype)
    w_arr = np.asarray(w, dtype=dtype)
    b_arr = np.asarray(b, dtype=dtype)
    ln = _layer_norm_array(
        x_arr,
        np.asarray(gamma, dtype=dtype),
        np.asarray(beta, dtype=dtype),
        eps,
        dtype=dtype,
    )
    return (x_arr + (ln @ w_arr + b_arr)).astype(dtype).tolist()


def _torch_matrix_input_code(var_name: str, matrix: list[list[float]]) -> str:
    return f"{var_name} = torch.tensor({repr(matrix)}, dtype=torch.float32)\n"


def _torch_vector_input_code(var_name: str, vector: list[float]) -> str:
    return f"{var_name} = torch.tensor({repr(vector)}, dtype=torch.float32)\n"


def _random_matrix(
    rng: random.Random,
    rows: int,
    cols: int,
    low: float = -2.0,
    high: float = 2.0,
) -> list[list[float]]:
    return [[round(rng.uniform(low, high), 4) for _ in range(cols)] for _ in range(rows)]


def _gen_encoder(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    # Keep curated public examples first.
    for text in ["Hello 🌍", "A"]:
        cases.append(Case("boundary", inputs={"text": text}, expected=list(text.encode("utf-8"))))

    for text in ["", "hello", "🙂", "e\u0301", "𐍈"]:
        cases.append(Case("boundary", inputs={"text": text}, expected=list(text.encode("utf-8"))))

    for text in ["\x00", "line1\\nline2", "漢字🙂", "Café", "👩‍💻"]:
        cases.append(Case("adversarial", inputs={"text": text}, expected=list(text.encode("utf-8"))))

    for text in [
        "a" * 256,
        "🙂" * 80,
        ("token-" * 90),
        ("漢字🙂abc\n" * 40),
    ]:
        cases.append(Case("stress", inputs={"text": text}, expected=list(text.encode("utf-8"))))

    alphabet = ["a", "b", "c", " ", "-", "é", "ß", "🙂", "中", "\n"]
    for _ in range(2):
        length = rng.randint(1, 60)
        text = "".join(rng.choice(alphabet) for _ in range(length))
        cases.append(Case("random", inputs={"text": text}, expected=list(text.encode("utf-8"))))
    for _ in range(3):
        length = rng.randint(80, 220)
        text = "".join(rng.choice(alphabet) for _ in range(length))
        cases.append(Case("random", inputs={"text": text}, expected=list(text.encode("utf-8"))))

    return cases


def _gen_byte_inspector(rng: random.Random) -> list[Case]:
    def ref(byte_list: list[int]) -> int:
        return sum(1 for b in byte_list if (b & 0xC0) != 0x80)

    cases: list[Case] = []

    # Keep curated public examples first.
    boundary_lists = [
        [72, 101, 108, 108, 111, 32, 240, 159, 140, 141],
        [65],
        [],
        [0],
        [0x80],
        [0xC2, 0xA9],
        [0xF0, 0x9F, 0x98, 0x80],
    ]
    for arr in boundary_lists:
        cases.append(Case("boundary", inputs={"byte_list": arr}, expected=ref(arr)))

    adversarial_lists = [
        [0xE2, 0x82, 0xAC],
        [0xE2, 0x82, 0xAC, 0x80, 0x80],
        [0x80, 0x80, 0x80],
        [0xFF, 0x80, 0xC0, 0x7F],
        [0x41, 0x80, 0x42, 0x80, 0x43],
    ]
    for arr in adversarial_lists:
        cases.append(Case("adversarial", inputs={"byte_list": arr}, expected=ref(arr)))

    stress_lists = [
        list(("a" * 1200).encode("utf-8")),
        list(("🙂" * 300).encode("utf-8")),
        [0x80] * 1500,
        [0xE2, 0x82, 0xAC, 0x80] * 300,
    ]
    for arr in stress_lists:
        cases.append(Case("stress", inputs={"byte_list": arr}, expected=ref(arr)))

    for _ in range(6):
        length = rng.randint(50, 1600)
        arr = [rng.randint(0, 255) for _ in range(length)]
        cases.append(Case("random", inputs={"byte_list": arr}, expected=ref(arr)))

    return cases


def _gen_pair_counter(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        ("boundary", [1, 2, 3, 1, 2]),
        ("boundary", [97, 97, 97, 98]),
        ("boundary", []),
        ("boundary", [5]),
        ("boundary", [1, 2]),
        ("boundary", [7, 7, 7]),
        ("adversarial", [1, 2, 1, 2, 1, 2, 1, 2]),
        ("adversarial", [0, -1, 0, -1, -1, 0, -1]),
        ("adversarial", [3, 3, 4, 3, 3, 4, 3, 3, 4]),
        ("adversarial", list(range(30))),
    ]

    for bucket, ids in fixed:
        expected = _pair_stats(ids)
        cases.append(Case(bucket, inputs={"ids": ids}, expected=expected, expected_is_code=True))

    stress_lists = [
        [1, 2] * 600,
        [5] * 1500,
        [i % 17 for i in range(1800)],
        [(i // 3) % 9 for i in range(2100)],
    ]
    for ids in stress_lists:
        expected = _pair_stats(ids)
        cases.append(Case("stress", inputs={"ids": ids}, expected=expected, expected_is_code=True))

    for _ in range(8):
        length = rng.randint(80, 1400)
        ids = [rng.randint(-5, 25) for _ in range(length)]
        expected = _pair_stats(ids)
        cases.append(Case("random", inputs={"ids": ids}, expected=expected, expected_is_code=True))

    return cases


def _gen_token_merger(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        ("boundary", [1, 2, 3, 1, 2], (1, 2), 99),
        ("boundary", [97, 97, 97, 98, 100, 97, 97, 97, 98, 97, 99], (97, 97), 256),
        ("boundary", [], (1, 2), 99),
        ("boundary", [1], (1, 2), 99),
        ("boundary", [1, 2], (1, 2), 99),
        ("boundary", [1, 1, 1], (1, 1), 9),
        ("adversarial", [1, 2, 1, 2, 1], (1, 2), 8),
        ("adversarial", [2, 2, 2, 2], (2, 2), 7),
        ("adversarial", [1, 2, 3], (2, 3), 9),
        ("adversarial", [1, 2, 3], (3, 4), 9),
    ]

    for bucket, ids, pair, new_id in fixed:
        expected = _merge_tokens(ids, pair, new_id)
        cases.append(
            Case(bucket, inputs={"ids": ids, "pair": pair, "new_id": new_id}, expected=expected)
        )

    stress_cases = [
        ([1, 2] * 240, (1, 2), 900),
        ([3] * 360, (3, 3), 901),
        ([4, 5, 6] * 200, (5, 6), 902),
        ([1, 1, 2, 2] * 180, (1, 1), 903),
    ]
    for ids, pair, new_id in stress_cases:
        expected = _merge_tokens(ids, pair, new_id)
        cases.append(
            Case("stress", inputs={"ids": ids, "pair": pair, "new_id": new_id}, expected=expected)
        )

    for idx in range(8):
        length = rng.randint(40, 260)
        ids = [rng.randint(0, 12) for _ in range(length)]
        pair = (rng.randint(0, 12), rng.randint(0, 12))
        new_id = 1000 + idx
        expected = _merge_tokens(ids, pair, new_id)
        cases.append(
            Case("random", inputs={"ids": ids, "pair": pair, "new_id": new_id}, expected=expected)
        )

    return cases


def _gen_bpe_trainer(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public example first.
        ("boundary", "aaaaaa", 2),
        ("boundary", "", 0),
        ("boundary", "a", 5),
        ("boundary", "aa", 1),
        ("boundary", "aaaa", 3),
        ("adversarial", "abac", 2),
        ("adversarial", "banana", 4),
        ("adversarial", "🙂🙂🙂", 3),
        ("adversarial", "abcabcabcabc", 6),
    ]

    for bucket, text, num_merges in fixed:
        ids, merges = _train_bpe(text, num_merges)
        expected = (ids, dict(merges))
        cases.append(
            Case(bucket, inputs={"text": text, "num_merges": num_merges}, expected=expected, expected_is_code=True)
        )

    stress = [
        ("ab" * 320, 16),
        (("tokenization " * 70).strip(), 20),
        ("漢字🙂" * 120, 14),
        (("aaaaabbbbcccdde " * 50).strip(), 22),
    ]
    for text, num_merges in stress:
        ids, merges = _train_bpe(text, num_merges)
        expected = (ids, dict(merges))
        cases.append(
            Case("stress", inputs={"text": text, "num_merges": num_merges}, expected=expected, expected_is_code=True)
        )

    alphabet = ["a", "b", "c", "d", " ", "e", "f", "g"]
    for _ in range(8):
        length = rng.randint(30, 180)
        text = "".join(rng.choice(alphabet) for _ in range(length))
        num_merges = rng.randint(3, 14)
        ids, merges = _train_bpe(text, num_merges)
        expected = (ids, dict(merges))
        cases.append(
            Case(
                "random",
                inputs={"text": text, "num_merges": num_merges},
                expected=expected,
                expected_is_code=True,
            )
        )

    return cases


def _gen_decoder(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed: list[tuple[str, list[int], OrderedDict[tuple[int, int], int], str]] = []

    # Keep curated public example first.
    merges1: OrderedDict[tuple[int, int], int] = OrderedDict([((104, 105), 256)])
    fixed.append(("boundary", [256], merges1, "hi"))

    merges0: OrderedDict[tuple[int, int], int] = OrderedDict()
    fixed.append(("boundary", [], merges0, ""))

    merges2: OrderedDict[tuple[int, int], int] = OrderedDict([((97, 98), 256), ((256, 99), 257)])
    fixed.append(("adversarial", [257], merges2, "abc"))

    merges3: OrderedDict[tuple[int, int], int] = OrderedDict([((240, 159), 256), ((256, 153), 257), ((257, 130), 258)])
    fixed.append(("adversarial", [258], merges3, "🙂"))

    for bucket, ids, merges, expected in fixed:
        cases.append(Case(bucket, inputs={"ids": ids, "merges": dict(merges)}, expected=expected))

    regression_texts = ["banana", "hello world", "abababab", "Café"]
    for text in regression_texts:
        ids, merges = _train_bpe(text, 8)
        cases.append(Case("regression", inputs={"ids": ids, "merges": dict(merges)}, expected=text))

    stress_specs = [
        ("ab" * 500, 24),
        ((("tokenization " * 100)).strip(), 28),
        ("🙂中" * 260, 18),
        ((("lorem ipsum " * 160)).strip(), 22),
    ]
    for text, num_merges in stress_specs:
        ids, merges = _train_bpe(text, num_merges)
        cases.append(Case("stress", inputs={"ids": ids, "merges": dict(merges)}, expected=text))

    alphabet = ["a", "b", "c", "d", "e", " ", "f", "g", "h"]
    for _ in range(8):
        length = rng.randint(40, 260)
        text = "".join(rng.choice(alphabet) for _ in range(length))
        num_merges = rng.randint(4, 18)
        ids, merges = _train_bpe(text, num_merges)
        expected = _decode_bpe(ids, merges)
        cases.append(Case("random", inputs={"ids": ids, "merges": dict(merges)}, expected=expected))

    return cases


def _gen_encoder_inference(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed_merges1: OrderedDict[tuple[int, int], int] = OrderedDict([((97, 97), 256), ((256, 97), 257)])
    fixed_merges2: OrderedDict[tuple[int, int], int] = OrderedDict([((97, 98), 256), ((98, 97), 257)])

    fixed = [
        # Keep curated public example first.
        ("boundary", "aa", OrderedDict([((97, 97), 256)])),
        ("boundary", "", OrderedDict()),
        ("adversarial", "aaa", fixed_merges1),
        ("adversarial", "ababa", fixed_merges2),
    ]

    for bucket, text, merges in fixed:
        expected = _encode_with_merges(text, merges)
        cases.append(Case(bucket, inputs={"text": text, "merges": dict(merges)}, expected=expected))

    corpora = ["banana", "hello", "aaaaaa", "abcabcabc"]
    for corpus in corpora:
        _, merges = _train_bpe(corpus, 8)
        text = corpus[: max(1, len(corpus) - 1)]
        expected = _encode_with_merges(text, merges)
        cases.append(Case("regression", inputs={"text": text, "merges": dict(merges)}, expected=expected))

    stress_specs = [
        ("ab" * 300, "ab" * 120, 18),
        ((("tokenization " * 80)).strip(), ("tokenization " * 20).strip(), 20),
        ("🙂中" * 120, "🙂中" * 50, 14),
        ((("aaaaabbbbcccdde " * 50)).strip(), ("abcde " * 60).strip(), 18),
    ]
    for corpus, text, num_merges in stress_specs:
        _, merges = _train_bpe(corpus, num_merges)
        expected = _encode_with_merges(text, merges)
        cases.append(Case("stress", inputs={"text": text, "merges": dict(merges)}, expected=expected))

    alphabet = ["a", "b", "c", "d", "e", " ", "f", "g", "h"]
    for _ in range(8):
        corpus_len = rng.randint(80, 260)
        corpus = "".join(rng.choice(alphabet) for _ in range(corpus_len))
        text_len = rng.randint(20, 120)
        text = "".join(rng.choice(alphabet) for _ in range(text_len))
        _, merges = _train_bpe(corpus, rng.randint(4, 16))
        expected = _encode_with_merges(text, merges)
        cases.append(Case("random", inputs={"text": text, "merges": dict(merges)}, expected=expected))

    return cases


def _gen_most_similar(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            0,
            [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [-1.0, 0.0], [0.0, 0.0]],
            2,
            False,
        ),
        (
            "boundary",
            1,
            [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [-1.0, 0.0], [0.0, 0.0]],
            3,
            False,
        ),
        (
            "boundary",
            0,
            [[1.0, 0.0], [0.9, 0.1], [0.3, 0.95], [-0.8, 0.2], [0.1, -0.9]],
            2,
            True,
        ),
        (
            "boundary",
            0,
            [[1.0, 0.0], [0.4, 0.9], [-0.7, 0.2], [0.2, -0.8]],
            0,
            False,
        ),
        (
            "adversarial",
            2,
            [[0.2, 1.0], [0.8, -0.2], [1.0, 0.0], [-0.9, 0.1], [0.4, -0.7], [0.7, 0.6]],
            4,
            True,
        ),
        (
            "regression",
            1,
            [[-0.2, 1.0], [1.0, 0.0], [0.85, 0.2], [0.4, 0.9], [-0.3, 0.8]],
            10,
            False,
        ),
    ]

    for idx, (bucket, query_id, matrix, k, require_margin) in enumerate(fixed):
        _assert_most_similar_stability(
            label=f"most-similar-fixed-{idx + 1}",
            query_id=query_id,
            embedding_matrix=matrix,
            k=k,
            require_margin=require_margin,
        )
        expected = _most_similar_ref(query_id, matrix, k, dtype=np.float32)
        code = f"query_id = {query_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        code += f"k = {k}\n"
        cases.append(Case(bucket, input_code=code, expected=expected))

    stress_specs = [(64, 12, 10), (96, 10, 12), (128, 8, 15), (80, 16, 20)]
    for idx, (rows, cols, k) in enumerate(stress_specs):
        query_id, k_value, matrix = _construct_most_similar_case(rng, rows=rows, cols=cols, k=k)
        _assert_most_similar_stability(
            label=f"most-similar-stress-{idx + 1}",
            query_id=query_id,
            embedding_matrix=matrix,
            k=k_value,
            require_margin=True,
        )
        expected = _most_similar_ref(query_id, matrix, k_value, dtype=np.float32)
        code = f"query_id = {query_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        code += f"k = {k_value}\n"
        cases.append(Case("stress", input_code=code, expected=expected))

    for index in range(10):
        rows = rng.randint(10, 70)
        cols = rng.randint(4, 16)
        k = rng.randint(1, min(rows - 1, 30))
        query_id, k_value, matrix = _construct_most_similar_case(rng, rows=rows, cols=cols, k=k)
        _assert_most_similar_stability(
            label=f"most-similar-random-{index + 1}",
            query_id=query_id,
            embedding_matrix=matrix,
            k=k_value,
            require_margin=True,
        )
        expected = _most_similar_ref(query_id, matrix, k_value, dtype=np.float32)
        code = f"query_id = {query_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        code += f"k = {k_value}\n"
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_vector_analogy(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            0,
            2,
            3,
            [[1.0, 1.0], [1.0, -1.0], [0.0, 1.0], [0.0, -1.0], [0.0, 0.0]],
            False,
        ),
        (
            "boundary",
            0,
            1,
            2,
            [[0.5, 0.9], [0.5, 0.5], [0.8, 0.5], [0.8, 0.9], [0.1, 0.1]],
            False,
        ),
        (
            "boundary",
            0,
            1,
            2,
            [[1.0, 0.0], [0.0, 0.0], [0.0, 1.0], [0.9, 0.9], [0.2, 1.0], [-1.0, 0.0]],
            True,
        ),
        (
            "adversarial",
            0,
            1,
            2,
            [[0.5, 0.5], [0.2, 0.2], [-0.5, 0.8], [-0.1, 1.0], [0.6, 0.7], [-1.0, -1.0]],
            True,
        ),
    ]

    for idx, (bucket, a_id, b_id, c_id, matrix, require_margin) in enumerate(fixed):
        _assert_analogy_stability(
            label=f"vector-analogy-fixed-{idx + 1}",
            a_id=a_id,
            b_id=b_id,
            c_id=c_id,
            embedding_matrix=matrix,
            require_margin=require_margin,
        )
        expected = _analogy_ref(a_id, b_id, c_id, matrix, dtype=np.float32)
        code = f"a_id = {a_id}\n"
        code += f"b_id = {b_id}\n"
        code += f"c_id = {c_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        cases.append(Case(bucket, input_code=code, expected=expected))

    stress_specs = [(72, 8), (96, 10), (120, 6), (80, 12)]
    for idx, (rows, cols) in enumerate(stress_specs):
        a_id, b_id, c_id, matrix = _construct_vector_analogy_case(rng, rows=rows, cols=cols)
        _assert_analogy_stability(
            label=f"vector-analogy-stress-{idx + 1}",
            a_id=a_id,
            b_id=b_id,
            c_id=c_id,
            embedding_matrix=matrix,
            require_margin=True,
        )
        expected = _analogy_ref(a_id, b_id, c_id, matrix, dtype=np.float32)
        code = f"a_id = {a_id}\n"
        code += f"b_id = {b_id}\n"
        code += f"c_id = {c_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        cases.append(Case("stress", input_code=code, expected=expected))

    for index in range(10):
        rows = rng.randint(12, 80)
        cols = rng.randint(4, 12)
        a_id, b_id, c_id, matrix = _construct_vector_analogy_case(rng, rows=rows, cols=cols)
        _assert_analogy_stability(
            label=f"vector-analogy-random-{index + 1}",
            a_id=a_id,
            b_id=b_id,
            c_id=c_id,
            embedding_matrix=matrix,
            require_margin=True,
        )
        expected = _analogy_ref(a_id, b_id, c_id, matrix, dtype=np.float32)

        code = f"a_id = {a_id}\n"
        code += f"b_id = {b_id}\n"
        code += f"c_id = {c_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_frequency_schedule(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    # Keep curated public examples first.
    fixed = [4, 8, 2, 6, 10, 12, 16, 32]
    for d_model in fixed:
        expected = _round_nested(_frequencies_ref(d_model), digits=FLOAT_EXPECTED_DIGITS)
        bucket = "boundary" if d_model <= 8 else "adversarial"
        cases.append(Case(bucket, inputs={"d_model": d_model}, expected=expected))

    for d_model in [128, 256, 512, 1024]:
        expected = _round_nested(_frequencies_ref(d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case("stress", inputs={"d_model": d_model}, expected=expected))

    for _ in range(8):
        d_model = rng.choice(
            [14, 18, 20, 22, 24, 26, 28, 30, 36, 40, 48, 64, 96, 192, 384, 768]
        )
        expected = _round_nested(_frequencies_ref(d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case("random", inputs={"d_model": d_model}, expected=expected))

    return cases


def _gen_pe_vector(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    fixed = [
        # Keep curated public examples first.
        ("boundary", 0, 4),
        ("boundary", 1, 4),
        ("boundary", 0, 2),
        ("adversarial", 5, 6),
        ("adversarial", 100, 8),
        ("adversarial", 1000, 10),
    ]

    for bucket, pos, d_model in fixed:
        expected = _round_nested(_pe_vector_ref(pos, d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case(bucket, inputs={"pos": pos, "d_model": d_model}, expected=expected))

    for pos, d_model in [(2048, 64), (4096, 128), (10000, 256), (50000, 64)]:
        expected = _round_nested(_pe_vector_ref(pos, d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case("stress", inputs={"pos": pos, "d_model": d_model}, expected=expected))

    for _ in range(10):
        pos = rng.randint(0, 100000)
        d_model = rng.choice([2, 4, 6, 8, 10, 12, 16, 32, 64, 128])
        expected = _round_nested(_pe_vector_ref(pos, d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case("random", inputs={"pos": pos, "d_model": d_model}, expected=expected))

    return cases


def _gen_pe_matrix(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    fixed = [
        # Keep curated public examples first.
        ("boundary", 2, 4),
        ("boundary", 3, 4),
        ("boundary", 1, 2),
        ("boundary", 1, 4),
        ("adversarial", 4, 6),
        ("adversarial", 6, 8),
        ("adversarial", 8, 10),
    ]

    for bucket, seq_len, d_model in fixed:
        expected = _round_nested(_pe_matrix_ref(seq_len, d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(
            Case(bucket, inputs={"seq_len": seq_len, "d_model": d_model}, expected=expected)
        )

    for seq_len, d_model in [(24, 24), (32, 24), (40, 20), (48, 16)]:
        expected = _round_nested(_pe_matrix_ref(seq_len, d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case("stress", inputs={"seq_len": seq_len, "d_model": d_model}, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(3, 20)
        d_model = rng.choice([6, 8, 10, 12, 16, 20, 24])
        expected = _round_nested(_pe_matrix_ref(seq_len, d_model), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(
            Case("random", inputs={"seq_len": seq_len, "d_model": d_model}, expected=expected)
        )

    return cases


def _gen_attention_weights(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        ("boundary", [[1.0, 0.0], [0.0, 1.0]], [[1.0, 0.0], [0.0, 1.0]]),
        (
            "boundary",
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        ),
        ("boundary", [[1.0, 0.0]], [[1.0, 0.0]]),
        ("adversarial", [[1.0, 1.0], [1.0, 1.0]], [[1.0, 1.0], [1.0, 1.0]]),
        ("adversarial", [[2.0, 0.0], [0.0, 2.0]], [[1.0, 0.0], [0.0, 1.0]]),
        (
            "regression",
            [[1.0, -1.0], [0.5, 0.5], [-1.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]],
        ),
        (
            "regression",
            [[0.2, 0.4, 0.6], [0.1, -0.3, 0.2], [0.0, 0.5, -0.5]],
            [[0.3, 0.6, 0.9], [0.7, -0.1, 0.0], [0.2, 0.2, 0.2]],
        ),
    ]

    for bucket, q, k in fixed:
        expected = _round_nested(
            _attention_weights_ref(q, k),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_k in [(16, 12), (20, 16), (24, 12), (18, 20)]:
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        expected = _round_nested(
            _attention_weights_ref(q, k),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(2, 14)
        d_k = rng.randint(3, 12)
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        expected = _round_nested(
            _attention_weights_ref(q, k),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_causal_attention(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0]],
        ),
        (
            "boundary",
            [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]],
            [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        ),
        ("boundary", [[1.0, 0.0]], [[1.0, 0.0]], [[0.5, 0.5]]),
        (
            "adversarial",
            [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]],
            [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]],
            [[1.0, 0.0], [0.0, 1.0], [0.0, 0.0]],
        ),
        (
            "adversarial",
            [[0.0, 1.0], [1.0, 0.0], [1.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]],
            [[0.2, 0.8], [0.8, 0.2], [0.5, 0.5]],
        ),
        (
            "regression",
            [[2.0, 0.0, 0.0], [0.0, 2.0, 0.0], [0.0, 0.0, 2.0], [1.0, 1.0, 1.0]],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [0.5, 0.5, 0.5]],
            [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5], [0.25, 0.75]],
        ),
        (
            "regression",
            [[0.1, 0.2], [0.2, 0.3], [0.3, 0.4]],
            [[0.4, 0.3], [0.3, 0.2], [0.2, 0.1]],
            [[1.0, 1.0, 1.0], [0.5, 0.5, 0.5], [0.0, 0.0, 0.0]],
        ),
    ]

    for bucket, q, k, v in fixed:
        expected = _round_nested(
            _causal_attention_ref(q, k, v),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        code += _torch_matrix_input_code("V", v)
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_k, d_v in [(16, 12, 8), (20, 10, 6), (24, 12, 10), (18, 16, 12)]:
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        v = _random_matrix(rng, seq_len, d_v)
        expected = _round_nested(
            _causal_attention_ref(q, k, v),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        code += _torch_matrix_input_code("V", v)
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(2, 14)
        d_k = rng.randint(3, 12)
        d_v = rng.randint(2, 10)
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        v = _random_matrix(rng, seq_len, d_v)
        expected = _round_nested(
            _causal_attention_ref(q, k, v),
            digits=FLOAT_EXPECTED_DIGITS,
        )

        code = _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        code += _torch_matrix_input_code("V", v)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_multi_head_causal_attention(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    def _identity(n: int) -> list[list[float]]:
        return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            [[1.0, 0.0], [0.0, 0.0]],
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0]],
            [[0.0, 1.0], [1.0, 0.0]],
            2,
        ),
        (
            "boundary",
            [[1.0, 0.0, 1.0, 0.0], [0.0, 1.0, 0.0, 1.0]],
            _identity(4),
            _identity(4),
            _identity(4),
            [[1.0, 0.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]],
            2,
        ),
        (
            "boundary",
            [[0.5, 0.5, 0.5, 0.5]],
            _identity(4),
            _identity(4),
            _identity(4),
            _identity(4),
            2,
        ),
        (
            "adversarial",
            [[1.0, 0.0, 1.0, 0.0], [0.0, 1.0, 0.0, 1.0]],
            _identity(4),
            _identity(4),
            _identity(4),
            [[1.0, 0.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]],
            2,
        ),
        (
            "adversarial",
            [[1.0, 0.0, 0.0, 1.0], [0.0, 1.0, 1.0, 0.0], [1.0, 1.0, 0.0, 0.0]],
            [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 1.0, 0.0]],
            [[0.0, 1.0, 0.0, 0.0], [1.0, 0.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]],
            _identity(4),
            _identity(4),
            2,
        ),
        (
            "regression",
            [[1.0, 0.0, 0.5, 0.5, 1.0, 0.0], [0.0, 1.0, 0.5, 0.5, 0.0, 1.0], [0.5, 0.5, 1.0, 0.0, 1.0, 1.0]],
            [[0.5, 0.5, 0.0, 0.0, 0.2, 0.0], [0.5, -0.5, 0.0, 0.0, 0.0, 0.2], [0.0, 0.0, 0.5, 0.5, 0.2, 0.0], [0.0, 0.0, 0.5, -0.5, 0.0, 0.2], [0.2, 0.0, 0.2, 0.0, 0.5, 0.0], [0.0, 0.2, 0.0, 0.2, 0.0, 0.5]],
            [[0.5, -0.5, 0.0, 0.0, 0.1, 0.0], [0.5, 0.5, 0.0, 0.0, 0.0, 0.1], [0.0, 0.0, 0.5, -0.5, 0.1, 0.0], [0.0, 0.0, 0.5, 0.5, 0.0, 0.1], [0.1, 0.0, 0.1, 0.0, 0.5, 0.0], [0.0, 0.1, 0.0, 0.1, 0.0, 0.5]],
            _identity(6),
            [[1.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0, 1.0]],
            3,
        ),
        (
            "regression",
            [[1.0, 0.0, 0.0, 1.0, 0.5, 0.5, 1.0, 0.0], [0.0, 1.0, 1.0, 0.0, 0.5, 0.5, 0.0, 1.0], [0.5, 0.5, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0], [1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.5, 0.5]],
            [[0.6, 0.0, 0.0, 0.0, 0.2, 0.0, 0.0, 0.0], [0.0, 0.6, 0.0, 0.0, 0.0, 0.2, 0.0, 0.0], [0.0, 0.0, 0.6, 0.0, 0.0, 0.0, 0.2, 0.0], [0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 0.0, 0.2], [0.2, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 0.0], [0.0, 0.2, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0], [0.0, 0.0, 0.2, 0.0, 0.0, 0.0, 0.6, 0.0], [0.0, 0.0, 0.0, 0.2, 0.0, 0.0, 0.0, 0.6]],
            [[0.6, 0.0, 0.0, 0.0, -0.2, 0.0, 0.0, 0.0], [0.0, 0.6, 0.0, 0.0, 0.0, -0.2, 0.0, 0.0], [0.0, 0.0, 0.6, 0.0, 0.0, 0.0, -0.2, 0.0], [0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 0.0, -0.2], [-0.2, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 0.0], [0.0, -0.2, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0], [0.0, 0.0, -0.2, 0.0, 0.0, 0.0, 0.6, 0.0], [0.0, 0.0, 0.0, -0.2, 0.0, 0.0, 0.0, 0.6]],
            _identity(8),
            _identity(8),
            4,
        ),
    ]

    for bucket, x, w_q, w_k, w_v, w_o, num_heads in fixed:
        expected = _round_nested(
            _multi_head_causal_attention_ref(x, w_q, w_k, w_v, w_o, num_heads),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("X", x)
        code += _torch_matrix_input_code("W_Q", w_q)
        code += _torch_matrix_input_code("W_K", w_k)
        code += _torch_matrix_input_code("W_V", w_v)
        code += _torch_matrix_input_code("W_O", w_o)
        code += f"num_heads = {num_heads}\n"
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_model, num_heads in [(16, 12, 3), (20, 16, 4), (24, 12, 6), (18, 24, 6)]:
        x = _random_matrix(rng, seq_len, d_model, low=-1.5, high=1.5)
        w_q = _random_matrix(rng, d_model, d_model, low=-0.8, high=0.8)
        w_k = _random_matrix(rng, d_model, d_model, low=-0.8, high=0.8)
        w_v = _random_matrix(rng, d_model, d_model, low=-0.8, high=0.8)
        w_o = _random_matrix(rng, d_model, d_model, low=-0.8, high=0.8)
        expected = _round_nested(
            _multi_head_causal_attention_ref(x, w_q, w_k, w_v, w_o, num_heads),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("X", x)
        code += _torch_matrix_input_code("W_Q", w_q)
        code += _torch_matrix_input_code("W_K", w_k)
        code += _torch_matrix_input_code("W_V", w_v)
        code += _torch_matrix_input_code("W_O", w_o)
        code += f"num_heads = {num_heads}\n"
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        d_model = rng.choice([4, 6, 8, 10, 12, 16])
        head_candidates = [h for h in [2, 3, 4, 5, 6, 8] if d_model % h == 0]
        num_heads = rng.choice(head_candidates)
        seq_len = rng.randint(2, 12)

        x = _random_matrix(rng, seq_len, d_model, low=-2.0, high=2.0)
        w_q = _random_matrix(rng, d_model, d_model, low=-1.0, high=1.0)
        w_k = _random_matrix(rng, d_model, d_model, low=-1.0, high=1.0)
        w_v = _random_matrix(rng, d_model, d_model, low=-1.0, high=1.0)
        w_o = _random_matrix(rng, d_model, d_model, low=-1.0, high=1.0)

        expected = _round_nested(
            _multi_head_causal_attention_ref(x, w_q, w_k, w_v, w_o, num_heads),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("X", x)
        code += _torch_matrix_input_code("W_Q", w_q)
        code += _torch_matrix_input_code("W_K", w_k)
        code += _torch_matrix_input_code("W_V", w_v)
        code += _torch_matrix_input_code("W_O", w_o)
        code += f"num_heads = {num_heads}\n"
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_gelu(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        ("boundary", [0.0, 1.0, -1.0]),
        ("boundary", [[0.5, -0.5], [2.0, -2.0]]),
        ("boundary", [0.0]),
        ("adversarial", [3.0, -3.0, 0.25, -0.25]),
        ("regression", [0.001, -0.001, 6.0, -6.0]),
        ("regression", [[1.25, -0.75, 0.0], [-2.5, 2.5, 0.5]]),
    ]

    for bucket, x in fixed:
        expected = _round_nested(_gelu_ref(x), digits=FLOAT_EXPECTED_DIGITS)
        code = f"x = torch.tensor({repr(x)}, dtype=torch.float32)\n"
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_model in [(24, 12), (32, 16), (20, 24), (40, 8)]:
        x = _random_matrix(rng, seq_len, d_model, low=-6.0, high=6.0)
        expected = _round_nested(_gelu_ref(x), digits=FLOAT_EXPECTED_DIGITS)
        code = _torch_matrix_input_code("x", x)
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        if rng.random() < 0.5:
            length = rng.randint(2, 24)
            x = [round(rng.uniform(-6.0, 6.0), 4) for _ in range(length)]
            code = f"x = torch.tensor({repr(x)}, dtype=torch.float32)\n"
        else:
            seq_len = rng.randint(2, 12)
            d_model = rng.randint(2, 16)
            x = _random_matrix(rng, seq_len, d_model, low=-6.0, high=6.0)
            code = _torch_matrix_input_code("x", x)

        expected = _round_nested(_gelu_ref(x), digits=FLOAT_EXPECTED_DIGITS)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_ffn_forward_pass(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            [[1.0, 0.0], [0.0, 1.0]],
            [[0.5, -0.3, 0.8], [0.1, 0.6, -0.2]],
            [0.0, 0.0, 0.0],
            [[0.4, -0.1], [0.2, 0.5], [-0.3, 0.7]],
            [0.0, 0.0],
        ),
        (
            "boundary",
            [[1.0, -1.0], [0.5, 0.5]],
            [[0.5, -0.3, 0.8], [0.1, 0.6, -0.2]],
            [0.1, -0.1, 0.2],
            [[0.4, -0.1], [0.2, 0.5], [-0.3, 0.7]],
            [0.1, -0.1],
        ),
        (
            "boundary",
            [[0.0, 0.0]],
            [[1.0, -1.0], [0.5, 0.5]],
            [0.2, -0.2],
            [[1.0, 0.0], [0.0, 1.0]],
            [0.0, 0.0],
        ),
        (
            "adversarial",
            [[2.0, -1.0, 0.5], [-0.5, 1.5, -2.0]],
            [[0.3, -0.6, 0.4, 0.2], [-0.1, 0.5, -0.7, 0.9], [0.8, 0.2, -0.3, -0.4]],
            [0.1, -0.2, 0.3, -0.4],
            [[0.5, -0.2, 0.1], [-0.3, 0.4, 0.2], [0.7, -0.1, -0.5], [0.2, 0.6, -0.3]],
            [0.05, -0.1, 0.2],
        ),
        (
            "regression",
            [[-1.2, 0.3], [0.8, -0.7], [0.0, 0.5]],
            [[-0.4, 0.6, 0.2, -0.1], [0.7, -0.3, 0.5, 0.9]],
            [-0.2, 0.1, 0.0, 0.3],
            [[0.3, -0.2], [0.4, 0.1], [-0.5, 0.7], [0.6, -0.4]],
            [0.0, 0.15],
        ),
        (
            "regression",
            [[0.25, -0.5, 0.75, -1.0]],
            [[0.2, 0.1, -0.3], [-0.4, 0.5, 0.6], [0.7, -0.8, 0.9], [-1.0, 0.2, -0.1]],
            [0.05, -0.05, 0.1],
            [[0.6, -0.2, 0.4, -0.1], [0.3, 0.7, -0.5, 0.2], [-0.4, 0.1, 0.8, -0.6]],
            [0.0, 0.1, -0.1, 0.2],
        ),
    ]

    for bucket, x, w1, b1, w2, b2 in fixed:
        expected = _round_nested(
            _ffn_ref(x, w1, b1, w2, b2),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_matrix_input_code("W1", w1)
        code += _torch_vector_input_code("b1", b1)
        code += _torch_matrix_input_code("W2", w2)
        code += _torch_vector_input_code("b2", b2)
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_model, d_ff in [(12, 8, 24), (14, 10, 30), (10, 12, 36), (16, 6, 24)]:
        x = _random_matrix(rng, seq_len, d_model, low=-2.0, high=2.0)
        w1 = _random_matrix(rng, d_model, d_ff, low=-1.0, high=1.0)
        b1 = [round(rng.uniform(-0.5, 0.5), 4) for _ in range(d_ff)]
        w2 = _random_matrix(rng, d_ff, d_model, low=-1.0, high=1.0)
        b2 = [round(rng.uniform(-0.5, 0.5), 4) for _ in range(d_model)]
        expected = _round_nested(
            _ffn_ref(x, w1, b1, w2, b2),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_matrix_input_code("W1", w1)
        code += _torch_vector_input_code("b1", b1)
        code += _torch_matrix_input_code("W2", w2)
        code += _torch_vector_input_code("b2", b2)
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(2, 10)
        d_model = rng.choice([2, 3, 4, 6, 8, 10])
        d_ff = rng.choice([d_model * 2, d_model * 3, d_model * 4])
        x = _random_matrix(rng, seq_len, d_model, low=-2.0, high=2.0)
        w1 = _random_matrix(rng, d_model, d_ff, low=-1.0, high=1.0)
        b1 = [round(rng.uniform(-0.5, 0.5), 4) for _ in range(d_ff)]
        w2 = _random_matrix(rng, d_ff, d_model, low=-1.0, high=1.0)
        b2 = [round(rng.uniform(-0.5, 0.5), 4) for _ in range(d_model)]
        expected = _round_nested(
            _ffn_ref(x, w1, b1, w2, b2),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_matrix_input_code("W1", w1)
        code += _torch_vector_input_code("b1", b1)
        code += _torch_matrix_input_code("W2", w2)
        code += _torch_vector_input_code("b2", b2)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_layer_normalization(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            [[2.0, 4.0, 6.0, 8.0]],
            [1.0, 1.0, 1.0, 1.0],
            [0.0, 0.0, 0.0, 0.0],
            1e-5,
        ),
        (
            "boundary",
            [[1.0, 2.0, 3.0], [4.0, 4.0, 4.0]],
            [2.0, 1.0, 0.5],
            [0.0, 1.0, -1.0],
            1e-5,
        ),
        (
            "boundary",
            [[4.0, 4.0, 4.0, 4.0]],
            [1.0, 1.0, 1.0, 1.0],
            [0.0, 0.0, 0.0, 0.0],
            1e-5,
        ),
        (
            "adversarial",
            [[-1.0, 0.0, 1.0], [3.0, -3.0, 0.5], [0.2, 0.2, 0.2]],
            [1.5, -0.5, 2.0],
            [0.1, -0.2, 0.3],
            1e-6,
        ),
        (
            "regression",
            [[0.5, -0.5, 1.5, -1.5], [2.0, 0.0, -2.0, 1.0]],
            [1.0, 0.5, -1.0, 2.0],
            [0.0, 0.2, -0.2, 0.4],
            1e-5,
        ),
        (
            "regression",
            [[10.0, 10.1, 9.9], [-5.0, -4.9, -5.1]],
            [0.75, 1.25, -0.5],
            [0.1, 0.0, -0.1],
            1e-8,
        ),
    ]

    for bucket, x, gamma, beta, eps in fixed:
        expected = _round_nested(
            _layer_norm_ref(x, gamma, beta, eps),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_vector_input_code("gamma", gamma)
        code += _torch_vector_input_code("beta", beta)
        code += f"eps = {eps}\n"
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_model in [(16, 24), (12, 32), (20, 16), (10, 40)]:
        x = _random_matrix(rng, seq_len, d_model, low=-3.0, high=3.0)
        gamma = [round(rng.uniform(0.5, 1.5), 4) for _ in range(d_model)]
        beta = [round(rng.uniform(-0.5, 0.5), 4) for _ in range(d_model)]
        eps = rng.choice([1e-5, 1e-6])
        expected = _round_nested(
            _layer_norm_ref(x, gamma, beta, eps),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_vector_input_code("gamma", gamma)
        code += _torch_vector_input_code("beta", beta)
        code += f"eps = {eps}\n"
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(2, 12)
        d_model = rng.randint(2, 20)
        x = _random_matrix(rng, seq_len, d_model, low=-3.0, high=3.0)
        gamma = [round(rng.uniform(-1.5, 1.5), 4) for _ in range(d_model)]
        beta = [round(rng.uniform(-0.5, 0.5), 4) for _ in range(d_model)]
        eps = rng.choice([1e-5, 1e-6, 1e-8])
        expected = _round_nested(
            _layer_norm_ref(x, gamma, beta, eps),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_vector_input_code("gamma", gamma)
        code += _torch_vector_input_code("beta", beta)
        code += f"eps = {eps}\n"
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_pre_norm_residual_block(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        # Keep curated public examples first.
        (
            "boundary",
            [[1.0, 2.0], [3.0, 4.0]],
            [1.0, 1.0],
            [0.0, 0.0],
            [[0.5, 0.0], [0.0, 0.5]],
            [0.0, 0.0],
            1e-5,
        ),
        (
            "boundary",
            [[1.0, -1.0, 0.0], [2.0, 0.0, -2.0]],
            [1.0, 2.0, 1.0],
            [0.1, 0.0, -0.1],
            [[0.3, 0.0, -0.1], [0.0, 0.5, 0.2], [-0.2, 0.1, 0.4]],
            [0.1, 0.0, -0.1],
            1e-5,
        ),
        (
            "boundary",
            [[0.5, -0.5, 1.0], [2.0, 1.0, 0.0]],
            [1.0, 1.0, 1.0],
            [0.0, 0.0, 0.0],
            [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
            [0.0, 0.0, 0.0],
            1e-5,
        ),
        (
            "adversarial",
            [[-1.0, 0.0, 1.0, 2.0], [0.2, -0.2, 0.2, -0.2]],
            [1.2, 0.8, -1.0, 0.5],
            [0.0, 0.1, -0.1, 0.2],
            [[0.4, -0.1, 0.2, 0.0], [0.0, 0.3, -0.2, 0.1], [-0.3, 0.0, 0.5, -0.4], [0.2, 0.1, 0.0, 0.6]],
            [0.05, -0.05, 0.1, -0.1],
            1e-6,
        ),
        (
            "regression",
            [[3.0, 3.0, 3.0], [1.0, 2.0, 4.0], [-2.0, -1.0, -3.0]],
            [0.7, 1.3, -0.9],
            [0.2, -0.2, 0.0],
            [[0.6, -0.4, 0.1], [0.2, 0.5, -0.3], [-0.1, 0.7, 0.4]],
            [0.0, 0.1, -0.1],
            1e-5,
        ),
        (
            "regression",
            [[-0.5, 0.5], [1.5, -1.5], [0.0, 0.0]],
            [1.5, -0.5],
            [0.0, 0.2],
            [[-0.7, 0.4], [0.3, 0.6]],
            [0.1, -0.1],
            1e-8,
        ),
    ]

    for bucket, x, gamma, beta, w, b, eps in fixed:
        expected = _round_nested(
            _pre_norm_block_ref(x, gamma, beta, w, b, eps),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_vector_input_code("gamma", gamma)
        code += _torch_vector_input_code("beta", beta)
        code += _torch_matrix_input_code("W", w)
        code += _torch_vector_input_code("b", b)
        code += f"eps = {eps}\n"
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_model in [(12, 10), (14, 12), (16, 8), (10, 16)]:
        x = _random_matrix(rng, seq_len, d_model, low=-2.0, high=2.0)
        gamma = [round(rng.uniform(0.5, 1.5), 4) for _ in range(d_model)]
        beta = [round(rng.uniform(-0.3, 0.3), 4) for _ in range(d_model)]
        w = _random_matrix(rng, d_model, d_model, low=-0.8, high=0.8)
        b = [round(rng.uniform(-0.2, 0.2), 4) for _ in range(d_model)]
        eps = rng.choice([1e-5, 1e-6])
        expected = _round_nested(
            _pre_norm_block_ref(x, gamma, beta, w, b, eps),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_vector_input_code("gamma", gamma)
        code += _torch_vector_input_code("beta", beta)
        code += _torch_matrix_input_code("W", w)
        code += _torch_vector_input_code("b", b)
        code += f"eps = {eps}\n"
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(2, 10)
        d_model = rng.randint(2, 14)
        x = _random_matrix(rng, seq_len, d_model, low=-2.0, high=2.0)
        gamma = [round(rng.uniform(-1.5, 1.5), 4) for _ in range(d_model)]
        beta = [round(rng.uniform(-0.3, 0.3), 4) for _ in range(d_model)]
        w = _random_matrix(rng, d_model, d_model, low=-0.8, high=0.8)
        b = [round(rng.uniform(-0.2, 0.2), 4) for _ in range(d_model)]
        eps = rng.choice([1e-5, 1e-6, 1e-8])
        expected = _round_nested(
            _pre_norm_block_ref(x, gamma, beta, w, b, eps),
            digits=FLOAT_EXPECTED_DIGITS,
        )
        code = _torch_matrix_input_code("x", x)
        code += _torch_vector_input_code("gamma", gamma)
        code += _torch_vector_input_code("beta", beta)
        code += _torch_matrix_input_code("W", w)
        code += _torch_vector_input_code("b", b)
        code += f"eps = {eps}\n"
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


PROBLEM_GENERATORS: dict[str, ProblemGenerator] = {
    "build-gpt/01-from-text-to-bytes/01-encoder": _gen_encoder,
    "build-gpt/01-from-text-to-bytes/02-byte-inspector": _gen_byte_inspector,
    "build-gpt/02-tokenization/01-pair-counter": _gen_pair_counter,
    "build-gpt/02-tokenization/02-token-merger": _gen_token_merger,
    "build-gpt/02-tokenization/03-bpe-trainer": _gen_bpe_trainer,
    "build-gpt/02-tokenization/04-decoder": _gen_decoder,
    "build-gpt/02-tokenization/05-encoder": _gen_encoder_inference,
    "build-gpt/03-embeddings/01-most-similar": _gen_most_similar,
    "build-gpt/03-embeddings/02-vector-analogy": _gen_vector_analogy,
    "build-gpt/04-positional-encoding/01-frequency-schedule": _gen_frequency_schedule,
    "build-gpt/04-positional-encoding/02-positional-encoding-vector": _gen_pe_vector,
    "build-gpt/04-positional-encoding/03-pe-matrix": _gen_pe_matrix,
    "build-gpt/05-attention-mechanism/01-attention-weights": _gen_attention_weights,
    "build-gpt/05-attention-mechanism/02-causal-attention": _gen_causal_attention,
    "build-gpt/06-multi-head-attention/01-multi-head-causal-attention": _gen_multi_head_causal_attention,
    "build-gpt/07-feed-forward-networks/01-gelu": _gen_gelu,
    "build-gpt/07-feed-forward-networks/02-ffn-forward-pass": _gen_ffn_forward_pass,
    "build-gpt/08-residuals-and-normalization/01-layer-normalization": _gen_layer_normalization,
    "build-gpt/08-residuals-and-normalization/02-pre-norm-residual-block": _gen_pre_norm_residual_block,
}


PROBLEM_SEEDS: dict[str, int] = {
    "build-gpt/01-from-text-to-bytes/01-encoder": 101,
    "build-gpt/01-from-text-to-bytes/02-byte-inspector": 102,
    "build-gpt/02-tokenization/01-pair-counter": 201,
    "build-gpt/02-tokenization/02-token-merger": 202,
    "build-gpt/02-tokenization/03-bpe-trainer": 203,
    "build-gpt/02-tokenization/04-decoder": 204,
    "build-gpt/02-tokenization/05-encoder": 205,
    "build-gpt/03-embeddings/01-most-similar": 301,
    "build-gpt/03-embeddings/02-vector-analogy": 302,
    "build-gpt/04-positional-encoding/01-frequency-schedule": 401,
    "build-gpt/04-positional-encoding/02-positional-encoding-vector": 402,
    "build-gpt/04-positional-encoding/03-pe-matrix": 403,
    "build-gpt/05-attention-mechanism/01-attention-weights": 501,
    "build-gpt/05-attention-mechanism/02-causal-attention": 502,
    "build-gpt/06-multi-head-attention/01-multi-head-causal-attention": 601,
    "build-gpt/07-feed-forward-networks/01-gelu": 701,
    "build-gpt/07-feed-forward-networks/02-ffn-forward-pass": 702,
    "build-gpt/08-residuals-and-normalization/01-layer-normalization": 801,
    "build-gpt/08-residuals-and-normalization/02-pre-norm-residual-block": 802,
}

PUBLIC_CASE_COUNT_OVERRIDES: dict[str, int] = {
    "build-gpt/02-tokenization/03-bpe-trainer": 1,
    "build-gpt/02-tokenization/04-decoder": 1,
    "build-gpt/02-tokenization/05-encoder": 1,
}


def _render_json(data: dict[str, Any]) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _json_equivalent(left: Any, right: Any) -> bool:
    if _is_number(left) and _is_number(right):
        return math.isclose(
            float(left),
            float(right),
            rel_tol=GENERATION_CHECK_RTOL,
            abs_tol=GENERATION_CHECK_ATOL,
        )
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        if set(left.keys()) != set(right.keys()):
            return False
        return all(_json_equivalent(left[key], right[key]) for key in left)
    if isinstance(left, list):
        if len(left) != len(right):
            return False
        return all(_json_equivalent(a, b) for a, b in zip(left, right))
    return left == right



def _public_case_count(problem_id: str) -> int:
    return PUBLIC_CASE_COUNT_OVERRIDES.get(problem_id, 2)


def generate_problem_tests(problem_id: str, problems_root: Path, seed_offset: int = 0) -> tuple[dict[str, Any], dict[str, Any]]:
    generator = PROBLEM_GENERATORS[problem_id]
    base_seed = PROBLEM_SEEDS.get(problem_id, 0)
    rng = random.Random(base_seed + seed_offset)
    cases = generator(rng)
    _assert_case_count(problem_id, cases)

    public_count = _public_case_count(problem_id)
    if public_count < 1:
        raise ValueError(f"{problem_id}: public case count must be >= 1")
    if public_count > len(cases):
        raise ValueError(
            f"{problem_id}: requested {public_count} public cases but only {len(cases)} generated"
        )

    public_seed_cases = cases[:public_count]
    hidden_seed_cases = cases[public_count:]
    public_signatures = {_case_signature(case) for case in public_seed_cases}
    hidden_seed_cases = [
        case
        for case in hidden_seed_cases
        if _case_signature(case) not in public_signatures
    ]
    public_cases = _assign_public_ids(public_seed_cases)
    hidden_cases = _assign_hidden_ids(hidden_seed_cases)

    return {"version": 1, "cases": public_cases}, {"version": 1, "cases": hidden_cases}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic public + hidden tests")
    parser.add_argument(
        "--problems-root",
        default="problems",
        help="Path to judge problems root (default: problems)",
    )
    parser.add_argument(
        "--only",
        default=None,
        help="Optional single problem id, e.g. build-gpt/03-embeddings/01-most-similar",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check mode: fail if committed test files differ from generated output",
    )
    parser.add_argument(
        "--seed-offset",
        type=int,
        default=0,
        help="Optional integer offset to all problem seeds",
    )
    args = parser.parse_args()

    problems_root = Path(args.problems_root).resolve()
    if not problems_root.exists():
        raise SystemExit(f"problems root not found: {problems_root}")

    problem_ids = sorted(PROBLEM_GENERATORS.keys())
    if args.only:
        if args.only not in PROBLEM_GENERATORS:
            raise SystemExit(f"Unsupported problem id: {args.only}")
        problem_ids = [args.only]

    changed = 0
    checked = 0

    for problem_id in problem_ids:
        problem_dir = problems_root / problem_id
        if not problem_dir.exists():
            raise SystemExit(f"Problem directory not found: {problem_dir}")

        public_path = problem_dir / "public_tests.json"
        hidden_path = problem_dir / "hidden_tests.json"

        generated_public, generated_hidden = generate_problem_tests(
            problem_id,
            problems_root=problems_root,
            seed_offset=args.seed_offset,
        )
        rendered_public = _render_json(generated_public)
        rendered_hidden = _render_json(generated_hidden)

        existing_public = public_path.read_text() if public_path.exists() else None
        existing_hidden = hidden_path.read_text() if hidden_path.exists() else None
        existing_public_obj = json.loads(existing_public) if existing_public is not None else None
        existing_hidden_obj = json.loads(existing_hidden) if existing_hidden is not None else None

        if args.check:
            checked += 1
            mismatched = False
            if existing_public_obj is None or not _json_equivalent(existing_public_obj, generated_public):
                mismatched = True
                print(f"MISMATCH: {problem_id} (public_tests.json)")
            if existing_hidden_obj is None or not _json_equivalent(existing_hidden_obj, generated_hidden):
                mismatched = True
                print(f"MISMATCH: {problem_id} (hidden_tests.json)")
            if mismatched:
                changed += 1
        else:
            updated_files = 0
            if existing_public != rendered_public:
                public_path.write_text(rendered_public)
                updated_files += 1
            if existing_hidden != rendered_hidden:
                hidden_path.write_text(rendered_hidden)
                updated_files += 1
            changed += updated_files
            if updated_files:
                print(f"UPDATED: {problem_id} ({updated_files} file(s))")
            else:
                print(f"UNCHANGED: {problem_id}")

    if args.check:
        if changed:
            raise SystemExit(f"{changed}/{checked} problem(s) have out-of-date generated tests")
        print(f"OK: {checked} problem(s) match generated public + hidden tests")
    else:
        print(f"Done. Updated {changed} test file(s)")


if __name__ == "__main__":
    main()
