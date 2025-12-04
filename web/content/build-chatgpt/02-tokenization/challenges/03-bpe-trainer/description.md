---
title: "The BPE Trainer"
difficulty: "Hard"
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

Now put it all together! Implement a function that trains a BPE tokenizer from scratch.

**Inputs:**

- `text`: The training text
- `num_merges`: How many merge operations to perform

**Output:** A tuple containing:

1. `final_ids`: The compressed list of token IDs after all merges
2. `merges`: A dictionary mapping each merged pair to its new token ID

Remember: UTF-8 bytes (0-255) form your base vocabulary, so new merged tokens should start at 256.

**Note:** If there are ties (multiple pairs with the same count), `max()` will pick one. Our test cases avoid ties.
