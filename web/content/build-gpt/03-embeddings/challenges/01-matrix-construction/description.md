---
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

The embedding layer is just a lookup table. Implement a function that builds this table as a matrix of zeros, then populates specific rows using `concept_map`, which maps Token IDs (keys) to their pre-trained vectors (values).
