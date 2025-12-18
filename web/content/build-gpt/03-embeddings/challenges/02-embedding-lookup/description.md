---
title: "The Embedding Lookup"
difficulty: "Easy"
initialCode: |
  def get_embeddings(token_ids: list[int], embedding_matrix: list[list[float]]) -> list[list[float]]:
      # TODO: Return the list of vectors corresponding to the token_ids
      pass
arguments:
  - name: token_ids
    type: list[int]
  - name: embedding_matrix
    type: list[list[float]]
executionSnippet: |
  get_embeddings(token_ids, embedding_matrix)
visibleTestCases: 2
---

Given a list of integers (`token_ids`) and the `embedding_matrix` (where row `i` is the vector for Token ID `i`), return a new list containing the vectors for each requested token.

Each Token ID is an index into the matrix - look up the corresponding row.
