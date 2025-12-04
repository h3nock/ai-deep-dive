---
title: "The Encoder"
difficulty: "Easy"
initialCode: |
  def encode_string(text: str) -> list[int]:
      # TODO: Convert the text to utf-8 bytes and return as a list of integers
      pass
arguments:
  - name: text
    type: str
executionSnippet: |
  encode_string(text)
visibleTestCases: 2
---

Given a string `text`, your task is to implement a function that converts it into a sequence of bytes using the UTF-8 encoding scheme. The function should return a list of integers, where each integer represents a single byte.