---
title: "Vector Analogy (A − B + C)"
difficulty: "Medium"
initialCode: |
  import math

  def solve_analogy(a_id: int, b_id: int, c_id: int, embedding_matrix: list[list[float]]) -> int:
      # TODO: Solve the analogy using vector arithmetic
      pass
arguments:
  - name: a_id
    type: int
  - name: b_id
    type: int
  - name: c_id
    type: int
  - name: embedding_matrix
    type: list[list[float]]
executionSnippet: |
  solve_analogy(a_id, b_id, c_id, embedding_matrix)
visibleTestCases: 2
problemId: "build-gpt/03-embeddings/02-vector-analogy"
---

You are given three token IDs (`a_id`, `b_id`, `c_id`) and an `embedding_matrix` where row `i` is the embedding vector for token ID `i`. Solve the analogy **"A is to B as C is to ?"** using vector arithmetic.

Compute the target vector as `A - B + C`, then return the token ID whose embedding is most similar to this target (using cosine similarity).

Exclude `a_id`, `b_id`, and `c_id` from the candidates. If multiple tokens have the same similarity, prefer the smaller token ID. If either vector has zero magnitude, treat cosine similarity as `0.0`.
