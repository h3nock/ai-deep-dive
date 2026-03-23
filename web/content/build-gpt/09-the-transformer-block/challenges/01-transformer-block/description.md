---
title: "Transformer Block"
difficulty: "Hard"
arguments:
  - name: x
    type: torch.Tensor
  - name: gamma1
    type: torch.Tensor
  - name: beta1
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
  - name: gamma2
    type: torch.Tensor
  - name: beta2
    type: torch.Tensor
  - name: W1
    type: torch.Tensor
  - name: b1
    type: torch.Tensor
  - name: W2
    type: torch.Tensor
  - name: b2
    type: torch.Tensor
executionSnippet: |
  transformer_block(x, gamma1, beta1, W_Q, W_K, W_V, W_O, num_heads, gamma2, beta2, W1, b1, W2, b2)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/09-the-transformer-block/01-transformer-block"
---

Implement the forward pass of a **pre-norm Transformer block** for a single sequence input `x` of shape `(seq_len, d_model)`:

$$x_1 = x + \text{MultiHeadCausalAttention}(\text{LayerNorm}_1(x))$$

$$x_2 = x_1 + \text{FFN}(\text{LayerNorm}_2(x_1))$$

$$\text{FFN}(z) = \text{GELU}(z \cdot W_1 + b_1) \cdot W_2 + b_2$$

Return `x_2`.

Assume:
- `d_model` is divisible by `num_heads`
- both LayerNorms use `eps = 1e-5`
- if you implement LayerNorm manually, use **population variance** (divide by `d`, not `d - 1`)
- the FFN uses the **GPT-2 tanh GELU** activation

You may use `torch.nn.functional.layer_norm` and `torch.nn.functional.gelu(..., approximate="tanh")`. Do not use `torch.nn.MultiheadAttention` or `torch.nn.functional.scaled_dot_product_attention`.
