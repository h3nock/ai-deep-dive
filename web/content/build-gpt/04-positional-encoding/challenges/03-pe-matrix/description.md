---
title: The PE Matrix
difficulty: Easy
---

Build a matrix of shape `(seq_len, d_model)` where row `i` contains the positional encoding for position `i`.

Use the same formula from the previous challenge:
- `freq_i = 1 / (10000 ** (2*i / d_model))`
- `PE[2*i] = sin(pos * freq_i)`, `PE[2*i + 1] = cos(pos * freq_i)`

Compute the frequencies once, then apply them to each position `0, 1, ..., seq_len - 1`.
