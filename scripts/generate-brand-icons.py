#!/usr/bin/env python3
"""Generate every app/PWA/favicon asset from the single official FyneStudy logo.

Source of truth: brand/fynestudy-logo-master.png (shield mark + white wordmark).
Run from repo root:  python scripts/generate-brand-icons.py

Regenerates icons for: apps/mobile, apps/web, apps/admin.
Idempotent — safe to re-run whenever the master logo changes.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "brand", "fynestudy-logo-master.png")

WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


def log(msg):
    print(msg)


def extract_shield(master_path):
    """Isolate the blue shield mark from the full lockup (shield + white wordmark).

    The shield is blue-dominant (B > R); the wordmark is white (B ~= R). We build a
    blue-dominance mask, take its bounding box, then alpha-trim for a tight crop.
    """
    im = Image.open(master_path).convert("RGBA")
    import numpy as np

    arr = np.asarray(im).astype(np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    blue_mask = (b - r > 25) & (a > 40)
    ys, xs = np.where(blue_mask)
    if len(xs) == 0:
        raise SystemExit("No blue shield pixels found — check the master logo.")
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    # small pad, clamped so we never reach into the wordmark on the right
    pad = 4
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width - 1, x1 + pad)
    y1 = min(im.height - 1, y1 + pad)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    # alpha-trim to remove any fully-transparent border the pad re-added
    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)
    log(f"shield crop: {crop.size}  (from master bbox x[{x0}:{x1}] y[{y0}:{y1}])")
    return crop


def fit_centered(shield, canvas_size, scale, bg):
    """Return a square RGBA canvas (canvas_size) with the shield centered,
    scaled so its longest side == canvas_size*scale, over background `bg`."""
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg)
    target = int(round(canvas_size * scale))
    w, h = shield.size
    ratio = min(target / w, target / h)
    new = (max(1, int(round(w * ratio))), max(1, int(round(h * ratio))))
    s = shield.resize(new, Image.LANCZOS)
    ox = (canvas_size - new[0]) // 2
    oy = (canvas_size - new[1]) // 2
    canvas.alpha_composite(s, (ox, oy))
    return canvas


def monochrome(shield, canvas_size, scale):
    """White shield silhouette with the F-bars knocked out, on transparent —
    for Android 13+ themed icons. Blue area -> opaque white; white F -> stays clear."""
    import numpy as np

    arr = np.asarray(shield).astype(np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    is_blue = (b - r > 12) & (a > 40)
    out = np.zeros((shield.height, shield.width, 4), dtype=np.uint8)
    out[is_blue] = [255, 255, 255, 255]
    mono = Image.fromarray(out, "RGBA")
    return fit_centered(mono, canvas_size, scale, TRANSPARENT)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    log(f"  wrote {os.path.relpath(path, ROOT)}  {img.size}")


def main():
    if not os.path.exists(MASTER):
        raise SystemExit(f"Missing master logo: {MASTER}")
    shield = extract_shield(MASTER)

    M = os.path.join(ROOT, "apps", "mobile", "assets", "images")
    W = os.path.join(ROOT, "apps", "web", "public")
    A = os.path.join(ROOT, "apps", "admin")

    log("mobile:")
    # iOS / legacy launcher icon — opaque white bg, no transparency allowed on iOS
    save(fit_centered(shield, 1024, 0.72, WHITE), os.path.join(M, "icon.png"))
    # splash — transparent shield, OS contains it at imageWidth=200
    save(fit_centered(shield, 1024, 0.80, TRANSPARENT), os.path.join(M, "splash-icon.png"))
    # adaptive foreground — keep inside the 66% safe keyline so the mask never clips the F
    save(fit_centered(shield, 1024, 0.58, TRANSPARENT), os.path.join(M, "android-icon-foreground.png"))
    # adaptive background — solid white tile
    save(Image.new("RGBA", (1024, 1024), WHITE), os.path.join(M, "android-icon-background.png"))
    # themed monochrome
    save(monochrome(shield, 1024, 0.58), os.path.join(M, "android-icon-monochrome.png"))
    # expo-web favicon
    save(fit_centered(shield, 512, 0.86, TRANSPARENT), os.path.join(M, "favicon.png"))
    # in-app logo mark (FyneStudyLogo component, sits next to wordmark text)
    save(fit_centered(shield, 512, 0.96, TRANSPARENT), os.path.join(M, "fyne-mark.png"))

    log("web (PWA + tab favicon):")
    # PWA 'any' icons + apple-touch + tab favicon — opaque white (Apple forbids alpha)
    save(fit_centered(shield, 192, 0.74, WHITE), os.path.join(W, "icons", "icon-192.png"))
    save(fit_centered(shield, 512, 0.74, WHITE), os.path.join(W, "icons", "icon-512.png"))
    # maskable — extra safe padding for the platform crop
    save(fit_centered(shield, 512, 0.56, WHITE), os.path.join(W, "icons", "icon-maskable-512.png"))
    # in-app logo component (sits on colored surfaces) — transparent
    save(fit_centered(shield, 512, 0.92, TRANSPARENT), os.path.join(W, "brand", "fyne-mark.png"))

    log("admin:")
    save(fit_centered(shield, 512, 0.92, TRANSPARENT), os.path.join(A, "public", "brand", "fyne-mark.png"))
    save(fit_centered(shield, 512, 0.84, TRANSPARENT), os.path.join(A, "app", "icon.png"))
    # multi-size tab favicon on white (visible on any browser tab bar)
    ico = fit_centered(shield, 256, 0.80, WHITE)
    ico_path = os.path.join(A, "app", "favicon.ico")
    ico.save(ico_path, sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
    log(f"  wrote {os.path.relpath(ico_path, ROOT)}  ico[16,32,48,256]")

    log("done.")


if __name__ == "__main__":
    main()
