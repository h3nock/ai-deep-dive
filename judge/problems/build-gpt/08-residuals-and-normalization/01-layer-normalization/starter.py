import torch

def layer_norm(x: torch.Tensor, gamma: torch.Tensor, beta: torch.Tensor, eps: float) -> torch.Tensor:
    """
    Apply layer normalization over the last dimension.

    Args:
        x:     Input tensor of shape (seq_len, d_model)
        gamma: Learned scale parameter of shape (d_model,)
        beta:  Learned shift parameter of shape (d_model,)
        eps:   Small constant for numerical stability

    Returns:
        Normalized tensor of shape (seq_len, d_model)
    """
    pass
