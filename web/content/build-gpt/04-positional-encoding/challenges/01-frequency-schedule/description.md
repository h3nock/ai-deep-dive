---
title: The Frequency Schedule
difficulty: Easy
---

Sinusoidal PE uses `d_model // 2` frequencies that decrease geometrically from 1 down to 1/10000.

Compute each frequency as: `freq[i] = 1 / (10000 ** (2*i / d_model))` for `i` in `0, 1, ..., d_model//2 - 1`.
