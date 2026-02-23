---
title: "GELU Activation"
difficulty: "Easy"
initialCode: |
  import torch
  import math

  def gelu(x: torch.Tensor) -> torch.Tensor:
      """
      Apply the GELU activation function element-wise.

      Args:
          x: Input tensor of any shape

      Returns:
          Tensor of the same shape with GELU applied
      """
      pass
arguments:
  - name: x
    type: torch.Tensor
executionSnippet: |
  gelu(x)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/07-feed-forward-networks/01-gelu"
---

Implement the GELU activation function using GPT-2's tanh approximation:

$$\text{GELU}(x) = 0.5 \cdot x \cdot \left(1 + \tanh\left(\sqrt{\frac{2}{\pi}} \cdot (x + 0.044715 \cdot x^3)\right)\right)$$
