---
title: The Position Vector
difficulty: Medium
---

Build the positional encoding vector of length `d_model` for a single position.

For each `i` in `0, 1, ..., d_model//2 - 1`:
- Compute `freq_i = 1 / (10000 ** (2*i / d_model))`
- Set `PE[2*i] = sin(pos * freq_i)`
- Set `PE[2*i + 1] = cos(pos * freq_i)`
