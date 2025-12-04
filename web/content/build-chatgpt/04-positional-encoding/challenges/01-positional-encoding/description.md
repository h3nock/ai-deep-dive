---
title: "Injecting Position"
difficulty: "Easy"
initialCode: |
  def add_positional_encoding(token_vecs: list[list[float]], pos_vecs: list[list[float]]) -> list[list[float]]:
      # TODO: Element-wise addition of token_vecs[i] and pos_vecs[i]
      pass
arguments:
  - name: token_vecs
    type: list[list[float]]
  - name: pos_vecs
    type: list[list[float]]
executionSnippet: |
  add_positional_encoding(token_vecs, pos_vecs)
visibleTestCases: 2
---

Vectors capture meaning, but they lose order.

Consider: _"The man bit the dog"_ vs _"The dog bit the man"_. If you just add up the word vectors, both sentences look identical! The model has no idea who did the biting.

We fix this by **adding** a position vector to each token vector:

$$Final = TokenVector + PositionVector$$

**Your Task:**

Given a list of content vectors (`token_vecs`) and a list of position vectors (`pos_vecs`) of the same length, return a new list where each element is the **element-wise sum** of the corresponding vectors.

_Note: We use addition, not concatenation, to keep the vector size efficient. The model learns to "unmix" the information._
