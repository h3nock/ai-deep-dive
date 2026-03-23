---
title: Attention Weights
difficulty: Easy
---

Given Q and K matrices of shape `(seq_len, d_k)`, return the attention weight matrix of shape `(seq_len, seq_len)`.

Each entry `weights[i][j]` represents how much position `i` attends to position `j`.

$$\text{weights} = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)$$
