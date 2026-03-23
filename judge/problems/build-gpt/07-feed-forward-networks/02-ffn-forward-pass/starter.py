import torch
import math

def ffn(x: torch.Tensor, W1: torch.Tensor, b1: torch.Tensor, W2: torch.Tensor, b2: torch.Tensor) -> torch.Tensor:
    """
    Compute the feed-forward network forward pass with GELU activation.

    Args:
        x:  Input tensor of shape (seq_len, d_model)
        W1: First projection weights of shape (d_model, d_ff)
        b1: First projection bias of shape (d_ff,)
        W2: Second projection weights of shape (d_ff, d_model)
        b2: Second projection bias of shape (d_model,)

    Returns:
        Output tensor of shape (seq_len, d_model)
    """
    pass
