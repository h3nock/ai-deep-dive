import torch

def attention_weights(Q: torch.Tensor, K: torch.Tensor) -> torch.Tensor:
    """
    Compute attention weights from Query and Key matrices.
    
    Args:
        Q: Query tensor of shape (seq_len, d_k)
        K: Key tensor of shape (seq_len, d_k)
    
    Returns:
        Attention weights tensor of shape (seq_len, seq_len)
    """
    pass
