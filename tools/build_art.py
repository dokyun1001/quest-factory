"""Build derived art for QUEST FACTORY from the untouched vendor packs.

Reads  assets/vendor/**  (original downloads, never modified)
Writes assets/modified/** (sliced / recoloured derivatives) + assets/modified/meta.json

Run:  python3 -I tools/build_art.py
"""
import json, os, sys, colorsys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, 'assets', 'vendor')
OUT = os.path.join(ROOT, 'assets', 'modified')
AUTO = os.path.join(VENDOR, 'automation-tileset', 'automation pack', 'automation spritesheet.png')

# Horizontal machine animations in the automation sheet: 96px-wide cells, 3 per row.
# (name, y_start, y_end) in source pixels. Bands inside each range are auto-detected.
MACHINES = [
    ('cooler',      14 * 32, 22 * 32),
    ('electrifier', 24 * 32, 30 * 32),
    ('smelter',     32 * 32, 42 * 32),
    ('fabricator',  44 * 32, 55 * 32 + 24),
    ('recycler',    66 * 32, 72 * 32),
    ('randomizer',  73 * 32, 79 * 32),
]
CELL_W = 96
FIXED_32 = {'electrifier'}   # frames touch each other: slice on the 32px grid


def warm(px, strength=1.0):
    """Shift the cold slate/neon palette toward Tiny Swords' warm, bright palette."""
    r, g, b, a = px
    if a == 0:
        return px
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if 0.17 < h < 0.45 and s > 0.25:          # neon-green trims -> golden wood trim
        h, s, v = 0.10, min(1, s * 0.9), min(1, v * 1.05)
    elif s < 0.25:                             # slate greys -> warm stone
        h, s, v = 0.08, s * 0.5 + 0.10 * strength, min(1, v * 1.12)
    rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
    return (int(rr * 255), int(gg * 255), int(bb * 255), a)


def recolor(im, fn):
    im = im.copy()
    im.putdata([fn(p) for p in im.get_flattened_data()] if hasattr(im, 'get_flattened_data') else [fn(p) for p in im.getdata()])
    return im


def soft_warm(px):
    r, g, b, a = px
    if a == 0:
        return px
    return (min(255, int(r * 1.06 + 6)), min(255, int(g * 1.02 + 4)), int(b * 0.9), a)


