---
title: The Encoder (Inference)
difficulty: Medium
---

Given a string `text` and a trained BPE `merges` dictionary, return the list of token IDs representing the encoded text.

The `merges` dictionary is ordered by when the rules were learned during training, meaning they should be applied sequentially from first to last.
