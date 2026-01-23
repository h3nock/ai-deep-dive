---
title: "The Decoder"
difficulty: "Medium"
initialCode: |
  def decode(ids: list[int], merges: dict[tuple[int, int], int]) -> str:
      # TODO: Use the merges to decode the ids back to text
      pass
arguments:
  - name: ids
    type: list[int]
  - name: merges
    type: dict[tuple[int, int], int]
executionSnippet: |
  decode(ids, merges)
visibleTestCases: 1
---

You are given a list of token `ids` and a dictionary of `merges` trained by a BPE tokenizer. Convert the token IDs back to the original text string.

The `merges` dictionary maps pairs of tokens to their new merged token ID (e.g. `(104, 105) -> 256`). You'll need to use this information to determine what text each token ID represents.

**Hint:** Base tokens 0-255 correspond directly to their UTF-8 byte values.