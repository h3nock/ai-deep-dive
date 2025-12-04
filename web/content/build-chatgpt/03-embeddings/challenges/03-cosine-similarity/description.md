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

In high-dimensional space, Euclidean distance (measuring with a ruler) can be misleading. Instead, we measure the **angle** between vectors.

**What the values mean:**

- **1.0**: Perfect match (vectors point the same direction)
- **0.0**: No relation (vectors are perpendicular, 90° angle)
- **-1.0**: Opposites (vectors point opposite directions, 180° angle)

**Your Task:**

Implement the Cosine Similarity formula:

$$Similarity = \frac{\sum(A_i \cdot B_i)}{\sqrt{\sum A_i^2} \times \sqrt{\sum B_i^2}}$$

_Hint: The numerator is the dot product. The denominator is the product of the magnitudes._
