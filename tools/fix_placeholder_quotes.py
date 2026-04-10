# -*- coding: utf-8 -*-
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "index.html"
t = p.read_text(encoding="utf-8")
# placeholder="...> at line end without closing quote before >
t2, n = re.subn(r'placeholder="([^"]+)>(\s*\n)', r'placeholder="\1">\2', t)
print("fixed", n)
p.write_text(t2, encoding="utf-8", newline="\n")
