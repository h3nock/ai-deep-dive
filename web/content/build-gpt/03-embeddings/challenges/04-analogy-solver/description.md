---
title: "The Analogy Solver"
difficulty: "Medium"
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

Solve analogies like _"Man is to King as Woman is to...?"_ using vector arithmetic:

$$Target = Vector(King) - Vector(Man) + Vector(Woman)$$

Compute `Target = word_a - word_b + word_c` (element-wise), then find the word in `vocab` with the highest cosine similarity to Target. Exclude the input words from consideration.

_Hint: You'll need to implement (or reuse) cosine similarity logic._
