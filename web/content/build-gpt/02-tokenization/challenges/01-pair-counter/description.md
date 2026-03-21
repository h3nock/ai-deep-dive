---
title: "The Pair Counter"
difficulty: "Easy"
arguments:
  - name: ids
    type: list[int]
executionSnippet: |
  get_stats(ids)
visibleTestCases: 2
problemId: "build-gpt/02-tokenization/01-pair-counter"
---

Given a list of integers `ids`, count how often each consecutive pair appears. Return a dictionary where each key is a tuple `(ids[i], ids[i+1])` and each value is the pair's count.
