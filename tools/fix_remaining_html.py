from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "index.html"
t = p.read_text(encoding="utf-8")
t = t.replace(
    'placeholder="相手名 / ジム名>\n          </div>\n        </div">',
    'placeholder="相手名 / ジム名">\n          </div>\n        </div>',
)
t = t.replace(
    'placeholder="実戦相手>\n          </div>\n        </div">',
    'placeholder="実戦相手名">\n          </div>\n        </div>',
)
t = t.replace('</div">', '</div>')
p.write_text(t, encoding="utf-8", newline="\n")
print("ok")
