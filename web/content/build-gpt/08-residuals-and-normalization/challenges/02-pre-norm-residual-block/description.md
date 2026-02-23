---
title: "Pre-Norm Residual Block"
difficulty: "Medium"
initialCode: |
  import torch

  def pre_norm_block(x: torch.Tensor, gamma: torch.Tensor, beta: torch.Tensor, W: torch.Tensor, b: torch.Tensor, eps: float) -> torch.Tensor:
      """
      Apply a Pre-Norm residual block: x + linear(LayerNorm(x)).

      Args:
          x:     Input tensor of shape (seq_len, d_model)
          gamma: LayerNorm scale parameter of shape (d_model,)
          beta:  LayerNorm shift parameter of shape (d_model,)
          W:     Linear sublayer weights of shape (d_model, d_model)
          b:     Linear sublayer bias of shape (d_model,)
          eps:   Small constant for numerical stability

      Returns:
          Output tensor of shape (seq_len, d_model)
      """
      pass
arguments:
  - name: x
    type: torch.Tensor
  - name: gamma
    type: torch.Tensor
  - name: beta
    type: torch.Tensor
  - name: W
    type: torch.Tensor
  - name: b
    type: torch.Tensor
  - name: eps
    type: float
executionSnippet: |
  pre_norm_block(x, gamma, beta, W, b, eps)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/08-residuals-and-normalization/02-pre-norm-residual-block"
---

Implement a Pre-Norm residual block, where normalization is applied before the sublayer:

$$\text{output} = x + \text{sublayer}(\text{LayerNorm}(x))$$

where $\text{sublayer}(z) = z \cdot W + b$

**1.** Apply layer normalization to $x$ using $\gamma$, $\beta$, and $\varepsilon$ (population variance)

**2.** Pass the normalized result through the linear sublayer

**3.** Add the sublayer output to the original $x$
