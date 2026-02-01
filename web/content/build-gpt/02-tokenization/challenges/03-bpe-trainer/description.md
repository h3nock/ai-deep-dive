---
title: "The BPE Trainer"
difficulty: "Medium"
initialCode: |
  def train_bpe(text: str, num_merges: int) -> tuple[list[int], dict[tuple[int, int], int]]:
      # TODO: Train a BPE tokenizer
      pass
arguments:
  - name: text
    type: str
  - name: num_merges
    type: int
executionSnippet: |
  train_bpe(text, num_merges)
visibleTestCases: 1
problemId: "build-gpt/02-tokenization/03-bpe-trainer"
---

You are given a string `text` and an integer `num_merges`. Train a BPE tokenizer by repeatedly merging the most frequent adjacent pair of tokens `num_merges` times.

Return a tuple of the tokenized text (after all merges) and a dictionary mapping each merged pair to its new token ID.

If multiple pairs have the same frequency, pick the smallest pair.

**Hint:** Start with UTF-8 bytes (0-255) as your base vocabulary. New token IDs start at 256.
