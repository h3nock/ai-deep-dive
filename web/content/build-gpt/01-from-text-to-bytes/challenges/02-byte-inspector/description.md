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

Count the number of characters in a UTF-8 `byte_list` without decoding it.

> **Remember:** A new character always starts with a byte that begins with `0` or `11`. Bytes starting with `10` are just continuations.

Your task is to iterate through the bytes and count how many "start bytes" you find.
