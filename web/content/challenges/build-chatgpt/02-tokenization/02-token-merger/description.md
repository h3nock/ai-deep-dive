---
id: "token-merger"
title: "The Token Merger"
difficulty: "Medium"
initialCode: |
  def merge(ids: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
      # TODO: Replace all occurrences of pair with new_id
      pass
arguments:
  - name: ids
    type: list[int]
  - name: pair
    type: tuple[int, int]
  - name: new_id
    type: int
executionSnippet: |
  merge(ids, pair, new_id)
visibleTestCases: 2
---

Once we've identified the most frequent pair, we need to merge it.

Given a list of token integers `ids`, a `pair` to find, and a `new_id` to replace it with, return a new list where every consecutive occurrence of the pair is replaced with `new_id`.

**Note:** When you replace a pair, both elements are consumed. Think carefully about how this affects overlapping patterns like `[1, 1, 1]` when merging `(1, 1)`.
