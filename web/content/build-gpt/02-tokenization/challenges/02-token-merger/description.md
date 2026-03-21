---
title: "The Token Merger"
difficulty: "Medium"
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
problemId: "build-gpt/02-tokenization/02-token-merger"
---

You are given a list of integers `ids` and a tuple `pair`. Replace every occurrence of the consecutive sequence `(pair[0], pair[1])` with a single integer `new_id`.

Once two elements are merged, they cannot be part of another match.
