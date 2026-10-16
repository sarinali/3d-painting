"""Shared image loading and playback so both experiments use the same mapping."""
from pathlib import Path
import wave

SCALES = {
    'chromatic': list(range(12)),
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'major_pentatonic': [0, 2, 4, 7, 9],
    'minor_pentatonic': [0, 3, 5, 7, 10],
}
DEFAULT_DATA = Path(__file__).resolve().parents[1] / 'data/monet/by-medium'


def add_arguments(parser, experiment):
    parser.add_argument('--data', type=Path, default=DEFAULT_DATA,
                        help='An image file or directory (searched recursively).')
    parser.add_argument('--output', type=Path,
                        default=Path(__file__).resolve().parent / 'output' / experiment)
    parser.add_argument('--scale', choices=SCALES, default='major_pentatonic')
    parser.add_argument('--root', type=int, default=48, help='Root MIDI pitch; 48 = C3.')
    parser.add_argument('--limit', type=int, default=6, help='Number of paintings to export.')
    parser.add_argument('--threshold', type=float, default=0,
                        help='Silence amplitudes at or below this value (0–1).')


def image_paths(source):
    candidates = [source] if source.is_file() else source.rglob('*')
    paths = sorted(p for p in candidates if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'})
    if not paths:
        raise ValueError(f'No images found in {source}')
    return paths


def load_image(path, size=64):
    import numpy as np
    from PIL import Image, ImageOps
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        return np.array(image.resize((size, size)), dtype=np.float32) / 255


def midi_notes(rows, scale, root):
    intervals = SCALES[scale]
    notes = [root + intervals[k % len(intervals)] + 12 * (k // len(intervals))
             for k in range(rows)]
    if not all(0 <= note <= 127 for note in notes):
        raise ValueError('Root puts pitches outside MIDI 0–127.')
    return notes


def melody_events(grid, scale='major_pentatonic', root=48, threshold=0):
    """Argmax per column, then merge adjacent equal pitches (or silent steps)."""
    import math
    values = [list(row) for row in grid]
    if not values or not values[0] or any(len(row) != len(values[0]) for row in values):
        raise ValueError('Expected a nonempty rectangular pitch × time grid.')
    if not 0 <= threshold <= 1:
        raise ValueError('Threshold must be between 0 and 1.')
    if any(not math.isfinite(float(v)) or not 0 <= v <= 1 for row in values for v in row):
        raise ValueError('Amplitudes must be finite and between 0 and 1.')
    pitches = midi_notes(len(values), scale, root)
    events = []
    for step in range(len(values[0])):
        # Ties deterministically choose the lowest row. Softmax has the same argmax.
        row = max(range(len(values)), key=lambda k: values[k][step])
        amplitude = float(values[row][step])
        pitch = pitches[row] if amplitude > threshold else None
        if events and events[-1]['pitch'] == pitch:
            event = events[-1]
            event['amplitude'] = (event['amplitude'] * event['steps'] + amplitude) / (event['steps'] + 1)
            event['steps'] += 1
        else:
            events.append(dict(pitch=pitch, row=row if pitch is not None else None,
                               start=step, steps=1, amplitude=amplitude))
    return events


def synthesize_events(events, sample_rate=22050, step_seconds=0.15):
    """One sine tone per event, with fades only at note boundaries."""
    import numpy as np
    samples_per_step = int(sample_rate * step_seconds)
    if samples_per_step < 2:
        raise ValueError('Time steps must contain at least two samples.')
    chunks = []
    for event in events:
        n = samples_per_step * event['steps']
        sound = np.zeros(n)
        if event['pitch'] is not None:
            frequency = 440 * 2 ** ((event['pitch'] - 69) / 12)
            t = np.arange(n) / sample_rate
            sound = event['amplitude'] * np.sin(2 * np.pi * frequency * t)
            fade = min(max(2, int(sample_rate * 0.01)), n // 2)
            sound[:fade] *= np.linspace(0, 1, fade)
            sound[-fade:] *= np.linspace(1, 0, fade)
        chunks.append(sound)
    audio = np.concatenate(chunks) if chunks else np.zeros(1)
    return audio / max(float(np.abs(audio).max()), 1e-8)


def sonify(grid, scale='major_pentatonic', root=48, threshold=0,
           sample_rate=22050, step_seconds=0.15):
    return synthesize_events(melody_events(grid, scale, root, threshold), sample_rate, step_seconds)


def export_sound(grid, destination, scale, root, threshold):
    audio = sonify(grid, scale, root, threshold)
    with wave.open(str(destination), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(22050)
        output.writeframes((audio * 32767).astype('<i2').tobytes())
