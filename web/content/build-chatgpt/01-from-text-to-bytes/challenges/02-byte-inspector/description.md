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
---

Count the number of characters in a UTF-8 `byte_list` without decoding it. In UTF-8, bytes starting with `0...` or `11...` mark new characters, while `10...` bytes are continuations. Count the start bytes.
