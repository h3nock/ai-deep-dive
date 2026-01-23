---
title: "The PE Matrix"
difficulty: "Easy"
initialCode: |
  import math

  def build_pe_matrix(seq_len: int, d_model: int) -> list[list[float]]:
      # TODO: Build the full positional encoding matrix (seq_len x d_model).
      # Row i is the encoding for position i.
      # Compute frequencies once, then reuse for all positions.
      pass
arguments:
  - name: seq_len
    type: int
  - name: d_model
    type: int
executionSnippet: |
  build_pe_matrix(seq_len, d_model)
visibleTestCases: 2
---

Build a matrix of shape `(seq_len, d_model)` where row `i` contains the positional encoding for position `i`.

Use the same formula from the previous challenge:
- `freq_i = 1 / (10000 ** (2*i / d_model))`
- `PE[2*i] = sin(pos * freq_i)`, `PE[2*i + 1] = cos(pos * freq_i)`

Compute the frequencies once, then apply them to each position `0, 1, ..., seq_len - 1`.
