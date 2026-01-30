---
title: "Causal Attention"
difficulty: "Medium"
initialCode: |
  import math

  def causal_attention(Q: list[list[float]], K: list[list[float]], V: list[list[float]]) -> list[list[float]]:
      """
      Compute causal (masked) attention output.
      
      Args:
          Q: Query matrix of shape (seq_len, d_k)
          K: Key matrix of shape (seq_len, d_k)
          V: Value matrix of shape (seq_len, d_v)
      
      Returns:
          Output matrix of shape (seq_len, d_v)
      """
      pass
arguments:
  - name: Q
    type: "list[list[float]]"
  - name: K
    type: "list[list[float]]"
  - name: V
    type: "list[list[float]]"
executionSnippet: |
  causal_attention(Q, K, V)
visibleTestCases: 2
judgeId: "build-gpt/05-attention-mechanism/02-causal-attention"
---

Given Q, K, and V matrices, compute the attention output where each position can only attend to itself and earlier positions.

$$\text{output} = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}} + M\right) \cdot V$$

where $M$ is the causal mask: $M_{ij} = 0$ if $j \leq i$, else $-\infty$.
