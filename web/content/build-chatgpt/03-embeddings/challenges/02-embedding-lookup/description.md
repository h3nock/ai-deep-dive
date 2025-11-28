---
id: "embedding-lookup"
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

The neural network cannot understand integers like `105` or `992`. It needs the vectors we stored in the matrix.

This step is the **Forward Pass** of the embedding layer. It swaps discrete integers for continuous vectors.

**Your Task:**

Given a list of integers (`token_ids`) and the `embedding_matrix` (where row `i` is the vector for Token ID `i`), return a new list containing the vectors for each requested token.

Think of it like looking up words in a dictionary. Each Token ID is an index into the matrix.
