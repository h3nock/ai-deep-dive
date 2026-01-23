---
title: "The Byte Inspector"
difficulty: "Medium"
initialCode: |
  def count_characters(byte_list: list[int]) -> int:
      count = 0
      # TODO: Iterate through bytes and count the start of new characters
      return count
arguments:
  - name: byte_list
    type: list[int]
executionSnippet: |
  count_characters(byte_list)
visibleTestCases: 2
---

Count the number of characters in a UTF-8 `byte_list` without decoding it.

In UTF-8, the first two bits of each byte tell you its role:
- `0xxxxxxx` or `11xxxxxx` → start of a character
- `10xxxxxx` → continuation of a previous character