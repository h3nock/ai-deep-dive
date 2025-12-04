---
title: "Injecting Position"
difficulty: "Easy"
initialCode: |
  def add_positional_encoding(token_vecs: list[list[float]], pos_vecs: list[list[float]]) -> list[list[float]]:
      # TODO: Element-wise addition of token_vecs[i] and pos_vecs[i]
      pass
arguments:
  - name: token_vecs
    type: list[list[float]]
  - name: pos_vecs
    type: list[list[float]]
executionSnippet: |
  add_positional_encoding(token_vecs, pos_vecs)
visibleTestCases: 2
---

Add positional information to token vectors. Given `token_vecs` and `pos_vecs` of the same length, return a new list where each vector is the element-wise sum of the corresponding token and position vectors.