def bands(im, y0, y1):
    """Vertical bands of opaque rows (machine frame rows) between y0 and y1."""
    rows = []
    for y in range(y0, y1):
        opaque = sum(1 for x in range(0, 288) if im.getpixel((x, y))[3] > 0)
        rows.append(opaque > 0)
    out, start = [], None
    for i, on in enumerate(rows + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= 20:                 # ignore particle/spark rows
                out.append((y0 + start, y0 + i))
            start = None
    return out


def bbox(im):
    return im.getbbox()


def build_machines(sheet, meta):
    for name, y0, y1 in MACHINES:
        frames = []
        bl = [(y, y + 32) for y in range(y0, y1, 32)] if name in FIXED_32 else bands(sheet, y0, y1)
        for (by0, by1) in bl:
            for c in range(3):
                cell = sheet.crop((c * CELL_W, by0, (c + 1) * CELL_W, by1))
                if cell.getbbox():
                    frames.append(cell)
        # common bbox across frames so the animation doesn't jitter
        boxes = [f.getbbox() for f in frames]
        x0 = min(b[0] for b in boxes); x1 = max(b[2] for b in boxes)
        top = min(b[1] for b in boxes); bot = max(b[3] for b in boxes)
        fw, fh = x1 - x0, max(f.height for f in frames)
        # bottom-align every frame (bands may differ slightly in height)
        strip = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            crop = f.crop((x0, 0, x1, f.height))
            strip.paste(crop, (i * fw, fh - f.height))
        strip = recolor(strip, soft_warm)
        tb = strip.getbbox()
        strip = strip.crop((0, tb[1], strip.width, tb[3]))
        p = os.path.join(OUT, 'automation', f'machine_{name}.png')
        strip.save(p)
        meta[f'machine_{name}'] = {'frameWidth': fw, 'frameHeight': strip.height, 'frames': len(frames)}
        print(f'{name}: {len(frames)} frames {fw}x{strip.height}')


def build_belt(sheet, meta):
    tile = sheet.crop((32, 5 * 32, 64, 6 * 32))      # seamless straight belt, chevrons pointing right
    recolor(tile, warm).save(os.path.join(OUT, 'automation', 'belt_h.png'))
    meta['belt_h'] = {'frameWidth': 32, 'frameHeight': 32, 'frames': 1}


def build_items(sheet, meta):
    items = sheet.crop((0, 0, 320, 96))              # 10x3 grid of 32px cells
    items.save(os.path.join(OUT, 'automation', 'items.png'))
    meta['auto_items'] = {'frameWidth': 32, 'frameHeight': 32, 'frames': 30}


TS = os.path.join(VENDOR, 'tiny-swords', 'Tiny Swords (Free Pack)')


def stitch_exploded(src, cells=(0, 2, 4), cell=64, m=40):
    """Tiny Swords ships 9-slice UI as separated pieces, each with its own inner outline.
    Build a clean 9-slice: keep only the outer `m` px of each corner/edge piece, extend
    edges from a 1px strip, fill the centre flat. Returns (image, margins l,r,t,b)."""
    im = Image.open(src).convert('RGBA')
    c = lambda i, j: im.crop((cells[i] * cell, cells[j] * cell, (cells[i] + 1) * cell, (cells[j] + 1) * cell))
    k = cell - m
    out = Image.new('RGBA', (m * 3, m * 3), (0, 0, 0, 0))
    out.paste(c(0, 0).crop((0, 0, m, m)), (0, 0))
    out.paste(c(2, 0).crop((k, 0, cell, m)), (2 * m, 0))
    out.paste(c(0, 2).crop((0, k, m, cell)), (0, 2 * m))
    out.paste(c(2, 2).crop((k, k, cell, cell)), (2 * m, 2 * m))
    top = c(1, 0).crop((cell // 2, 0, cell // 2 + 1, m)).resize((m, m))
    bot = c(1, 2).crop((cell // 2, k, cell // 2 + 1, cell)).resize((m, m))
    lef = c(0, 1).crop((0, cell // 2, m, cell // 2 + 1)).resize((m, m))
    rig = c(2, 1).crop((k, cell // 2, cell, cell // 2 + 1)).resize((m, m))
    out.paste(top, (m, 0)); out.paste(bot, (m, 2 * m)); out.paste(lef, (0, m)); out.paste(rig, (2 * m, m))
    out.paste(Image.new('RGBA', (m, m), c(1, 1).getpixel((cell // 2, cell // 2))), (m, m))
    bb = out.getbbox()
    out = out.crop(bb)
    margins = (m - bb[0], m - (3 * m - bb[2]), m - bb[1], m - (3 * m - bb[3]))
    return out, margins


def build_ui(meta):
    os.makedirs(os.path.join(OUT, 'ui'), exist_ok=True)
    ui = os.path.join(TS, 'UI Elements', 'UI Elements')
    for name, rel in [('paper', 'Papers/RegularPaper.png'), ('btn_blue', 'Buttons/BigBlueButton_Regular.png'),
                      ('btn_red', 'Buttons/BigRedButton_Regular.png')]:
        img, mg = stitch_exploded(os.path.join(ui, *rel.split('/')))
        img.save(os.path.join(OUT, 'ui', f'{name}_9slice.png'))
        meta[f'ui_{name}'] = {'size': img.size, 'slice': mg}
        print(name, img.size, 'slice l,r,t,b =', mg)


def build_resource_icons(meta):
    os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
    res = os.path.join(TS, 'Terrain', 'Resources')
    for name, rel in [('wood', 'Wood/Wood Resource/Wood Resource.png'),
                      ('gold', 'Gold/Gold Resource/Gold_Resource.png'),
                      ('meat', 'Meat/Meat Resource/Meat Resource.png')]:
        im = Image.open(os.path.join(res, rel)).convert('RGBA')
        im.crop(im.getbbox()).save(os.path.join(OUT, 'icons', f'res_{name}.png'))


def build_signs(sheet, meta):
    sheet.crop((0, 13 * 32, 7 * 32, 14 * 32)).save(os.path.join(OUT, 'automation', 'signs.png'))
    meta['auto_signs'] = {'frameWidth': 32, 'frameHeight': 32, 'frames': 7}


def main():
    os.makedirs(os.path.join(OUT, 'automation'), exist_ok=True)
    sheet = Image.open(AUTO).convert('RGBA')
    meta = {}
    build_belt(sheet, meta)
    build_items(sheet, meta)
    build_machines(sheet, meta)
    build_signs(sheet, meta)
    build_ui(meta)
    build_resource_icons(meta)
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=2)


if __name__ == '__main__':
    main()
