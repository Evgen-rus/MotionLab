"""Output/check regression tests with silent fixtures; no composition or native rendering."""
import contextlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from make_example import example
from musiclib import audio, clean, files, render, summary
from musiclib.model import Clock, save_json


class WavDeliveryTests(unittest.TestCase):
    def run_render(self, folder, chain='room', draft=False, loop=False, clipped=0):
        project = example()
        project['tracks'] = [project['tracks'][2]]
        track = project['tracks'][0]
        track['notes'] = []
        track['performance'] = {'notes': {}, 'cc': []}
        project['clock'] = {'bars': 1, 'meter': [4, 4], 'tempo': [[0, 240]], 'tail_seconds': 1}
        project['sections'] = [{'id': 'fixture', 'start_bar': 0, 'bars': 1, 'intent': 'Silent output fixture'}]
        project['mix']['chain'] = chain
        if loop:
            project['loop'] = {'start_bar': 0}
        clock = Clock(project)
        frames = round((clock.end + clock.tail) * audio.RATE)
        samples = np.zeros((frames, 2), dtype=np.float32)
        measurement = {'true_peak_dbtp': -20, 'clipped_samples': clipped, 'frames': frames,
                       'channels': 2, 'sample_rate': 48000, 'bits': 24, 'integrated_lufs': -18}
        config = {key: {'sha256': 'fixture'} for key in ('fluidsynth', 'ffmpeg')}
        source, output = folder / 'fixture.json', folder / 'render'
        save_json(source, project)

        def stem(p, t, clock, cfg, out, raw, dest, count, quiet=False):
            audio.write_wav(dest, samples)
            return {'reference_level_dbfs': None, 'gain_db': 0, 'filter_chain': []}

        def room(p, clock, cfg, out, frames, duration):
            audio.write_wav(out / 'master.wav', samples)
            return {}, {}

        def master(p, cfg, out):
            audio.write_wav(out / 'master.wav', samples)
            return {}, {}, dict(measurement)

        with contextlib.ExitStack() as stack:
            for target, kwargs in [
                ('musiclib.audio.load_config', {'return_value': config}),
                ('musiclib.audio.ffmpeg', {'side_effect': AssertionError('Unexpected format conversion')}),
                ('musiclib.audio.measure', {'return_value': measurement}),
                ('musiclib.render.process_stem', {'side_effect': stem}),
                ('musiclib.render.room_mix', {'side_effect': room}),
                ('musiclib.render.free_memory', {'return_value': 0}),
                ('musiclib.mixbus.mix', {'return_value': {}}),
                ('musiclib.mixbus.verify', {'return_value': {'adds_up_to_premix': True}}),
                ('musiclib.mixbus.master', {'side_effect': master}),
                ('musiclib.loop.deliver', {'return_value': {'checks': {'loop_fixture': True}, 'files': ['loop.wav']}}),
            ]:
                stack.enter_context(patch(target, **kwargs))
            result = render.render(source, output, folder / 'unused-config.json', jobs=1, draft=draft)
        return result, output

    def test_full_and_draft_keep_wav_checks_without_compressed_copies(self):
        for chain in ('room', 'bus'):
            for draft in (False, True):
                with self.subTest(chain=chain, draft=draft), tempfile.TemporaryDirectory() as temp:
                    result, output = self.run_render(Path(temp), chain=chain, draft=draft)
                    self.assertTrue((output / 'master.wav').is_file())
                    self.assertFalse(list(output.rglob('*.mp3')))
                    self.assertFalse(list(output.rglob('*.flac')))
                    self.assertIsNone(result['mp3'])
                    self.assertNotIn('mp3_loudness_matches_master', result['checks'])
                    self.assertTrue(all(result['checks'].values()))
                    self.assertIn('stereo_48k_24bit', result['checks'])
                    self.assertIn('duration_exact', result['checks'])
                    self.assertIn('tail_quiet', result['checks'])
                    self.assertEqual(result['status'], 'DRAFT_PASS' if draft else 'TECHNICAL_PASS_AUDITION_PENDING')
                    self.assertTrue((output / 'composition.mid').is_file())
                    self.assertTrue((output / 'stems' / 'lead.wav').is_file())

    def test_loop_delivery_still_contributes_its_checks(self):
        with tempfile.TemporaryDirectory() as temp:
            result, _ = self.run_render(Path(temp), loop=True)
            self.assertTrue(result['checks']['loop_fixture'])
            self.assertIn('loop', result)

    def test_audition_cleanup_and_summary_preserve_wav_and_legacy_mp3(self):
        record = {'status': 'PASS', 'track': 'lead', 'bars': [1, 1], 'each_seconds': 1,
                  'gap_seconds': 0.8, 'loudness_lufs': -18, 'versions': [], 'note': 'Fixture'}
        for name in ('audition.wav', 'audition.mp3'):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                folder = Path(temp)
                audio_file = folder / name
                audio_file.write_bytes(b'fixture')
                save_json(folder / 'audition.json', record)
                files.register_tree(folder)
                plan = clean._plan(folder, 'audition', record, [])
                self.assertIn(audio_file, plan['stay'])
                self.assertNotIn(audio_file, [p for p, stamp in plan['take']])
                self.assertIn(name, summary.audition(record, folder))

    def test_clipped_wav_still_blocks_delivery(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            with self.assertRaisesRegex(ValueError, 'Master delivery check failed'):
                self.run_render(folder, clipped=1)
            report = json.loads((folder / 'render' / 'report.json').read_text(encoding='utf-8'))
            self.assertEqual(report['status'], 'FAIL')


if __name__ == '__main__':
    unittest.main()
