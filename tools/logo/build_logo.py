"""Build the Murmura seal logo as self-contained SVG (all glyphs outlined).

Glyph outlines come from SIL OFL-licensed Noto fonts, so the SVGs render the
same everywhere and need no installed fonts.

Usage (from the repo root, inside a virtualenv with fonttools installed):
    LOGO_FONT_DIR=tools/logo/fonts python tools/logo/build_logo.py /tmp/logo-out
    cp /tmp/logo-out/logo.svg /tmp/logo-out/favicon.svg public/
Writes logo.svg, favicon.svg (simplified seal for tiny sizes), maskable.svg
(full-bleed PWA icon), admin-icon.svg and src/components/common/logoGlyphs.ts.
PNG icons are rendered with rsvg-convert: favicon-{16,32,48}x*.png from
favicon.svg, apple-touch-icon.png / icon-192.png / icon-512.png from
maskable.svg, logo-512.png from logo.svg; favicon.ico bundles the favicon PNGs.
"""
import math
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

import os

# Directory containing the Noto variable fonts from github.com/google/fonts (ofl/notosansjp,
# ofl/notosanskr, ofl/notoserif). Not committed; download them before running.
FONT_DIR = Path(os.environ.get('LOGO_FONT_DIR', 'tools/logo/fonts'))
_cache = {}

def font(name, weight):
    key = (name, weight)
    if key not in _cache:
        f = TTFont(FONT_DIR / name)
        axes = {'wght': weight}
        if 'wdth' in [a.axisTag for a in f['fvar'].axes]:
            axes['wdth'] = 100
        _cache[key] = instantiateVariableFont(f, axes)
    return _cache[key]

JP = 'NotoSansJP%5Bwght%5D.ttf'
KR = 'NotoSansKR%5Bwght%5D.ttf'
SERIF = 'NotoSerif%5Bwdth,wght%5D.ttf'

def glyph_path(char, fontname, weight, cx, cy, size, fill, opacity=None):
    """Outline `char` and centre its ink box on (cx, cy) at `size` px per em."""
    f = font(fontname, weight)
    gs = f.getGlyphSet()
    gname = f.getBestCmap()[ord(char)]
    pen = SVGPathPen(gs)
    gs[gname].draw(pen)
    bp = BoundsPen(gs)
    gs[gname].draw(bp)
    xmin, ymin, xmax, ymax = bp.bounds
    s = size / f['head'].unitsPerEm
    tx = cx - (xmin + xmax) / 2 * s
    ty = cy + (ymin + ymax) / 2 * s
    op = f' opacity="{opacity}"' if opacity is not None else ''
    return (f'<path transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f} {-s:.5f})" '
            f'd="{pen.getCommands()}" fill="{fill}"{op}/>')

def build(palette, variant):
    ring_a, ring_b, glyph_a, glyph_b, main, badge_bg, bg_a, bg_b = palette
    defs = f'''<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="{bg_a}"/><stop offset="100%" stop-color="{bg_b}"/></linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="{ring_a}"/><stop offset="50%" stop-color="{ring_b}"/><stop offset="100%" stop-color="{ring_a}"/></linearGradient>
  </defs>'''
    if variant == 'maskable':
        # Full-bleed square (PWA maskable icons are cropped to a circle/squircle); seal inside the safe zone
        inner = build(palette, 'full').split('</defs>', 1)[1].rsplit('</svg>', 1)[0]
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <title>Murmura</title>\n  '
                f'{defs}\n  <rect width="512" height="512" fill="{bg_b}"/>\n  '
                f'<g transform="translate(51.2 51.2) scale(0.8)">{inner}</g>\n</svg>\n')
    if variant == 'small':
        body = (f'<circle cx="256" cy="256" r="236" fill="url(#bg)" stroke="url(#ring)" stroke-width="16"/>'
                + glyph_path('学', JP, 700, 256, 256, 300, main))
    else:
        radius, badge_r = 184, 30
        glyphs = [('あ', JP, glyph_a), ('Ñ', SERIF, glyph_b), ('한', KR, glyph_b),
                  ('ß', SERIF, glyph_a), ('文', JP, glyph_a), ('A', SERIF, glyph_b)]
        parts = [f'<circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="url(#ring)" stroke-width="6"/>',
                 f'<circle cx="256" cy="256" r="{radius}" fill="none" stroke="{ring_b}" stroke-width="3" stroke-dasharray="6 14" opacity="0.5"/>']
        for i, (ch, fn, colour) in enumerate(glyphs):
            a = math.radians(-90 + i * 60)
            x, y = 256 + radius * math.cos(a), 256 + radius * math.sin(a)
            parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{badge_r}" fill="{badge_bg}" stroke="{ring_b}" stroke-width="3"/>')
            parts.append(glyph_path(ch, fn, 600, x, y, 38, colour))
        parts.append(glyph_path('学', JP, 700, 256, 256, 250, main))
        body = ''.join(parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <title>Murmura</title>\n  '
            f'{defs}\n  {body}\n</svg>\n')

SITE = ('#c41e3a', '#d4a574', '#c41e3a', '#d4a574', '#f5f0e8', '#1a1a2e', '#1e1e36', '#0f0f1a')
ADMIN = ('#c44000', '#ff8534', '#e85d04', '#ffb070', '#f5ede6', '#221f1d', '#262220', '#1a1918')

def glyph_parts():
    """Path data for the header component: (char, role, d, transform) in the 512 box."""
    import re
    radius = 184
    glyphs = [('あ', JP, 'a'), ('Ñ', SERIF, 'b'), ('한', KR, 'b'), ('ß', SERIF, 'a'), ('文', JP, 'a'), ('A', SERIF, 'b')]
    out = []
    for i, (ch, fn, role) in enumerate(glyphs):
        a = math.radians(-90 + i * 60)
        x, y = 256 + radius * math.cos(a), 256 + radius * math.sin(a)
        out.append((ch, role, round(x, 1), round(y, 1), glyph_path(ch, fn, 600, x, y, 38, 'X')))
    out.append(('学', 'main', 256, 256, glyph_path('学', JP, 700, 256, 256, 250, 'X')))
    parsed = []
    for ch, role, x, y, el in out:
        tr = re.search(r'transform="([^"]+)"', el).group(1)
        d = re.search(r' d="([^"]+)"', el).group(1)
        parsed.append({'char': ch, 'role': role, 'cx': x, 'cy': y, 'transform': tr, 'd': d})
    return parsed

if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    (out / 'logo.svg').write_text(build(SITE, 'full'))
    (out / 'favicon.svg').write_text(build(SITE, 'small'))
    (out / 'maskable.svg').write_text(build(SITE, 'maskable'))
    (out / 'admin-icon.svg').write_text(build(ADMIN, 'full'))
    import json
    ts_path = Path('src/components/common/logoGlyphs.ts')
    ts_path.write_text(
        '// Generated by tools/logo/build_logo.py - do not edit by hand.\n'
        '// Outlined glyphs (Noto fonts, SIL OFL) for the Murmura seal, in a 512x512 box.\n\n'
        'export interface LogoGlyph {\n  char: string;\n  /** a/b: orbit badge accent colours, main: centre character */\n'
        "  role: 'a' | 'b' | 'main';\n  cx: number;\n  cy: number;\n  transform: string;\n  d: string;\n}\n\n"
        'export const LOGO_GLYPHS: LogoGlyph[] = '
        + json.dumps(glyph_parts(), ensure_ascii=False, indent=2) + ';\n')
    print('written', ts_path)
    print('written', [p.name for p in out.iterdir()])
