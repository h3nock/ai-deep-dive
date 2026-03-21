---
title: "Causal Attention"
difficulty: "Medium"
arguments:
  - name: Q
    type: torch.Tensor
  - name: K
    type: torch.Tensor
  - name: V
    type: torch.Tensor
executionSnippet: |
  causal_attention(Q, K, V)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/05-attention-mechanism/02-causal-attention"
---

Given Q, K, and V matrices, compute the attention output where each position can only attend to itself and earlier positions.

$$\text{output} = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}} + M\right) \cdot V$$

where $M$ is the causal mask: $M_{ij} = 0$ if $j \leq i$, else $-\infty$.
