---
id: "matrix-construction"
title: "The Matrix Constructor"
difficulty: "Easy"
initialCode: |
  def create_embedding_matrix(vocab_size: int, embed_dim: int, concept_map: dict[int, list[float]]) -> list[list[float]]:
      # TODO: Initialize a matrix of zeros (vocab_size x embed_dim).
      # Overwrite specific rows based on the concept_map.
      pass
arguments:
  - name: vocab_size
    type: int
  - name: embed_dim
    type: int
  - name: concept_map
    type: dict[int, list[float]]
executionSnippet: |
  create_embedding_matrix(vocab_size, embed_dim, concept_map)
visibleTestCases: 2
---

Before we can use vectors, we have to build the storage system.

In a neural network, the **Embedding Layer** is not magic. It is simply a list of lists (a matrix).

- **Rows** represent specific words (indexed by Token ID).
- **Columns** represent the dimensions of meaning.

**Your Task:**

1. Create a matrix (list of lists) filled with `0.0` with shape `vocab_size` rows × `embed_dim` columns.
2. Update the specific rows using the `concept_map`. The keys are Token IDs, and the values are the vectors to insert.
3. Return the final matrix.
