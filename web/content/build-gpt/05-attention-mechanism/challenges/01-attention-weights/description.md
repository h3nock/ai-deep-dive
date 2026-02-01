---
title: "Attention Weights"
difficulty: "Easy"
initialCode: |
  import math

  def attention_weights(Q: list[list[float]], K: list[list[float]]) -> list[list[float]]:
      """
      Compute attention weights from Query and Key matrices.
      
      Args:
          Q: Query matrix of shape (seq_len, d_k)
          K: Key matrix of shape (seq_len, d_k)
      
      Returns:
          Attention weights of shape (seq_len, seq_len)
      """
      pass
arguments:
  - name: Q
    type: "list[list[float]]"
  - name: K
    type: "list[list[float]]"
executionSnippet: |
  attention_weights(Q, K)
visibleTestCases: 2
problemId: "build-gpt/05-attention-mechanism/01-attention-weights"
---

Given Q and K matrices of shape `(seq_len, d_k)`, return the attention weight matrix of shape `(seq_len, seq_len)`.

Each entry `weights[i][j]` represents how much position `i` attends to position `j`.

$$\text{weights} = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)$$
