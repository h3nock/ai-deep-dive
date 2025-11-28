---
id: "analogy-solver"
title: "The Analogy Solver"
difficulty: "Hard"
initialCode: |
  import math

  def solve_analogy(word_a: str, word_b: str, word_c: str, vocab: dict[str, list[float]]) -> str:
      # TODO: Calculate Target = A - B + C
      # Then find the word in vocab closest to Target (highest cosine similarity)
      # Exclude the input words (word_a, word_b, word_c) from the search
      pass
arguments:
  - name: word_a
    type: str
  - name: word_b
    type: str
  - name: word_c
    type: str
  - name: vocab
    type: dict[str, list[float]]
executionSnippet: |
  solve_analogy(word_a, word_b, word_c, vocab)
visibleTestCases: 2
---

This challenge proves that we can perform **algebra on meaning**.

We want to solve analogies like: _"Man is to King as Woman is to...?"_

Mathematically, this becomes:

$$Target = Vector(King) - Vector(Man) + Vector(Woman)$$

The answer is the word whose vector is closest to the Target.

**Your Task:**

1. Retrieve the vectors for `word_a`, `word_b`, and `word_c` from the vocab.
2. Compute the `Target` vector: $A - B + C$ (element-wise arithmetic).
3. Find the word in `vocab` with the **highest Cosine Similarity** to the Target.
4. Exclude the three input words from consideration.
5. Return the winning word.

_Hint: You'll need to implement (or reuse) cosine similarity logic._
