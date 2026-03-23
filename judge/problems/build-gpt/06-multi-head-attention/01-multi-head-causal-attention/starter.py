import torch

def multi_head_causal_attention(
    X: torch.Tensor,
    W_Q: torch.Tensor,
    W_K: torch.Tensor,
    W_V: torch.Tensor,
    W_O: torch.Tensor,
    num_heads: int,
) -> torch.Tensor:
    """
    Compute multi-head causal self-attention.

    Args:
        X: Input tensor of shape (seq_len, d_model)
        W_Q: Query weight matrix of shape (d_model, d_model)
        W_K: Key weight matrix of shape (d_model, d_model)
        W_V: Value weight matrix of shape (d_model, d_model)
        W_O: Output projection matrix of shape (d_model, d_model)
        num_heads: Number of attention heads

    Returns:
        Output tensor of shape (seq_len, d_model)
    """
    pass
