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
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


ProblemGenerator = Callable[[random.Random], list["Case"]]


@dataclass
class Case:
    bucket: str
    inputs: dict[str, Any] | None = None
    input_code: str | None = None
    expected: Any = None
    expected_is_code: bool = False


def _literal(value: Any) -> str:
    return repr(value)


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
    if case.input_code is not None:
        code = case.input_code
        if not code.endswith("\n"):
            code += "\n"
        out["input_code"] = code
    elif case.inputs is not None:
        out["inputs"] = {k: _literal(v) for k, v in case.inputs.items()}
    else:
        raise ValueError("Case must provide either inputs or input_code")

    if case.expected_is_code:
        out["expected"] = repr(case.expected)
        out["expected_is_code"] = True
    else:
        out["expected"] = case.expected

    return out


def _assign_ids(cases: list[Case]) -> list[dict[str, Any]]:
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
        out.append(_serialize_case(f"{prefix}{counts[prefix]:02d}", case))
    return out


def _assert_case_count(problem_id: str, cases: list[Case], minimum: int = 15, maximum: int = 25) -> None:
    if not (minimum <= len(cases) <= maximum):
        raise ValueError(
            f"{problem_id}: generated {len(cases)} cases, expected between {minimum} and {maximum}"
        )


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


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


def _most_similar_ref(query_id: int, embedding_matrix: list[list[float]], k: int) -> list[int]:
    query = embedding_matrix[query_id]
    scored: list[tuple[float, int]] = []
    for idx, vec in enumerate(embedding_matrix):
        if idx == query_id:
            continue
        sim = _cosine_similarity(query, vec)
        scored.append((sim, idx))
    scored.sort(key=lambda item: (-item[0], item[1]))
    limit = max(0, min(k, len(scored)))
    return [idx for _, idx in scored[:limit]]


def _analogy_ref(a_id: int, b_id: int, c_id: int, embedding_matrix: list[list[float]]) -> int:
    a = embedding_matrix[a_id]
    b = embedding_matrix[b_id]
    c = embedding_matrix[c_id]
    target = [x - y + z for x, y, z in zip(a, b, c)]

    scored: list[tuple[float, int]] = []
    excluded = {a_id, b_id, c_id}
    for idx, vec in enumerate(embedding_matrix):
        if idx in excluded:
            continue
        sim = _cosine_similarity(target, vec)
        scored.append((sim, idx))

    if not scored:
        raise ValueError("Vector analogy needs at least one candidate token")
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored[0][1]


def _frequencies_ref(d_model: int) -> list[float]:
    half = d_model // 2
    return [1.0 / (10000.0 ** (2.0 * i / d_model)) for i in range(half)]


def _pe_vector_ref(pos: int, d_model: int) -> list[float]:
    freq = _frequencies_ref(d_model)
    out = [0.0] * d_model
    for i, f in enumerate(freq):
        out[2 * i] = math.sin(pos * f)
        out[2 * i + 1] = math.cos(pos * f)
    return out


def _pe_matrix_ref(seq_len: int, d_model: int) -> list[list[float]]:
    return [_pe_vector_ref(pos, d_model) for pos in range(seq_len)]


def _softmax(row: list[float]) -> list[float]:
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]


def _attention_weights_ref(q: list[list[float]], k: list[list[float]]) -> list[list[float]]:
    d_k = len(q[0])
    scale = math.sqrt(d_k)
    scores: list[list[float]] = []
    for q_row in q:
        row = []
        for k_row in k:
            row.append(sum(a * b for a, b in zip(q_row, k_row)) / scale)
        scores.append(_softmax(row))
    return scores


def _causal_attention_ref(
    q: list[list[float]], k: list[list[float]], v: list[list[float]]
) -> list[list[float]]:
    seq_len = len(q)
    d_k = len(q[0])
    scale = math.sqrt(d_k)

    scores: list[list[float]] = []
    for q_row in q:
        row = []
        for k_row in k:
            row.append(sum(a * b for a, b in zip(q_row, k_row)) / scale)
        scores.append(row)

    weights: list[list[float]] = []
    for i in range(seq_len):
        masked = []
        for j in range(seq_len):
            masked.append(scores[i][j] if j <= i else -1e30)
        weights.append(_softmax(masked))

    d_v = len(v[0])
    out: list[list[float]] = []
    for i in range(seq_len):
        row = []
        for d in range(d_v):
            row.append(sum(weights[i][j] * v[j][d] for j in range(seq_len)))
        out.append(row)
    return out


