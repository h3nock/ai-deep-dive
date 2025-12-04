---
title: "The Decoder"
difficulty: "Easy"
initialCode: |
  def decode(ids: list[int], vocab: dict[int, bytes]) -> str:
      # TODO: Convert token IDs back to text
      pass
arguments:
  - name: ids
    type: list[int]
  - name: vocab
    type: dict[int, bytes]
executionSnippet: |
  decode(ids, vocab)
visibleTestCases: 1
---

Convert a list of token `ids` back to readable text using the `vocab` table. Look up each ID to get its byte sequence, concatenate all the bytes together, then decode as UTF-8.

_Hint: Use `b"".join(...)` to concatenate bytes, and `.decode("utf-8")` to convert to string._
