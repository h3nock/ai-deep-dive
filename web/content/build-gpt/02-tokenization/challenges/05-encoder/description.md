---
title: "The Encoder (Inference)"
difficulty: "Hard"
initialCode: |
  def encode(text: str, merges: dict[tuple[int, int], int]) -> list[int]:
      # TODO: Tokenize text using learned merge rules
      pass
arguments:
  - name: text
    type: str
  - name: merges
    type: dict[tuple[int, int], int]
executionSnippet: |
  encode(text, merges)
visibleTestCases: 1
---

Tokenize `text` using trained merge rules. Convert the text to UTF-8 bytes first, then apply each merge from `merges` in order (Python dicts preserve insertion order). Each merge replaces all occurrences of a pair with its new token ID.

_Hint: Reuse your `merge` function from Challenge 2!_
