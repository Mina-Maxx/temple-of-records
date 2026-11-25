#!/usr/bin/env python3
"""One-off image optimizer: generates WebP (q=78) and 768px-wide variants for assets/*.jpg."""
import os
from pathlib import Path
from PIL import Image

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

def main():
    for jpg_path in sorted(ASSETS_DIR.glob("*.jpg")):
        if jpg_path.stem.endswith("-768"):
            continue
        with Image.open(jpg_path) as im:
            im_rgb = im.convert("RGB")
            webp_path = jpg_path.with_suffix(".webp")
            im_rgb.save(webp_path, "WEBP", quality=78, method=6)

            w, h = im_rgb.size
            if w > 768:
                new_h = round(h * (768 / w))
                resized = im_rgb.resize((768, new_h), Image.Resampling.LANCZOS)
                resized.save(ASSETS_DIR / f"{jpg_path.stem}-768.webp", "WEBP", quality=78, method=6)
                resized.save(ASSETS_DIR / f"{jpg_path.stem}-768.jpg", "JPEG", quality=82, optimize=True)
            print(f"Optimized {jpg_path.name} ({w}x{h}) -> {webp_path.name}, -768 variants")

if __name__ == "__main__":
    main()
