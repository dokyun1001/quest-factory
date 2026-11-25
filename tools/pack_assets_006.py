#!/usr/bin/env python3
"""QUEST FACTORY 006 runtime asset packer.

Reads ONLY the approved package `QUEST_FACTORY_DEV_RESTART_006.zip` from the private
assets repository, verifies every inner package against ASSET_MANIFEST.json (SHA-256),
and packs an explicit allow-list of runtime images into ONE atlas texture.

Nothing from the legacy folders (vendor/, modified/, _archives/, previews/) is read.
Original source files are never copied to the build; only the packed atlas is shipped.

Usage:  python3 tools/pack_assets_006.py [--zip PATH] [--out DIR]
Default zip: <repo>/assets/QUEST_FACTORY_DEV_RESTART_006.zip   (private repo checkout)
Default out: <repo>/web/src/gen/
"""
import argparse, hashlib, io, json, os, sys, zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BELT_DIRS = ["WE", "WN", "WS", "EW", "EN", "ES", "NW", "NE", "NS", "SW", "SE", "SN"]
ITEMS = ["wood", "iron_ore", "gold_ore", "iron_ingot", "paper", "ink", "quest", "slime"]
ITEM_SIZES = [8, 10, 12]

PKG_005R = "packages/QUEST_FACTORY_ART_005R1_R2_VERIFIED_110FILES.zip"
PKG_CHAR = "packages/FRANUKA_CHARACTER_BASE_FREE_DEMO.zip"
PKG_HAIR = "packages/QUEST_FACTORY_ART_004.zip"
PKG_ICON = "packages/FRANUKA_RPG_ICON_FREE_DEMO.zip"
PKG_006R1 = "patch:QUEST_FACTORY_ART_006R1_CONNECTION_PATCH_41FILES.zip"   # ART 006-R1 (patch, separate zip)


def allow_list():
    """(frame_name, package, inner_path, crop) — crop=(x,y,w,h) or None for whole image."""
    out = []
    r = "QUEST_FACTORY_ART_005R/1x/"
    for d in BELT_DIRS:
        for f in range(4):
            out.append((f"belt_{d}_{f}", PKG_005R, f"{r}animated/{d}.png", (f * 16, 0, 16, 16)))
        out.append((f"dir_{d}", PKG_005R, f"{r}directions/{d}.png", None))
    for it in ITEMS:
        for s in ITEM_SIZES:
            out.append((f"item_{it}_{s}", PKG_005R, f"{r}items/{it}_{s}.png", None))
    out.append(("fac_miner", PKG_005R, f"{r}facilities/FAC_TEST_002_A_R1.png", None))
    out.append(("fac_smelter", PKG_005R, f"{r}facilities/FAC_TEST_003_A_R1.png", None))
    # Franuka Character Base FREE DEMO — Medium only (Big/Small excluded until verified)
    for skin in (1, 2, 3):
        for anim in ("idle", "walk"):
            out.append((f"body_M{skin}_{anim}", PKG_CHAR, f"1x/Medium_0{skin}_{anim}.png", None))
    for anim in ("idle", "walk"):
        out.append((f"shirt_M_{anim}", PKG_CHAR, f"1x/Medium_shirt_{anim}.png", None))
        out.append((f"hair_001_{anim}", PKG_HAIR, f"QUEST_FACTORY_ART_004/1x/HAIR_001_{anim}.png", None))
    # Franuka RPG Icon demo — only icons whose meaning matches a real UI function
    ic = "Individual icons (16x16)/"
    out.append(("ui_storage", PKG_ICON, ic + "27.png", None))   # chest  -> storage
    out.append(("ui_save", PKG_ICON, ic + "34.png", None))      # floppy -> save
    out.append(("ui_settings", PKG_ICON, ic + "35.png", None))  # gear   -> settings
    # ART 006-R1: 1x1 small miner (4 dirs) + furnace (4 dirs, off / active 6f / ember 6f, precomposed)
    for d in "NESW":
        out.append((f"miner_s_{d}", PKG_006R1, f"1x/miner/small_miner_{d}.png", None))
        out.append((f"furnace_{d}_off", PKG_006R1, f"1x/furnace/furnace_{d}_off.png", None))
        for st in ("active", "ember"):
            for f in range(6):
                out.append((f"furnace_{d}_{st}_{f}", PKG_006R1, f"1x/furnace/furnace_{d}_{st}_sheet.png", (f * 32, 0, 32, 32)))
    return out


