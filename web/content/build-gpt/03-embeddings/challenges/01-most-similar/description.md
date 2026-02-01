---
title: "Most Similar Tokens"
difficulty: "Medium"
initialCode: |
  import math

  def most_similar(query_id: int, embedding_matrix: list[list[float]], k: int) -> list[int]:
      # TODO: Find the k most similar tokens to query_id
      pass
arguments:
  - name: query_id
    type: int
  - name: embedding_matrix
    type: list[list[float]]
  - name: k
    type: int
executionSnippet: |
  most_similar(query_id, embedding_matrix, k)
visibleTestCases: 2
problemId: "build-gpt/03-embeddings/01-most-similar"
---

You are given an `embedding_matrix` where row `i` is the embedding vector for token ID `i`, a `query_id`, and an integer `k`. Return the IDs of the `k` tokens most similar to the query token, using cosine similarity.

$$
\text{cosine similarity} = \frac{a \cdot b}{||a|| \cdot ||b||}
$$

If multiple tokens have the same similarity, prefer the smaller token ID. Exclude the `query_id` from results. If either vector has zero magnitude, treat cosine similarity as `0.0`.
