import torch

def build_pe_matrix(seq_len: int, d_model: int) -> torch.Tensor:
    # TODO: Build the full positional encoding matrix (seq_len x d_model).
    # Row i is the encoding for position i.
    # Compute frequencies once, then reuse for all positions.
    pass
