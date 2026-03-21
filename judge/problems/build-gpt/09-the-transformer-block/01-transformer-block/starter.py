import math
import torch
import torch.nn.functional as F

def transformer_block(
    x: torch.Tensor,
    gamma1: torch.Tensor,
    beta1: torch.Tensor,
    W_Q: torch.Tensor,
    W_K: torch.Tensor,
    W_V: torch.Tensor,
    W_O: torch.Tensor,
    num_heads: int,
    gamma2: torch.Tensor,
    beta2: torch.Tensor,
    W1: torch.Tensor,
    b1: torch.Tensor,
    W2: torch.Tensor,
    b2: torch.Tensor,
) -> torch.Tensor:
    """
    Compose a pre-norm transformer block forward pass.

    Args:
        x: Input tensor of shape (seq_len, d_model)
        gamma1: First LayerNorm scale of shape (d_model,)
        beta1: First LayerNorm shift of shape (d_model,)
        W_Q: Query weight matrix of shape (d_model, d_model)
        W_K: Key weight matrix of shape (d_model, d_model)
        W_V: Value weight matrix of shape (d_model, d_model)
        W_O: Output projection matrix of shape (d_model, d_model)
        num_heads: Number of attention heads
        gamma2: Second LayerNorm scale of shape (d_model,)
        beta2: Second LayerNorm shift of shape (d_model,)
        W1: First FFN weight matrix of shape (d_model, d_ff)
        b1: First FFN bias of shape (d_ff,)
        W2: Second FFN weight matrix of shape (d_ff, d_model)
        b2: Second FFN bias of shape (d_model,)

    Returns:
        Output tensor of shape (seq_len, d_model)
    """
    pass