def _torch_matrix_input_code(var_name: str, matrix: list[list[float]]) -> str:
    return f"{var_name} = torch.tensor({repr(matrix)}, dtype=torch.float32)\n"


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

    for text in ["", "A", "hello", "🙂", "e\u0301", "𐍈"]:
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

    boundary_lists = [[], [0], [0x80], [0xC2, 0xA9], [0xF0, 0x9F, 0x98, 0x80]]
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

    merges0: OrderedDict[tuple[int, int], int] = OrderedDict()
    fixed.append(("boundary", [], merges0, ""))

    merges1: OrderedDict[tuple[int, int], int] = OrderedDict([((104, 105), 256)])
    fixed.append(("boundary", [256], merges1, "hi"))

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
        ("boundary", "", OrderedDict()),
        ("boundary", "aa", OrderedDict([((97, 97), 256)])),
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
        ("boundary", 0, [[1.0, 0.0], [0.0, 1.0]], 1),
        ("boundary", 0, [[0.0, 0.0], [1.0, 0.0], [-1.0, 0.0]], 2),
        ("boundary", 1, [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0]], 5),
        ("adversarial", 0, [[1.0, 0.0], [1.0, 0.0], [0.0, 1.0], [0.0, -1.0]], 2),
        ("adversarial", 2, [[1.0, 1.0], [1.0, -1.0], [1.0, 0.0], [-1.0, 0.0]], 0),
        ("adversarial", 3, [[1.0, 0.0], [0.5, 0.0], [0.5, 0.0], [0.0, 1.0], [0.0, -1.0]], 3),
    ]

    for bucket, query_id, matrix, k in fixed:
        expected = _most_similar_ref(query_id, matrix, k)
        code = "import torch\n"
        code += f"query_id = {query_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        code += f"k = {k}\n"
        cases.append(Case(bucket, input_code=code, expected=expected))

    stress_specs = [(64, 12, 10), (96, 10, 12), (128, 8, 15), (80, 16, 20)]
    for rows, cols, k in stress_specs:
        matrix = _random_matrix(rng, rows, cols)
        matrix[rng.randrange(rows)] = [0.0] * cols
        matrix[rng.randrange(rows)] = matrix[rng.randrange(rows)].copy()
        query_id = rng.randrange(rows)
        expected = _most_similar_ref(query_id, matrix, k)
        code = "import torch\n"
        code += f"query_id = {query_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        code += f"k = {k}\n"
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        rows = rng.randint(10, 70)
        cols = rng.randint(4, 16)
        matrix = _random_matrix(rng, rows, cols)
        if rng.random() < 0.35:
            matrix[rng.randrange(rows)] = [0.0] * cols
        if rng.random() < 0.3:
            matrix[rng.randrange(rows)] = matrix[rng.randrange(rows)].copy()
        query_id = rng.randrange(rows)
        k = rng.randint(0, min(rows + 2, 30))
        expected = _most_similar_ref(query_id, matrix, k)
        code = "import torch\n"
        code += f"query_id = {query_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        code += f"k = {k}\n"
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_vector_analogy(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        (
            "boundary",
            0,
            1,
            2,
            [[1.0, 1.0], [1.0, 0.0], [0.0, 1.0], [0.0, 0.0], [1.0, 2.0]],
        ),
        (
            "boundary",
            0,
            1,
            2,
            [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
        ),
        (
            "adversarial",
            0,
            2,
            3,
            [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [0.0, 0.0], [0.5, 0.5]],
        ),
        (
            "adversarial",
            1,
            2,
            3,
            [[1.0, -1.0], [0.0, 1.0], [1.0, 0.0], [0.0, 0.0], [1.0, 1.0]],
        ),
        (
            "regression",
            0,
            1,
            2,
            [[2.0, 1.0], [1.0, 1.0], [0.0, 2.0], [1.0, 2.0], [2.0, 2.0]],
        ),
        (
            "regression",
            2,
            3,
            4,
            [[0.5, 0.9], [0.5, 0.5], [0.8, 0.5], [0.8, 0.9], [0.1, 0.1], [0.3, 0.3]],
        ),
    ]

    for bucket, a_id, b_id, c_id, matrix in fixed:
        expected = _analogy_ref(a_id, b_id, c_id, matrix)
        code = "import torch\n"
        code += f"a_id = {a_id}\n"
        code += f"b_id = {b_id}\n"
        code += f"c_id = {c_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        cases.append(Case(bucket, input_code=code, expected=expected))

    stress_specs = [(72, 8), (96, 10), (120, 6), (80, 12)]
    for rows, cols in stress_specs:
        matrix = _random_matrix(rng, rows, cols)
        for _zero in range(rng.randint(1, 3)):
            matrix[rng.randrange(rows)] = [0.0] * cols
        a_id, b_id, c_id = rng.sample(range(rows), k=3)
        expected = _analogy_ref(a_id, b_id, c_id, matrix)
        code = "import torch\n"
        code += f"a_id = {a_id}\n"
        code += f"b_id = {b_id}\n"
        code += f"c_id = {c_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        rows = rng.randint(12, 80)
        cols = rng.randint(4, 12)
        matrix = _random_matrix(rng, rows, cols)
        for _zero in range(rng.randint(0, 2)):
            matrix[rng.randrange(rows)] = [0.0] * cols

        ids = rng.sample(range(rows), k=3)
        a_id, b_id, c_id = ids[0], ids[1], ids[2]
        expected = _analogy_ref(a_id, b_id, c_id, matrix)

        code = "import torch\n"
        code += f"a_id = {a_id}\n"
        code += f"b_id = {b_id}\n"
        code += f"c_id = {c_id}\n"
        code += _torch_matrix_input_code("embedding_matrix", matrix)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_frequency_schedule(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    fixed = [2, 4, 6, 8, 10, 12, 16, 32]
    for d_model in fixed:
        expected = _round_nested(_frequencies_ref(d_model))
        bucket = "boundary" if d_model <= 8 else "adversarial"
        cases.append(Case(bucket, inputs={"d_model": d_model}, expected=expected))

    for d_model in [128, 256, 512, 1024]:
        expected = _round_nested(_frequencies_ref(d_model))
        cases.append(Case("stress", inputs={"d_model": d_model}, expected=expected))

    for _ in range(8):
        d_model = rng.choice(
            [14, 18, 20, 22, 24, 26, 28, 30, 36, 40, 48, 64, 96, 192, 384, 768]
        )
        expected = _round_nested(_frequencies_ref(d_model))
        cases.append(Case("random", inputs={"d_model": d_model}, expected=expected))

    return cases


def _gen_pe_vector(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    fixed = [
        ("boundary", 0, 2),
        ("boundary", 0, 4),
        ("boundary", 1, 4),
        ("adversarial", 5, 6),
        ("adversarial", 100, 8),
        ("adversarial", 1000, 10),
    ]

    for bucket, pos, d_model in fixed:
        expected = _round_nested(_pe_vector_ref(pos, d_model))
        cases.append(Case(bucket, inputs={"pos": pos, "d_model": d_model}, expected=expected))

    for pos, d_model in [(2048, 64), (4096, 128), (10000, 256), (50000, 64)]:
        expected = _round_nested(_pe_vector_ref(pos, d_model))
        cases.append(Case("stress", inputs={"pos": pos, "d_model": d_model}, expected=expected))

    for _ in range(10):
        pos = rng.randint(0, 100000)
        d_model = rng.choice([2, 4, 6, 8, 10, 12, 16, 32, 64, 128])
        expected = _round_nested(_pe_vector_ref(pos, d_model))
        cases.append(Case("random", inputs={"pos": pos, "d_model": d_model}, expected=expected))

    return cases


def _gen_pe_matrix(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    fixed = [
        ("boundary", 1, 2),
        ("boundary", 1, 4),
        ("boundary", 2, 4),
        ("adversarial", 4, 6),
        ("adversarial", 6, 8),
        ("adversarial", 8, 10),
    ]

    for bucket, seq_len, d_model in fixed:
        expected = _round_nested(_pe_matrix_ref(seq_len, d_model))
        cases.append(
            Case(bucket, inputs={"seq_len": seq_len, "d_model": d_model}, expected=expected)
        )

    for seq_len, d_model in [(24, 24), (32, 24), (40, 20), (48, 16)]:
        expected = _round_nested(_pe_matrix_ref(seq_len, d_model))
        cases.append(Case("stress", inputs={"seq_len": seq_len, "d_model": d_model}, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(3, 20)
        d_model = rng.choice([6, 8, 10, 12, 16, 20, 24])
        expected = _round_nested(_pe_matrix_ref(seq_len, d_model))
        cases.append(
            Case("random", inputs={"seq_len": seq_len, "d_model": d_model}, expected=expected)
        )

    return cases


def _gen_attention_weights(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        ("boundary", [[1.0, 0.0]], [[1.0, 0.0]]),
        ("boundary", [[1.0, 0.0], [0.0, 1.0]], [[1.0, 0.0], [0.0, 1.0]]),
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
        expected = _round_nested(_attention_weights_ref(q, k))
        code = "import torch\n"
        code += _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_k in [(16, 12), (20, 16), (24, 12), (18, 20)]:
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        expected = _round_nested(_attention_weights_ref(q, k))
        code = "import torch\n"
        code += _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        cases.append(Case("stress", input_code=code, expected=expected))

    for _ in range(10):
        seq_len = rng.randint(2, 14)
        d_k = rng.randint(3, 12)
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        expected = _round_nested(_attention_weights_ref(q, k))
        code = "import torch\n"
        code += _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        cases.append(Case("random", input_code=code, expected=expected))

    return cases


def _gen_causal_attention(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    fixed = [
        ("boundary", [[1.0, 0.0]], [[1.0, 0.0]], [[0.5, 0.5]]),
        (
            "boundary",
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [0.0, 1.0]],
        ),
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
        expected = _round_nested(_causal_attention_ref(q, k, v))
        code = "import torch\n"
        code += _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        code += _torch_matrix_input_code("V", v)
        cases.append(Case(bucket, input_code=code, expected=expected))

    for seq_len, d_k, d_v in [(16, 12, 8), (20, 10, 6), (24, 12, 10), (18, 16, 12)]:
        q = _random_matrix(rng, seq_len, d_k)
        k = _random_matrix(rng, seq_len, d_k)
        v = _random_matrix(rng, seq_len, d_v)
        expected = _round_nested(_causal_attention_ref(q, k, v))
        code = "import torch\n"
        code += _torch_matrix_input_code("Q", q)
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
        expected = _round_nested(_causal_attention_ref(q, k, v))

        code = "import torch\n"
        code += _torch_matrix_input_code("Q", q)
        code += _torch_matrix_input_code("K", k)
        code += _torch_matrix_input_code("V", v)
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
}


def _render_json(data: dict[str, Any]) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def generate_hidden_tests(problem_id: str, seed_offset: int = 0) -> dict[str, Any]:
    generator = PROBLEM_GENERATORS[problem_id]
    base_seed = PROBLEM_SEEDS.get(problem_id, 0)
    rng = random.Random(base_seed + seed_offset)
    cases = generator(rng)
    _assert_case_count(problem_id, cases)
    return {"version": 1, "cases": _assign_ids(cases)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic hidden tests")
    parser.add_argument(
        "--problems-root",
        default="judge/problems",
        help="Path to judge problems root (default: judge/problems)",
    )
    parser.add_argument(
        "--only",
        default=None,
        help="Optional single problem id, e.g. build-gpt/03-embeddings/01-most-similar",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check mode: fail if committed hidden_tests.json differs from generated output",
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
        hidden_path = problems_root / problem_id / "hidden_tests.json"
        if not hidden_path.parent.exists():
            raise SystemExit(f"Problem directory not found: {hidden_path.parent}")

        generated = generate_hidden_tests(problem_id, seed_offset=args.seed_offset)
        rendered = _render_json(generated)

        existing = hidden_path.read_text() if hidden_path.exists() else None

        if args.check:
            checked += 1
            if existing != rendered:
                print(f"MISMATCH: {problem_id}")
                changed += 1
        else:
            if existing != rendered:
                hidden_path.write_text(rendered)
                changed += 1
                print(f"UPDATED: {problem_id}")
            else:
                print(f"UNCHANGED: {problem_id}")

    if args.check:
        if changed:
            raise SystemExit(f"{changed}/{checked} hidden_tests.json file(s) are out of date")
        print(f"OK: {checked} problem(s) match generated hidden tests")
    else:
        print(f"Done. Updated {changed} hidden_tests.json file(s)")


if __name__ == "__main__":
    main()
