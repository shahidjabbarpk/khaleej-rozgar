"""Merge translations from scripts/lang-json/<lang>.json into src/lib/lang/<lang>.ts.

Usage: python scripts/merge-lang.py ar ur hi bn ne ml ta si ps tl
Existing keys in the .ts file are replaced by the JSON value; new keys are appended before the final "};".
A brand-new language file is created when it has no entries yet.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMES = {'ne': 'Nepali', 'ml': 'Malayalam', 'ta': 'Tamil', 'si': 'Sinhala', 'ps': 'Pashto (right-to-left)', 'tl': 'Tagalog / Filipino'}


def key_src(k: str) -> str:
    return json.dumps(k, ensure_ascii=False).replace('"', "'") if not re.fullmatch(r'[A-Za-z_]\w*', k) else k


def val_src(v: str) -> str:
    return "'" + v.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


for lang in sys.argv[1:]:
    data = json.loads((ROOT / 'scripts' / 'lang-json' / f'{lang}.json').read_text(encoding='utf8'))
    ts = ROOT / 'src' / 'lib' / 'lang' / f'{lang}.ts'
    s = ts.read_text(encoding='utf8') if ts.exists() else ''
    if '= {};' in s or not s:
        s = (f"import type {{ Key }} from './en';\n\n/** {NAMES.get(lang, lang)}. Missing keys fall back to English. */\n"
             f"export const {lang}: Partial<Record<Key, string>> = {{\n}};\n")
    for k, v in data.items():
        pat = re.compile(r"^  " + re.escape(key_src(k)) + r": .*$", re.M)
        line = f"  {key_src(k)}: {val_src(v)},"
        if pat.search(s):
            s = pat.sub(lambda _m: line, s, count=1)
        else:
            i = s.rstrip().rfind('};')
            s = s[:i] + line + '\n' + s[i:]
    ts.write_text(s, encoding='utf8')
    print(lang, len(data), 'keys merged')
