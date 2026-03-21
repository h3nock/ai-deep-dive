---
title: Most Similar Tokens
difficulty: Medium
---

You are given an `embedding_matrix` where row `i` is the embedding vector for token ID `i`, a `query_id`, and an integer `k`. Return the IDs of the `k` tokens most similar to the query token, using cosine similarity.

$$
\text{cosine similarity} = \frac{a \cdot b}{||a|| \cdot ||b||}
$$

If multiple tokens have the same similarity, prefer the smaller token ID. Exclude the `query_id` from results. If either vector has zero magnitude, treat cosine similarity as `0.0`.
