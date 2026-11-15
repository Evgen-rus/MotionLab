"""MIT. Verify the offline Windows bundle and create its local Python environment."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import struct
import subprocess
import sys
import venv


def verify_runtime(root):
    root = Path(root).resolve()
    manifest = json.loads((root / 'runtime-manifest.json').read_text(encoding='utf-8'))
    if manifest.get('schema') != 'motionlab-audio-runtime/v1' or not manifest.get('files'):
        raise ValueError('Missing or unsupported bundled runtime manifest')
    for name, entry in manifest['files'].items():
        relative = PurePosixPath(name)
        path = root.joinpath(*relative.parts)
        if (relative.is_absolute() or '..' in relative.parts or '\\' in name
                or not relative.parts or relative.parts[0] != 'runtime'
                or not path.resolve().is_relative_to(root)):
            raise ValueError(f'Runtime path escapes the bundle: {name}')
        if any(p.is_symlink() or p.is_junction() for p in [path, *path.parents] if p != root and root in p.parents):
            raise ValueError(f'Runtime dependency must not be a link: {name}')
        if not path.is_file() or path.stat().st_size != entry['bytes']:
            raise ValueError(f'Runtime dependency missing or changed: {name}')
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest != entry['sha256']:
            raise ValueError(f'Runtime dependency hash mismatch: {name}')
    return len(manifest['files'])


def prepare(root):
    if (sys.platform != 'win32' or sys.implementation.name != 'cpython'
            or sys.version_info[:2] != (3, 14) or struct.calcsize('P') != 8
            or sysconfig_free_threaded()):
        raise ValueError('This offline bundle requires regular CPython 3.14 for Windows x64')
    root = Path(root).resolve()
    count = verify_runtime(root)
    env = root / '.venv'
    python = env / 'Scripts/python.exe'
    site = env / 'Lib/site-packages'
    pth = site / 'motionlab_numpy.pth'
    relative = os.path.relpath(root / 'runtime/numpy', site) + '\n'
    if env.exists() or env.is_symlink() or env.is_junction():
        if (env.is_symlink() or env.is_junction() or not python.is_file()
                or not pth.is_file() or pth.read_text(encoding='utf-8') != relative):
            raise ValueError('An unrelated .venv already exists; use a fresh bundle folder, do not overwrite it')
    else:
        venv.EnvBuilder(with_pip=False).create(env)
        with pth.open('x', encoding='utf-8') as stream:
            stream.write(relative)
    code = (
        'import numpy as np,sys; from pathlib import Path; '
        'assert np.__version__ == "2.5.4"; '
        'assert Path(np.__file__).resolve().is_relative_to(Path(sys.argv[1]).resolve()); '
        'assert int(np.arange(4).sum()) == 6; '
        'print("NumPy", np.__version__, "from", np.__file__)'
    )
    subprocess.run([str(python), '-I', '-c', code, str(root)], check=True)
    print(f'Verified {count} bundled dependency files; no downloads or music generation.')
    print(f'Python: {python}')
    print(f'Config: {root / "local-config.json"}')
    return python


def sysconfig_free_threaded():
    import sysconfig
    return bool(sysconfig.get_config_var('Py_GIL_DISABLED'))


if __name__ == '__main__':
    try:
        prepare(Path(__file__).resolve().parents[1])
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        sys.exit(f'ERROR: {error}')
