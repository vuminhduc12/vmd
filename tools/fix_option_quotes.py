# -*- coding: utf-8 -*-
"""Fix <option value=\"X>... where closing quote before > was lost."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "index.html"
t = p.read_text(encoding="utf-8")

keys = "朝食|昼食|夕食|間食|低|高|完了"
t2, n = re.subn(rf'value="({keys})>(?!")', r'value="\1">', t)
print("replacements", n)
t = t2

t = t.replace("🌅  朝食", "🌅 朝食")
t = t.replace("🍽  昼食", "🍽 昼食")
t = t.replace("🌆  夕食", "🌆 夕食")
t = t.replace("🌙  間食", "🌙 間食")
t = t.replace("🟢  低", "🟢 低")
t = t.replace("🟡  中", "🟡 中")
t = t.replace("🟠  高", "🟠 高")

p.write_text(t, encoding="utf-8", newline="\n")
print("ok")
