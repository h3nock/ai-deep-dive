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

Time to go backward! Given a list of token IDs and a vocabulary table, convert them back to readable text.

**Inputs:**

- `ids`: A list of token IDs to decode
- `vocab`: A dictionary mapping each token ID to its byte sequence

**Output:** The decoded string

**Steps:**

1. Look up each ID in the vocab to get its bytes
2. Concatenate all the bytes together
3. Decode the bytes as UTF-8

**Hint:** Use `b"".join(...)` to concatenate bytes, and `.decode("utf-8")` to convert to string.
