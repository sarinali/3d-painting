"""Checks for deterministic melody selection, sustained audio, and score timing."""
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np
from experiment_utils import melody_events, synthesize_events, export_sound


class MelodyTests(unittest.TestCase):
    def test_argmax_merge_and_rests(self):
        grid = [[.9, .8, .1, 0, 0], [.1, .2, .9, 0, 0]]
        events = melody_events(grid, 'major', 48)
        self.assertEqual([(e['pitch'], e['start'], e['steps']) for e in events],
                         [(48, 0, 2), (50, 2, 1), (None, 3, 2)])
        self.assertAlmostEqual(events[0]['amplitude'], .85)
        self.assertEqual(melody_events([[.5], [.5]])[0]['row'], 0)

    def test_threshold_and_validation(self):
        self.assertIsNone(melody_events([[.4], [.3]], threshold=.5)[0]['pitch'])
        for grid in ([], [[]], [[.2], [.2, .3]], [[float('nan')]], [[-1]]):
            with self.assertRaises(ValueError):
                melody_events(grid)

    def test_sustain_has_no_internal_attack(self):
        grid = np.ones((1, 4))
        events = melody_events(grid)
        self.assertEqual(len(events), 1)
        actual = synthesize_events(events)
        n = int(22050 * .15)
        t = np.arange(n * 4) / 22050
        frequency = 440 * 2 ** ((48 - 69) / 12)
        expected = np.sin(2 * np.pi * frequency * t)
        fade = int(22050 * .01)
        expected[:fade] *= np.linspace(0, 1, fade)
        expected[-fade:] *= np.linspace(1, 0, fade)
        expected /= np.abs(expected).max()
        np.testing.assert_allclose(actual, expected)
        silence = synthesize_events(melody_events(np.zeros((16, 16))))
        self.assertEqual(len(silence), n * 16)
        self.assertTrue(np.all(silence == 0))

    def test_wav_export(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'melody.wav'
            export_sound(np.ones((16, 16)), path, 'major_pentatonic', 48, 0)
            with wave.open(str(path)) as f:
                self.assertEqual(f.getnframes(), int(22050 * .15) * 16)
                self.assertEqual(f.getnchannels(), 1)
                self.assertEqual(f.getframerate(), 22050)

    def test_score_and_render(self):
        from music21 import stream, note, meter, tempo
        from music21.musicxml.m21ToXml import GeneralObjectExporter
        import verovio
        grid = np.zeros((3, 16))
        grid[0, :4] = .9
        grid[1, 4:12] = .8
        events = melody_events(grid)
        part = stream.Part()
        part.insert(0, meter.TimeSignature('4/4'))
        part.insert(0, tempo.MetronomeMark(number=100))
        for item in events:
            event = note.Rest() if item['pitch'] is None else note.Note(item['pitch'])
            event.quarterLength = item['steps'] * .25
            part.append(event)
        self.assertEqual(part.duration.quarterLength, 4)
        score = stream.Score([part])
        xml = GeneralObjectExporter(score).parse().decode()
        renderer = verovio.toolkit()
        self.assertTrue(renderer.loadData(xml))
        self.assertIn('<svg', renderer.renderToSVG(1))


if __name__ == '__main__':
    unittest.main()
