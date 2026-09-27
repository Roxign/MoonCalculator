# Rebuild ../moon-view.html from the parts in this folder:  python src/build.py
import io, os
SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(SRC), "moon-view.html")
rd = lambda n: io.open(os.path.join(SRC, n), encoding="utf-8").read()
parts = [rd("p1.html"), rd("p2.html"), "<script>\nconst ASSETS={\n"]
for k in ("earth", "lights", "bump", "water", "moon"):
    parts.append('%s:"data:image/jpeg;base64,%s",\n' % (k, io.open(os.path.join(SRC, k + ".b64"), encoding="ascii").read()))
parts.append("};\n</scr" + "ipt>\n<script>\n")
for n in ("p3_data.js", "p4_astro.js", "p5_render.js", "p6_ui.js"):
    parts.append(rd(n)); parts.append("\n")
parts.append("</scr" + "ipt>\n</body>\n</html>\n")
io.open(OUT, "w", encoding="utf-8", newline="\n").write("".join(parts))
print("wrote", OUT, round(os.path.getsize(OUT) / 1024, 1), "KB")
