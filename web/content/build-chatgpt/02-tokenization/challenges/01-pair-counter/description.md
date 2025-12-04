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

The first step of BPE is finding which pairs of tokens appear most frequently.

Given a list of integers `ids`, return a dictionary where each key is a tuple of two adjacent elements `(ids[i], ids[i+1])`, and each value is how many times that pair appears in the list.
