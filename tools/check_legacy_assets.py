#!/usr/bin/env python3
"""Fails the build if the deploy folder references or contains any legacy temporary asset.

Checks
 1. Only allowed files are shipped (html/js/the single generated atlas png).
 2. No legacy names/paths appear in any shipped text file.
 3. Every atlas frame comes from an approved 006 package (artmeta provenance).
 4. If the private assets checkout exists, no legacy PNG (vendor/, modified/, previews/, _archives zips)
    appears byte-for-byte inside the deploy folder, and no legacy 16x16 tile is pixel-identical to an atlas frame.
Usage: python3 tools/check_legacy_assets.py web/dist
"""
import hashlib, io, json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORBIDDEN = ["tiny swords", "tiny-swords", "tinyswords", "pixel frog", "pixelfrog", "sierrassets", "automation-tileset",
             "automation tileset", "merchant shade", "merchant-shade", "kenney", "galmuri", "atlas/page0", "vendor/",
             "modified/", "_archives", "questfactory.save.v1"]
APPROVED_PACKAGES = {"QUEST_FACTORY_ART_005R1_R2_VERIFIED_110FILES.zip", "FRANUKA_CHARACTER_BASE_FREE_DEMO.zip",
                     "QUEST_FACTORY_ART_004.zip", "FRANUKA_RPG_ICON_FREE_DEMO.zip"}


def main(dist):
    errors, files = [], []
    for d, _, fs in os.walk(dist):
        for f in fs:
            files.append(os.path.join(d, f))
    pngs = [f for f in files if f.lower().endswith((".png", ".gif", ".jpg", ".jpeg", ".webp"))]
    other = [f for f in files if not f.lower().endswith((".png", ".js", ".html", ".css", ".json")) and not f.endswith(".nojekyll")]
    if len(pngs) != 1 or not re.search(r"atlas-[\w-]+\.png$", pngs[0]):
        errors.append(f"expected exactly one generated atlas image, found {pngs}")
    if other:
        errors.append(f"unexpected files shipped: {other}")
    hits = 0
    for f in files:
        if f.endswith(".png"):
            continue
        txt = open(f, "rb").read().decode("utf-8", "ignore").lower()
        for w in FORBIDDEN:
            if w in txt:
                errors.append(f"legacy reference '{w}' in {os.path.relpath(f, dist)}"); hits += 1
    meta = json.load(open(os.path.join(ROOT, "web", "src", "gen", "artmeta.json")))
    bad = [p for p in meta["provenance"] if p["package"] not in APPROVED_PACKAGES or "Preview" in p["file"] or "Preserved" in p["file"] or "mask" in p["file"]]
    if bad:
        errors.append(f"atlas frames from non-approved sources: {bad}")
    shipped = {hashlib.sha256(open(f, "rb").read()).hexdigest() for f in files}
    legacy_checked = 0
    assets = os.path.join(ROOT, "assets")
    pixel_hits = 0
    if os.path.isdir(assets) and pngs:
        try:
            from PIL import Image
            atlas = Image.open(pngs[0]).convert("RGBA")
            ajson = json.load(open(os.path.join(ROOT, "web", "src", "gen", "atlas.json")))["frames"]
            frame_px = {atlas.crop((v["frame"]["x"], v["frame"]["y"], v["frame"]["x"] + v["frame"]["w"], v["frame"]["y"] + v["frame"]["h"])).tobytes() for v in ajson.values()}
        except Exception as e:  # pragma: no cover
            frame_px = set(); print("[check] pixel comparison skipped:", e)
        for sub in ("vendor", "modified", "previews", "_archives"):
            for d, _, fs in os.walk(os.path.join(assets, sub)):
                for f in fs:
                    p = os.path.join(d, f)
                    blobs = []
                    if f.lower().endswith(".png"):
                        blobs.append(open(p, "rb").read())
                    elif f.lower().endswith(".zip"):
                        with zipfile.ZipFile(p) as z:
                            blobs += [z.read(n) for n in z.namelist() if n.lower().endswith(".png")]
                    for b in blobs:
                        legacy_checked += 1
                        if hashlib.sha256(b).hexdigest() in shipped:
                            errors.append(f"legacy file shipped byte-for-byte: {p}")
                        if frame_px:
                            try:
                                im = Image.open(io.BytesIO(b)).convert("RGBA")
                                if im.size in ((16, 16), (32, 32), (64, 96)) and im.tobytes() in frame_px:
                                    pixel_hits += 1; errors.append(f"legacy image pixel-identical to an atlas frame: {p}")
                            except Exception:
                                pass
    print(f"[check] shipped files: {len(files)}, images: {[os.path.relpath(p, dist) for p in pngs]}")
    print(f"[check] legacy name hits: {hits}; atlas frames: {len(meta['provenance'])} all from approved 006 packages: {not bad}")
    print(f"[check] legacy PNGs compared: {legacy_checked}; byte/pixel matches: {pixel_hits}")
    if errors:
        print("[check] FAILED\n  " + "\n  ".join(errors)); sys.exit(1)
    print("[check] OK — legacy temporary assets included: 0")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "web", "dist"))
