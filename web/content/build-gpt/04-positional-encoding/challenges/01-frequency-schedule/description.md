---
title: "The Frequency Schedule"
difficulty: "Easy"
initialCode: |
  import torch

  def get_frequencies(d_model: int) -> torch.Tensor:
      # TODO: Return d_model/2 frequencies using: freq[i] = 1 / (10000 ** (2*i / d_model))
      pass
arguments:
  - name: d_model
    type: int
executionSnippet: |
  get_frequencies(d_model)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/04-positional-encoding/01-frequency-schedule"
---

Sinusoidal PE uses `d_model // 2` frequencies that decrease geometrically from 1 down to 1/10000.

Compute each frequency as: `freq[i] = 1 / (10000 ** (2*i / d_model))` for `i` in `0, 1, ..., d_model//2 - 1`.
