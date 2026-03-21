---
title: Transformer Block
difficulty: Hard
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