def strip(o, keys=("edge_signature_rgba", "edge_pixels_rgba", "source_preserved_sha256")):
    if isinstance(o, dict):
        return {k: strip(v) for k, v in o.items() if k not in keys}
    if isinstance(o, list):
        return [strip(v) for v in o]
    return o


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default=os.path.join(ROOT, "assets", "QUEST_FACTORY_DEV_RESTART_006.zip"))
    ap.add_argument("--patch-dir", default=os.path.join(ROOT, "assets", "patches"))
    ap.add_argument("--out", default=os.path.join(ROOT, "web", "src", "gen"))
    a = ap.parse_args()
    if not os.path.isfile(a.zip):
        sys.exit(f"[pack] missing {a.zip}\n  Clone the private repo dokyun1001/quest-factory-assets into ./assets first.")

    outer = zipfile.ZipFile(a.zip)
    manifest = json.loads(outer.read("ASSET_MANIFEST.json"))
    expected = {p["path"]: p["sha256"] for p in manifest["packages"]}

    inner = {}
    patch_manifest = json.load(open(os.path.join(a.patch_dir, "PATCH_MANIFEST.json")))
    patch_sha = {os.path.basename(p["path"]): p["sha256"] for p in patch_manifest["packages"]}
    def pkg(path):
        if path.startswith("patch:"):
            name = path[6:]
            if path not in inner:
                data = open(os.path.join(a.patch_dir, name), "rb").read()
                if sha(data) != patch_sha.get(name):
                    sys.exit(f"[pack] SHA-256 mismatch for patch {name}")
                inner[path] = zipfile.ZipFile(io.BytesIO(data))
            return inner[path]
        if path not in inner:
            data = outer.read(path)
            got = sha(data)
            if got != expected.get(path):
                sys.exit(f"[pack] SHA-256 mismatch for {path}: {got} != {expected.get(path)}")
            inner[path] = zipfile.ZipFile(io.BytesIO(data))
        return inner[path]

    frames, provenance = [], []
    for name, p, inner_path, crop in allow_list():
        raw = pkg(p).read(inner_path)
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        if crop:
            x, y, w, h = crop
            im = im.crop((x, y, x + w, y + h))
        frames.append((name, im))
        provenance.append({"frame": name, "package": os.path.basename(p.replace("patch:", "")), "file": inner_path, "sha256": sha(raw)})

    # Shelf packing, 1px edge extrusion + 1px gap (prevents texture bleeding at any zoom)
    PAD = 2
    frames.sort(key=lambda f: (-f[1].height, -f[1].width, f[0]))
    W = 512
    x = y = shelf_h = 0
    rects = {}
    for name, im in frames:
        w, h = im.width + PAD * 2, im.height + PAD * 2
        if x + w > W:
            x, y, shelf_h = 0, y + shelf_h, 0
        rects[name] = (x + PAD, y + PAD)
        x += w
        shelf_h = max(shelf_h, h)
    H = 1
    while H < y + shelf_h:
        H *= 2
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for name, im in frames:
        fx, fy = rects[name]
        # extrude edges by 1px
        atlas.paste(im.crop((0, 0, im.width, 1)), (fx, fy - 1))
        atlas.paste(im.crop((0, im.height - 1, im.width, im.height)), (fx, fy + im.height))
        atlas.paste(im.crop((0, 0, 1, im.height)), (fx - 1, fy))
        atlas.paste(im.crop((im.width - 1, 0, im.width, im.height)), (fx + im.width, fy))
        atlas.paste(im, (fx, fy))

    os.makedirs(a.out, exist_ok=True)
    buf = io.BytesIO()
    atlas.save(buf, "PNG", optimize=True)
    png = buf.getvalue()
    with open(os.path.join(a.out, "atlas.png"), "wb") as f:
        f.write(png)
    jf = {"frames": {}, "meta": {"image": "atlas.png", "size": {"w": W, "h": H}, "format": "RGBA8888", "scale": "1"}}
    for name, im in frames:
        fx, fy = rects[name]
        jf["frames"][name] = {"frame": {"x": fx, "y": fy, "w": im.width, "h": im.height}, "rotated": False,
                              "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height},
                              "sourceSize": {"w": im.width, "h": im.height}}
    with open(os.path.join(a.out, "atlas.json"), "w") as f:
        json.dump(jf, f, separators=(",", ":"))

    hair_pal = json.loads(pkg(PKG_HAIR).read("QUEST_FACTORY_ART_004/Specs/hair_palettes.json"))
    art005 = json.loads(pkg(PKG_005R).read("QUEST_FACTORY_ART_005R/metadata.json"))
    meta = {
        "generated_by": "tools/pack_assets_006.py",
        "source_package": os.path.basename(a.zip),
        "atlas_sha256": sha(png),
        "atlas_size": [W, H],
        "frame_count": len(frames),
        "hair_palettes": hair_pal,
        "belt": {k: art005["belt"][k] for k in ("frame_ms", "frame_count", "direction_semantics")},
        "facilities": art005["facilities"],
        "art006r1": {k: strip(v) for k, v in json.loads(pkg(PKG_006R1).read("metadata.json")).items() if k in ("miner", "furnace", "revision", "limitations", "patch_base")},
        "provenance": provenance,
    }
    with open(os.path.join(a.out, "artmeta.json"), "w") as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
    with open(os.path.join(a.out, "artmeta.js"), "w") as f:   # same data as an ES module (usable from Node tests)
        f.write("export default " + json.dumps({k: v for k, v in meta.items() if k != "provenance"}, ensure_ascii=False) + ";\n")
    print(f"[pack] {len(frames)} frames -> atlas {W}x{H} ({len(png)} bytes) sha256={meta['atlas_sha256'][:16]}")


if __name__ == "__main__":
    main()
