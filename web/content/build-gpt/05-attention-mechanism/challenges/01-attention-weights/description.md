---
title: "Attention Weights"
difficulty: "Easy"
initialCode: |
  import torch

  def attention_weights(Q: torch.Tensor, K: torch.Tensor) -> torch.Tensor:
      """
      Compute attention weights from Query and Key matrices.
      
      Args:
          Q: Query tensor of shape (seq_len, d_k)
          K: Key tensor of shape (seq_len, d_k)
      
      Returns:
          Attention weights tensor of shape (seq_len, seq_len)
      """
      pass
arguments:
  - name: Q
    type: torch.Tensor
  - name: K
    type: torch.Tensor
executionSnippet: |
  attention_weights(Q, K)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/05-attention-mechanism/01-attention-weights"
---

Given Q and K matrices of shape `(seq_len, d_k)`, return the attention weight matrix of shape `(seq_len, seq_len)`.

Each entry `weights[i][j]` represents how much position `i` attends to position `j`.

$$\text{weights} = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)$$
