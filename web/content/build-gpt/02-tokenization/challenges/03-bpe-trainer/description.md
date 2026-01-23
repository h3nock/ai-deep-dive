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
---

Train a BPE tokenizer on `text` by performing `num_merges` merge operations. Start with UTF-8 bytes (0-255) as your base vocabulary. Repeatedly find the most frequent adjacent pair, merge it into a new token (starting at 256), and update the sequence.

Return a tuple: the final compressed token IDs, and a dictionary mapping each merged pair to its new token ID.

_Hint: If there are ties, `max()` will pick one. Our test cases avoid ties._
