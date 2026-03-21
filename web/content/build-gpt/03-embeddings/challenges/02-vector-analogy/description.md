---
title: Vector Analogy (A − B + C)
difficulty: Medium
---

You are given three token IDs (`a_id`, `b_id`, `c_id`) and an `embedding_matrix` where row `i` is the embedding vector for token ID `i`. Solve the analogy **"A is to B as C is to ?"** using vector arithmetic.

Compute the target vector as `A - B + C`, then return the token ID whose embedding is most similar to this target (using cosine similarity).

Exclude `a_id`, `b_id`, and `c_id` from the candidates. If multiple tokens have the same similarity, prefer the smaller token ID. If either vector has zero magnitude, treat cosine similarity as `0.0`.
