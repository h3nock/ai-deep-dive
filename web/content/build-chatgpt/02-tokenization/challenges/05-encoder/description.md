---
title: "The Encoder (Inference)"
difficulty: "Hard"
initialCode: |
  def encode(text: str, merges: dict[tuple[int, int], int]) -> list[int]:
      # TODO: Tokenize text using learned merge rules
      pass
arguments:
  - name: text
    type: str
  - name: merges
    type: dict[tuple[int, int], int]
executionSnippet: |
  encode(text, merges)
visibleTestCases: 1
---

The final boss! Given new text and a trained set of merge rules, tokenize the text by applying all the merges.

**Inputs:**

- `text`: The text to tokenize
- `merges`: The merge rules learned during training (from `train_bpe`)

**Output:** A list of token IDs representing the compressed text

**The Key Insight:**

During training, we learned merges in a specific order. To encode new text, we apply those same merges **in the same order**. Python dicts preserve insertion order, so iterate through `merges` and apply each one.

**Steps:**

1. Convert text to UTF-8 bytes (your starting token IDs)
2. For each `(pair, new_id)` in merges:
   - Run your `merge` function to replace all occurrences of `pair` with `new_id`
3. Return the final compressed list

**Hint:** You'll reuse your `merge` function from Challenge 2!
