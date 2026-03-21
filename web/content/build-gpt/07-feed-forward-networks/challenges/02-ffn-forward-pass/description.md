---
title: "FFN Forward Pass"
difficulty: "Medium"
arguments:
  - name: x
    type: torch.Tensor
  - name: W1
    type: torch.Tensor
  - name: b1
    type: torch.Tensor
  - name: W2
    type: torch.Tensor
  - name: b2
    type: torch.Tensor
executionSnippet: |
  ffn(x, W1, b1, W2, b2)
visibleTestCases: 2
dependencies:
  - torch
problemId: "build-gpt/07-feed-forward-networks/02-ffn-forward-pass"
---

Implement the feed-forward network (FFN) that processes each token independently through three stages: expand, activate, contract.

$$\text{FFN}(x) = \text{GELU}(x \cdot W_1 + b_1) \cdot W_2 + b_2$$

**• Expand** from `d_model` to `d_ff` using $W_1$ and $b_1$

**• Activate** with GELU (tanh approximation):

$$\text{GELU}(x) = 0.5 \cdot x \cdot \left(1 + \tanh\left(\sqrt{\frac{2}{\pi}} \cdot (x + 0.044715 \cdot x^3)\right)\right)$$

**• Contract** from `d_ff` back to `d_model` using $W_2$ and $b_2$
