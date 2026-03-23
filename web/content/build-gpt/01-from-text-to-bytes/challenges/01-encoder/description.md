---
title: "The Encoder"
difficulty: "Easy"
arguments:
  - name: text
    type: str
executionSnippet: |
  encode_string(text)
visibleTestCases: 2
problemId: "build-gpt/01-from-text-to-bytes/01-encoder"
---

Given a string `text`, implement a function that converts it into a sequence of bytes using the UTF-8 encoding scheme. Return a list of integers, where each integer represents a single byte.
