---
id: "byte-inspector"
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

You are given a list of integers `byte_list`, which represents a sequence of bytes encoded in UTF-8. Your task is to implement a function that determines the number of characters in this sequence **without decoding the entire byte list into a string**.

To do this, you'll need to inspect the binary representation of each byte. In UTF-8:
- A byte that starts with `0...` or `11...` marks the beginning of a new character.
- A byte that starts with `10...` is a "continuation byte" and is part of the previous character.

Your function should count and return the total number of start bytes.
