---
title: "The Pair Counter"
difficulty: "Easy"
initialCode: |
  def get_stats(ids: list[int]) -> dict[tuple[int, int], int]:
      # TODO: Count how often each consecutive pair appears
      pass
arguments:
  - name: ids
    type: list[int]
executionSnippet: |
  get_stats(ids)
visibleTestCases: 2
---

Given a list of integers `ids`, count how often each consecutive pair appears. Return a dictionary where each key is a tuple `(ids[i], ids[i+1])` and each value is the pair's count.
