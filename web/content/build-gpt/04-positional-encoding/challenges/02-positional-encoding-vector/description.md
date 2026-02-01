---
title: "The Position Vector"
difficulty: "Medium"
initialCode: |
  import math

  def positional_encoding(pos: int, d_model: int) -> list[float]:
      # TODO: Build the PE vector for a single position.
      # PE[2*i] = sin(pos * freq_i), PE[2*i+1] = cos(pos * freq_i)
      # where freq_i = 1 / (10000 ** (2*i / d_model))
      pass
arguments:
  - name: pos
    type: int
  - name: d_model
    type: int
executionSnippet: |
  positional_encoding(pos, d_model)
visibleTestCases: 2
problemId: "build-gpt/04-positional-encoding/02-positional-encoding-vector"
---

Build the positional encoding vector of length `d_model` for a single position.

For each `i` in `0, 1, ..., d_model//2 - 1`:
- Compute `freq_i = 1 / (10000 ** (2*i / d_model))`
- Set `PE[2*i] = sin(pos * freq_i)`
- Set `PE[2*i + 1] = cos(pos * freq_i)`
