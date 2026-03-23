import torch

def positional_encoding(pos: int, d_model: int) -> torch.Tensor:
    # TODO: Build the PE vector for a single position.
    # PE[2*i] = sin(pos * freq_i), PE[2*i+1] = cos(pos * freq_i)
    # where freq_i = 1 / (10000 ** (2*i / d_model))
    pass
