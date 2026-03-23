---
title: Layer Normalization
difficulty: Medium
---

Implement layer normalization. Given a matrix of shape `(seq_len, d_model)`, normalize each token's vector independently:

$$\text{LayerNorm}(x) = \gamma \odot \frac{x - \mu}{\sqrt{\sigma^2 + \varepsilon}} + \beta$$

**1.** Compute the mean $\mu$ of the vector

**2.** Compute the variance $\sigma^2$ of the vector (population variance: divide by $d$, not $d - 1$)

**3.** Normalize: $\hat{x} = \frac{x - \mu}{\sqrt{\sigma^2 + \varepsilon}}$

**4.** Scale and shift: $\gamma \odot \hat{x} + \beta$ &ensp;($\odot$ = element-wise multiply)
