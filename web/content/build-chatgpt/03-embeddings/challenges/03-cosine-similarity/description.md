---
title: "Cosine Similarity"
difficulty: "Medium"
initialCode: |
  import math

  def cosine_similarity(v1: list[float], v2: list[float]) -> float:
      # TODO: Calculate (v1 · v2) / (||v1|| * ||v2||)
      # Return 0.0 if either vector has zero magnitude
      pass
arguments:
  - name: v1
    type: list[float]
  - name: v2
    type: list[float]
executionSnippet: |
  cosine_similarity(v1, v2)
visibleTestCases: 2
---

Implement the Cosine Similarity formula to measure how similar two vectors are:

$$Similarity = \frac{\sum(A_i \cdot B_i)}{\sqrt{\sum A_i^2} \times \sqrt{\sum B_i^2}}$$

Returns a value between -1 and 1, where 1 means identical and 0 means unrelated.

_Hint: The numerator is the dot product. The denominator is the product of the magnitudes._
