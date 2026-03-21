---
title: "Multi-Head Causal Attention"
difficulty: "Medium"
arguments:
  - name: X
    type: torch.Tensor
  - name: W_Q
    type: torch.Tensor
  - name: W_K
    type: torch.Tensor
  - name: W_V
    type: torch.Tensor
  - name: W_O
    type: torch.Tensor
  - name: num_heads
    type: int
executionSnippet: |
  multi_head_causal_attention(X, W_Q, W_K, W_V, W_O, num_heads)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/06-multi-head-attention/01-multi-head-causal-attention"
---

Given an input matrix `X` of shape `(seq_len, d_model)`, weight matrices `W_Q`, `W_K`, `W_V`, `W_O` (each of shape `(d_model, d_model)`), and a number of heads, compute the full multi-head causal self-attention output.

Assume:
- `d_model` is divisible by `num_heads`

**Steps:**

**• Project** the input into queries, keys, and values using the full weight matrices:

$$Q = X \times W_Q, \quad K = X \times W_K, \quad V = X \times W_V$$

**• Split** each of `Q`, `K`, `V` into `num_heads` heads by:

reshaping to `(seq_len, num_heads, d_head)`, then transposing to `(num_heads, seq_len, d_head)`.

where `d_head = d_model / num_heads`.

**• Compute causal attention** independently for each head:

$$\text{head}_i = \text{softmax}\left(\frac{Q_i K_i^T}{\sqrt{d_\text{head}}} + M\right) \cdot V_i$$

where $M$ is the causal mask (applied per head on score matrices of shape `(seq_len, seq_len)`): $M_{ij} = 0$ if $j \leq i$, else $-\infty$.

**• Concatenate** all head outputs and apply the output projection:

$$\text{output} = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) \times W_O$$
