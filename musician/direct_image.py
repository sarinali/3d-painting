"""No ML: image luminance directly controls note amplitudes."""
import argparse
from experiment_utils import add_arguments, image_paths, load_image, export_sound


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_arguments(parser, 'direct-image')
    args = parser.parse_args()
    if args.limit < 1:
        parser.error('--limit must be positive')
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    args.output.mkdir(parents=True, exist_ok=True)
    for index, path in enumerate(image_paths(args.data)[:args.limit]):
        image = load_image(path)
        # Match the learned bottleneck's 16 × 16 shape. Top = high pitch.
        pixels = load_image(path, size=16)
        luminance = pixels @ np.array([0.2126, 0.7152, 0.0722])
        grid = np.flipud(luminance).copy()
        stem = args.output / f'{index:03d}-{path.stem}'
        np.save(stem.with_suffix('.npy'), grid)
        export_sound(grid, stem.with_suffix('.wav'), args.scale, args.root, args.threshold)
        fig, axes = plt.subplots(1, 2, figsize=(8, 4))
        axes[0].imshow(image)
        axes[0].set_title(path.name)
        axes[0].axis('off')
        axes[1].imshow(grid, origin='lower', vmin=0, vmax=1, aspect='auto')
        axes[1].set(title='Pixel luminance → notes', xlabel='Time step', ylabel='Pitch row')
        fig.tight_layout()
        fig.savefig(stem.with_suffix('.png'))
        plt.close(fig)
        print(f'{path.name} → {stem.with_suffix(".wav")}')


if __name__ == '__main__':
    main()
