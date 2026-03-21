import torch

def pre_norm_block(x: torch.Tensor, gamma: torch.Tensor, beta: torch.Tensor, W: torch.Tensor, b: torch.Tensor, eps: float) -> torch.Tensor:
    """
    Apply a Pre-Norm residual block: x + linear(LayerNorm(x)).

    Args:
        x:     Input tensor of shape (seq_len, d_model)
        gamma: LayerNorm scale parameter of shape (d_model,)
        beta:  LayerNorm shift parameter of shape (d_model,)
        W:     Linear sublayer weights of shape (d_model, d_model)
        b:     Linear sublayer bias of shape (d_model,)
        eps:   Small constant for numerical stability

    Returns:
        Output tensor of shape (seq_len, d_model)
    """
    pass
