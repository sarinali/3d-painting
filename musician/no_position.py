"""Notebook autoencoder ablation: RGB only, without x/y position channels."""
import argparse
from experiment_utils import add_arguments, image_paths, load_image, export_sound


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_arguments(parser, 'no-position')
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--seed', type=int, default=0)
    args = parser.parse_args()
    if args.epochs < 1 or args.limit < 1:
        parser.error('--epochs and --limit must be positive')
    import numpy as np
    import torch
    from torch import nn
    from torch.nn import functional as F
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    torch.manual_seed(args.seed)
    paths = image_paths(args.data)
    x = torch.from_numpy(np.stack([load_image(p) for p in paths])).permute(0, 3, 1, 2)
    # Identical to the notebook except the encoder takes 3 channels, not 5.
    encoder = nn.Sequential(
        nn.Conv2d(3, 16, 3, stride=2, padding=1), nn.ReLU(),
        nn.Conv2d(16, 16, 3, stride=2, padding=1), nn.ReLU(),
        nn.Conv2d(16, 1, 3, padding=1), nn.Sigmoid(),
    )
    decoder = nn.Sequential(
        nn.Upsample(scale_factor=2, mode='nearest'),
        nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(),
        nn.Upsample(scale_factor=2, mode='nearest'),
        nn.Conv2d(16, 3, 3, padding=1), nn.Sigmoid(),
    )
    optimizer = torch.optim.Adam(list(encoder.parameters()) + list(decoder.parameters()), lr=1e-3)
    losses = []
    print(f'Training on {len(paths)} paintings, CPU, seed {args.seed}.', flush=True)
    for epoch in range(args.epochs):
        total = 0.0
        for indices in torch.randperm(len(x)).split(8):
            batch = x[indices]
            reconstructed = decoder(encoder(batch))
            edges = sum(F.l1_loss(torch.diff(reconstructed, dim=d), torch.diff(batch, dim=d))
                        for d in (2, 3))
            loss = F.l1_loss(reconstructed, batch) + 0.5 * edges
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += loss.item() * len(batch)
        losses.append(total / len(x))
        if (epoch + 1) % 10 == 0 or epoch == 0 or epoch + 1 == args.epochs:
            print(f'Epoch {epoch + 1}/{args.epochs}: {losses[-1]:.4f}', flush=True)

    args.output.mkdir(parents=True, exist_ok=True)
    torch.save({'encoder': encoder.state_dict(), 'decoder': decoder.state_dict(),
                'args': {k: str(v) if hasattr(v, '__fspath__') else v for k, v in vars(args).items()},
                'training_paths': [str(p) for p in paths]}, args.output / 'model.pt')
    np.save(args.output / 'losses.npy', np.array(losses))
    encoder.eval()
    decoder.eval()
    for index, path in enumerate(paths[:args.limit]):
        with torch.no_grad():
            notes = encoder(x[index:index + 1])
            reconstructed = decoder(notes)[0].permute(1, 2, 0).numpy()
        grid = notes[0, 0].numpy()
        stem = args.output / f'{index:03d}-{path.stem}'
        np.save(stem.with_suffix('.npy'), grid)
        export_sound(grid, stem.with_suffix('.wav'), args.scale, args.root, args.threshold)
        fig, axes = plt.subplots(1, 3, figsize=(10, 3))
        axes[0].imshow(x[index].permute(1, 2, 0).numpy())
        axes[0].set_title(path.name)
        axes[1].imshow(reconstructed)
        axes[1].set_title('Reconstruction · no position')
        axes[2].imshow(grid, origin='lower', vmin=0, vmax=1, aspect='auto')
        axes[2].set_title('Notes · no position')
        fig.tight_layout()
        fig.savefig(stem.with_suffix('.png'))
        plt.close(fig)
        print(f'Exported {stem.with_suffix(".wav")}')


if __name__ == '__main__':
    main()
