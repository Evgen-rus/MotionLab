"""Read-only runtime/config tests; no synthesis, render or external installation."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from musiclib.audio import absolute_paths, load_config
from prepare_runtime import verify_runtime


class PortableRuntimeTests(unittest.TestCase):
    def test_config_resolves_core_and_surge_from_config_folder(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            home = root / 'Audio with spaces'
            home.mkdir()
            dependency = home / 'dependency.bin'
            dependency.write_bytes(b'local pinned dependency')
            entry = {'path': 'dependency.bin', 'sha256': hashlib.sha256(dependency.read_bytes()).hexdigest()}
            config = {key: dict(entry) for key in ('fluidsynth', 'ffmpeg', 'soundfont', 'surge', 'pedalboard')}
            config['surge'].update(binary='dependency.bin', patches='patches', catalog='catalog')
            config['soundfonts'] = {'named': dict(entry)}
            config_path = home / 'config.json'
            config_path.write_text(json.dumps(config), encoding='utf-8')
            previous = Path.cwd()
            try:
                os.chdir(root)
                result = load_config(config_path, all_banks=True)
            finally:
                os.chdir(previous)
            for key in ('fluidsynth', 'ffmpeg', 'soundfont', 'surge', 'pedalboard'):
                self.assertEqual(Path(result[key]['path']), dependency)
            self.assertEqual(Path(result['surge']['binary']), dependency)
            self.assertEqual(Path(result['surge']['patches']), home / 'patches')
            self.assertEqual(Path(result['surge']['catalog']), home / 'catalog')
            self.assertEqual(Path(result['soundfonts']['named']['path']), dependency)
            self.assertEqual(absolute_paths(result, root), result)
            config['ffmpeg']['sha256'] = '0' * 64
            config_path.write_text(json.dumps(config), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                load_config(config_path)
            del config['ffmpeg']
            config_path.write_text(json.dumps(config), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'needs.*ffmpeg'):
                load_config(config_path)

    def test_manifest_rejects_changed_and_escaping_dependencies(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runtime = root / 'runtime'
            runtime.mkdir()
            binary = runtime / 'dependency.bin'
            binary.write_bytes(b'original')
            item = {'bytes': 8, 'sha256': hashlib.sha256(b'original').hexdigest()}
            manifest = {'schema': 'motionlab-audio-runtime/v1', 'files': {'runtime/dependency.bin': item}}
            path = root / 'runtime-manifest.json'
            path.write_text(json.dumps(manifest), encoding='utf-8')
            self.assertEqual(verify_runtime(root), 1)
            binary.write_bytes(b'modified')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                verify_runtime(root)
            for name in ('runtime/../../outside.bin', 'C:/outside.bin', 'runtime\\..\\outside.bin'):
                manifest['files'] = {name: item}
                path.write_text(json.dumps(manifest), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'escapes'):
                    verify_runtime(root)


if __name__ == '__main__':
    unittest.main()
