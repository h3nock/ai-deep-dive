---
title: Pre-Norm Residual Block
difficulty: Medium
---

Implement a Pre-Norm residual block, where normalization is applied before the sublayer:

$$\text{output} = x + \text{sublayer}(\text{LayerNorm}(x))$$

where $\text{sublayer}(z) = z \cdot W + b$

**1.** Apply layer normalization to $x$ using $\gamma$, $\beta$, and $\varepsilon$ (population variance)

**2.** Pass the normalized result through the linear sublayer

**3.** Add the sublayer output to the original $x$
