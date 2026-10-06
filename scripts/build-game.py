"""Embed the game's source and artwork into a dependency-free standalone page."""
from pathlib import Path
import base64
import sys

ROOT = Path(__file__).resolve().parents[1]
ARTWORK = {
    "BG": "city-dusk-v2.webp",
    "DOG": "dog-sprites.webp",
    "FILE": "complaint-caso-v2.webp",
    "BUCKETS": "productos-sheet.webp",
    "JUMP": "agent-fetch-dog-jump.webp",
}

styles = (ROOT / "src/styles.css").read_text()
for key, filename in ARTWORK.items():
    encoded = base64.b64encode((ROOT / "assets" / filename).read_bytes()).decode()
    styles = styles.replace(f"__ART_{key}__", f'url("data:image/webp;base64,{encoded}")')
assert "__ART_" not in styles, "Unresolved artwork placeholder"

body = (ROOT / "src/body.html").read_text()
script = (ROOT / "src/game.js").read_text()
page = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0c1c31">
<meta name="description" content="Agent Fetch: una misión de doce expedientes. Salta, encadena puntos y demuestra quién es el mejor agente de la ciudad.">
<title>Agent Fetch — Operación expediente</title>
<style>
''' + styles + '''</style>
</head>
<body>
''' + body + '''<script>
''' + script + '''</script>
</body>
</html>
'''

output = ROOT / "index.html"
if "--check" in sys.argv:
    if not output.exists() or output.read_text() != page:
        sys.exit("index.html is stale. Run python3 scripts/build-game.py")
    print("PASS: standalone game matches source and artwork")
else:
    output.write_text(page)
    print(f"Built index.html ({len(page.encode()):,} bytes)")
