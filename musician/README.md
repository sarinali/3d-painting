# Musician

From the repository root:

```sh
python3 -m venv musician/.venv
musician/.venv/bin/python -m pip install -r musician/requirements.txt
musician/.venv/bin/jupyter lab musician/musician.ipynb
```

Choose the Python kernel from `musician/.venv` if prompted. Run cells top to bottom (Run → Run All Cells). The first cell installs the notebook's dependencies; you can skip it after the setup above.

The notebook loads `data/monet/by-medium/` recursively from either the repository root or `musician/`. It prints medium counts, trains for 100 epochs on CPU with progress every 10 epochs, then shows the original, reconstruction, note grid, and audio player. Try `EPOCHS = 10` for a quick first run.

Change `INDEX` in the final code cell and rerun that cell to listen to another painting without retraining. The printed path identifies its medium. `unknown` means an unknown medium, not a known painting family. There is only one pastel in the current dataset, so this first run is exploratory rather than a reliable comparison of media.

The model stays in notebook memory. Restarting the kernel requires training again. Family names are not used in training.

Playback controls: set `SCALE` (default `major_pentatonic`) and `ROOT_MIDI` (default 48/C3) in the final code cell. Rerun that cell to change scales without retraining. The plot labels the selected MIDI pitches.

Sheet music: install the updated requirements (or rerun the install cell), then run the Sheet music cell after playback. `NOTE_THRESHOLD` controls which notes appear. A matching thresholded audio preview and MusicXML/SVG exports are generated in `musician/output/`.

## Separate experiments

Run from the repository root using the Python environment where you installed the requirements:

```sh
python musician/direct_image.py --scale major_pentatonic --limit 6
python musician/no_position.py --epochs 100 --scale major_pentatonic --limit 6
```

If using the environment from the setup above, replace `python` with `musician/.venv/bin/python`.

- **Direct image:** no training. Resizes the original image to 16 × 16, converts RGB to weighted luminance, and uses brightness as note amplitude. Top rows become high pitches, columns become time. This deliberately discards color and fine detail; it is a baseline, not a lossless translation. The preview also shows the 64 × 64 image for comparison with the notebook.
- **No position:** trains on all images under `--data`, with the same 64 × 64 RGB preprocessing, 16 × 16 bottleneck, decoder, pixel/edge loss, batch size, optimizer, and default seed as the notebook. Removes only the two coordinate input channels. Convolutions still retain spatial structure, and padding can provide boundary cues; this does not make the model position-invariant. `--limit` limits exports, not training data. This is a fresh training run, not a modification to the notebook model.

Outputs go to `musician/output/direct-image/` and `musician/output/no-position/`. Each exported painting gets a PNG comparison, WAV sound, and NPY amplitude grid. The trained experiment also saves `model.pt` and `losses.npy`. Rerunning with the same output directory overwrites matching files; use `--output` to keep separate runs.

Both scripts share the notebook's scale mapping, sine tones, 0.15-second columns, fades, and peak normalization. Neither adds learned rhythm. Use the same `--scale`, `--root`, and `--threshold` for comparisons. The note grids use a fixed 0–1 color scale. The no-position grid uses the notebook's original row orientation; the direct grid explicitly maps the image's top to high pitch.

Examples:

```sh
python musician/direct_image.py --data data/monet/by-medium/oil-paint --scale minor --limit 12
python musician/no_position.py --epochs 10 --limit 6 --output musician/output/no-position-quick
```

Training examples are also used for previews; this is an exploratory comparison, not a held-out evaluation.

### Notebook versions

Open `direct_image.ipynb` for the no-training pixel experiment, or `no_position.ipynb` for the RGB-only autoencoder. Run each top to bottom. Both display images, note grids, and audio players inline for six paintings by default. Change `START`, `COUNT`, `SCALE`, `ROOT_MIDI`, or `THRESHOLD`, then rerun the playback-controls and display cells without retraining. Each has its own setup and data loading; neither depends on variables from the original notebook. The no-position notebook also displays reconstructions and the training loss curve.


## Melody playback (current default)

All notebooks and both scripts now select exactly one pitch per column using argmax, then merge adjacent identical pitches into one sustained note. A zero column (or a winner at/below the threshold) becomes a rest. Ties select the lowest pitch. Each sustained note uses the mean winning amplitude over its run. Fades happen only at note boundaries, not at every column; audio is still peak-normalized. This replaces the earlier simultaneous-chord playback without changing the model or training.

The playback cell reloads the shared helper automatically. Reload the saved notebook while keeping your kernel alive, then rerun playback—no retraining. Existing saved audio/plots do not change until rerun. White lines on note grids mark the chosen pitches and durations. The original notebook's sheet-music cell now writes the same monophonic events and inherits the playback rest threshold.

Run checks with `python musician/test_melody.py` in the installed Python environment.

## Investigating patterns

The two trained notebooks now end with **Do visually similar paintings produce similar melodies?** and **Trace a note back to pixels**. Run them with the existing trained model in memory. The first compares low-resolution RGB appearance, learned-grid distances, and transposition-invariant interval-contour distances across all loaded images, with a label-permutation check and nearest-image plots. The second differentiates the winning note's margin over its runner-up and shows the input strip that can affect that time step. These are exploratory analyses of training images; they do not establish generalization.

Encoder receptive fields: 3 × 3 → 7 × 7 → 15 × 15, at output strides 2 → 4 → 4. Adjacent note columns overlap by 11 input pixels. A selected note compares all pitch rows, so its dependency can span a full-height, 15-pixel-wide strip. Position coordinates do not enlarge that field. Argmax can jump when the two strongest activations are nearly tied, even if their underlying grids are similar.


## Further questions

1. How can this be related to interpretability -> read the stuff on interpretability on X
2. How would a pretrained backbone with vision transformer perform with this? How can we find different architecture for reconstruction?
3. Do similar looking paintings produce simliar melodies? 
4. Do similar melodies produce similar paintings (can we go the other way in reconstruction)
5. Something with latent space and the embeddings produced by CLIP can be something to explore, do shared representations look and sound similar?
6. How do certain features like "eyes" "snouts" and others sound?