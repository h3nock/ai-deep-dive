---
title: Causal Attention
difficulty: Medium
---

Given Q, K, and V matrices, compute the attention output where each position can only attend to itself and earlier positions.

$$\text{output} = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}} + M\right) \cdot V$$

where $M$ is the causal mask: $M_{ij} = 0$ if $j \leq i$, else $-\infty$.
