#!/usr/bin/env bash
# Rakentaa demon virallisen sovelluksen uusimmasta versiosta.
# Hakee index.html:n, manifestin ja kuvakkeet reposta norseman-diary/norseman
# ja vaihtaa Supabase-yhteyden tilalle demo.js:n.
# Käyttö: ./build.sh   (sitten git commit + push)
set -euo pipefail
cd "$(dirname "$0")"

SRC=https://raw.githubusercontent.com/norseman-diary/norseman/main
for f in index.html manifest.webmanifest icon-192.png icon-512.png apple-touch-icon.png; do
  curl -fsSL "$SRC/$f" -o "$f"
done

python3 - <<'EOF'
import json, re

html = open('index.html', encoding='utf-8').read()

def sub(pattern, repl, text, what):
    new, n = re.subn(pattern, repl, text, count=1)
    if n != 1:
        raise SystemExit(f'build.sh: kohtaa ei löytynyt: {what}')
    return new

# Supabase-kirjasto pois, demo.js tilalle
html = sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^"]*"></script>',
           '<script src="demo.js"></script>', html, 'supabase-js-skripti')
# Oikeat projektiosoite ja avain pois demosta
html = sub(r"const SUPABASE_URL = '[^']*';", "const SUPABASE_URL = 'https://demo.invalid';", html, 'SUPABASE_URL')
html = sub(r"const SUPABASE_KEY = '[^']*';", "const SUPABASE_KEY = 'demo';", html, 'SUPABASE_KEY')
# Tilarivi ei saa väittää, että tiedot synkronoituvat laitteiden välillä
html = sub(r"'Synkronoitu\. Merkinnät näkyvät kaikilla laitteillasi\.'",
           "'Demo: merkinnät tallentuvat vain tähän selaimeen.'", html, 'synkronointiteksti')
# Otsikko ja demopalkin tyyli
html = sub(r'<title>([^<]*)</title>', r'<title>\1 (demo)</title>', html, 'title')
html = sub(r'</style>', '''.demo-bar{position:sticky;top:0;z-index:20;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 16px;background:var(--fjord);color:var(--surface);font-size:.9rem}
.demo-bar button{font:inherit;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer}
.demo-bar button:focus-visible{outline:2px solid var(--surface);outline-offset:2px}
</style>''', html, 'style-loppu')

open('index.html', 'w', encoding='utf-8').write(html)

m = json.load(open('manifest.webmanifest', encoding='utf-8'))
m['name'] += ' (demo)'
m['short_name'] = 'Norseman demo'
json.dump(m, open('manifest.webmanifest', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
EOF

if grep -q 'jxmtwvyokxdlwoftrjmw\|eyJhbGci' index.html; then
  echo "build.sh: Supabase-tunnisteita jäi index.html:ään" >&2; exit 1
fi
echo "Demo rakennettu."
