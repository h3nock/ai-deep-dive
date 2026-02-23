---
title: "Layer Normalization"
difficulty: "Medium"
initialCode: |
  import torch

  def layer_norm(x: torch.Tensor, gamma: torch.Tensor, beta: torch.Tensor, eps: float) -> torch.Tensor:
      """
      Apply layer normalization over the last dimension.

      Args:
          x:     Input tensor of shape (seq_len, d_model)
          gamma: Learned scale parameter of shape (d_model,)
          beta:  Learned shift parameter of shape (d_model,)
          eps:   Small constant for numerical stability

      Returns:
          Normalized tensor of shape (seq_len, d_model)
      """
      pass
arguments:
  - name: x
    type: torch.Tensor
  - name: gamma
    type: torch.Tensor
  - name: beta
    type: torch.Tensor
  - name: eps
    type: float
executionSnippet: |
  layer_norm(x, gamma, beta, eps)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/08-residuals-and-normalization/01-layer-normalization"
---

Implement layer normalization. Given a matrix of shape `(seq_len, d_model)`, normalize each token's vector independently:

$$\text{LayerNorm}(x) = \gamma \odot \frac{x - \mu}{\sqrt{\sigma^2 + \varepsilon}} + \beta$$

**1.** Compute the mean $\mu$ of the vector

**2.** Compute the variance $\sigma^2$ of the vector (population variance: divide by $d$, not $d - 1$)

**3.** Normalize: $\hat{x} = \frac{x - \mu}{\sqrt{\sigma^2 + \varepsilon}}$

**4.** Scale and shift: $\gamma \odot \hat{x} + \beta$ &ensp;($\odot$ = element-wise multiply)
