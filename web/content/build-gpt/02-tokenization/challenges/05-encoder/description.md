---
title: "The Encoder (Inference)"
difficulty: "Medium"
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
problemId: "build-gpt/02-tokenization/05-encoder"
---

Given a string `text` and a trained BPE `merges` dictionary, return the list of token IDs representing the encoded text.

The `merges` dictionary is ordered by when the rules were learned during training, meaning they should be applied sequentially from first to last.