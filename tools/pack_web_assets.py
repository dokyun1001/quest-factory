"""Pack every texture listed in web/src/art/textures.json into a few atlas pages.

Input : assets/  (the private quest-factory-assets repo, checked out into this folder)
Output: web/.gen/atlas/page{N}.png + page{N}.json  (Phaser JSON-hash atlases)
        web/.gen/atlas/index.json                  (texture key -> page, frame size)
        web/.gen/fonts/*                           (Galmuri pixel font, OFL)

The raw pack files are never published as-is: only these game-specific atlas pages
go into the web build (the asset licenses forbid redistributing the original files).
"""
import json, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.environ.get('QF_ASSETS', os.path.join(ROOT, 'assets'))
WEB = os.path.join(ROOT, 'web')
OUT = os.path.join(WEB, '.gen')
PAGE = 4096
PAD = 2


def main():
    tex = json.load(open(os.path.join(WEB, 'src', 'art', 'textures.json'), encoding='utf8'))
    if not os.path.isdir(os.path.join(ASSETS, 'vendor')):
        sys.exit(f'assets not found at {ASSETS} — clone dokyun1001/quest-factory-assets into ./assets')
    imgs = {}
    for key, t in tex.items():
        imgs[key] = Image.open(os.path.join(ASSETS, t['path'])).convert('RGBA')

    # shelf packing, tallest first
    order = sorted(imgs, key=lambda k: (-imgs[k].height, -imgs[k].width))
    pages, place = [], {}
    cur = None
    for k in order:
        w, h = imgs[k].size
        placed = False
        for pi, pg in enumerate(pages):
            for shelf in pg['shelves']:
                if h <= shelf['h'] and shelf['x'] + w <= PAGE:
                    place[k] = (pi, shelf['x'], shelf['y']); shelf['x'] += w + PAD; placed = True; break
            if placed:
                break
            if pg['y'] + h <= PAGE and w <= PAGE:
                pg['shelves'].append({'y': pg['y'], 'h': h, 'x': w + PAD})
                place[k] = (pi, 0, pg['y']); pg['y'] += h + PAD; placed = True; break
        if not placed:
            pages.append({'shelves': [{'y': 0, 'h': h, 'x': w + PAD}], 'y': h + PAD})
            place[k] = (len(pages) - 1, 0, 0)

    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(os.path.join(OUT, 'atlas'))
    index = {'pages': [], 'textures': {}}
    for pi, pg in enumerate(pages):
        # no power-of-two padding: only the used height (rounded to 16) goes to the GPU
        hpow = (pg['y'] + 15) // 16 * 16
        canvas = Image.new('RGBA', (PAGE, hpow), (0, 0, 0, 0))
        frames = {}
        for k, (p, x, y) in place.items():
            if p != pi:
                continue
            canvas.paste(imgs[k], (x, y))
            w, h = imgs[k].size
            frames[k] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                         'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
        name = f'page{pi}'
        canvas.save(os.path.join(OUT, 'atlas', name + '.png'), optimize=True)
        json.dump({'frames': frames, 'meta': {'image': name + '.png', 'size': {'w': PAGE, 'h': hpow}, 'scale': '1'}},
                  open(os.path.join(OUT, 'atlas', name + '.json'), 'w'))
        index['pages'].append(name)
        print(f'{name}: {PAGE}x{hpow}, {len(frames)} textures')
    for k, t in tex.items():
        w, h = imgs[k].size
        index['textures'][k] = {'page': f'page{place[k][0]}', 'fw': t.get('fw', w), 'fh': t.get('fh', h)}
    json.dump(index, open(os.path.join(OUT, 'atlas', 'index.json'), 'w'), indent=1)

    fonts = os.path.join(WEB, 'node_modules', 'galmuri', 'dist')
    os.makedirs(os.path.join(OUT, 'fonts'))
    for f in ('Galmuri11.woff2', 'Galmuri11-Bold.woff2'):
        shutil.copy(os.path.join(fonts, f), os.path.join(OUT, 'fonts', f))


if __name__ == '__main__':
    main()
