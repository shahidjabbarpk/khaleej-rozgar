"""Khaleej Rozgar logo + all app / store images.

Three logo options (Shahid picks one):
  A  "arch briefcase" - white briefcase whose handle is a Gulf arch, gold sun dot, teal-green gradient
  B  "arch window"    - gold Gulf arch frame with a white briefcase inside, deep green
  C  "job pin"        - white location pin with a briefcase, gold ring, gradient
No text, flags, emblems or religious symbols in the icon (Play policy + reads well at 48 px).

  python scripts/make-icons.py            -> options sheet + app assets from option A
  python scripts/make-icons.py --option b -> app assets from option B
"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS, BRAND, STORE = ROOT / "assets", ROOT / "assets" / "brand", ROOT / "store-listing"
TEAL_A, TEAL_B = (5, 61, 44), (8, 160, 69)      # #053D2C -> #08A045
DEEP = (5, 61, 44)
PRIMARY = (11, 110, 79)                           # #0B6E4F
GOLD, WHITE = (212, 160, 23), (255, 255, 255)
CLEAR = (0, 0, 0, 0)
SS = 4


def gradient(w, h, a=TEAL_A, b=TEAL_B):
    v = Image.linear_gradient("L")                      # top -> bottom
    grad = Image.blend(v, v.rotate(90), 0.45).resize((w, h))  # diagonal mix, no empty corners
    return Image.composite(Image.new("RGB", (w, h), b), Image.new("RGB", (w, h), a), grad)


def rounded_bg(big, fill_img):
    im = Image.new("RGBA", (big, big), CLEAR)
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.22, fill=255)
    im.paste(fill_img, (0, 0), mask)
    return im


def pointed_arch(xa, xb, ymid, ytop, ybase, steps=60):
    """Gulf-style pointed arch: straight sides from ybase to ymid, curves meeting in a point at ytop."""
    cx = (xa + xb) / 2
    pts = [(xa, ybase), (xa, ymid)]
    for i in range(1, steps + 1):
        k = i / steps
        pts.append((xa + (cx - xa) * k, ymid - (ymid - ytop) * math.sin(k * math.pi / 2) ** 1.6))
    for i in range(steps - 1, -1, -1):
        k = i / steps
        pts.append((xb - (xb - cx) * k, ymid - (ymid - ytop) * math.sin(k * math.pi / 2) ** 1.6))
    pts += [(xb, ymid), (xb, ybase)]
    return pts


def briefcase(d, cx, cy, w, h, fill, hole=CLEAR):
    """Briefcase centred at cx,cy; the handle is a small pointed arch."""
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    hw, t = w * 0.2, w * 0.07
    d.polygon(pointed_arch(cx - hw, cx + hw, y0 - h * 0.08, y0 - h * 0.42, y0 + 2), fill=fill)
    d.polygon(pointed_arch(cx - hw + t, cx + hw - t, y0 - h * 0.06, y0 - h * 0.42 + t * 1.3, y0 + 4), fill=hole)
    d.rounded_rectangle((x0, y0, x1, y1), radius=h * 0.16, fill=fill)
    band = y0 + h * 0.36
    d.rectangle((x0, band - h * 0.04, x1, band + h * 0.04), fill=hole)
    lw, lh = w * 0.14, h * 0.22
    d.rounded_rectangle((cx - lw / 2, band - lh / 2, cx + lw / 2, band + lh / 2), radius=lw * 0.25, fill=fill)


def glyph_a(size, mono=None, bg=True):
    big = size * SS
    im = rounded_bg(big, gradient(big, big)) if bg else Image.new("RGBA", (big, big), CLEAR)
    d = ImageDraw.Draw(im)
    s = big
    briefcase(d, s * 0.5, s * 0.6, s * 0.6, s * 0.38, mono or WHITE, hole=CLEAR if not bg else CLEAR)
    if bg:  # holes show the gradient again
        hole = rounded_bg(big, gradient(big, big))
        im = Image.alpha_composite(hole, im)
        d = ImageDraw.Draw(im)
    r = s * 0.06
    d.ellipse((s * 0.5 - r, s * 0.145 - r, s * 0.5 + r, s * 0.145 + r), fill=mono or GOLD)
    return im.resize((size, size), Image.LANCZOS)


def glyph_b(size, mono=None, bg=True):
    big = size * SS
    s = big
    im = Image.new("RGBA", (big, big), CLEAR)
    d = ImageDraw.Draw(im)
    if bg:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.22, fill=DEEP)
    t = s * 0.055
    d.polygon(pointed_arch(s * 0.2, s * 0.8, s * 0.42, s * 0.1, s * 0.86), fill=mono or GOLD)
    d.polygon(pointed_arch(s * 0.2 + t, s * 0.8 - t, s * 0.43, s * 0.1 + t * 1.8, s * 0.86 - t), fill=DEEP if bg else CLEAR)
    briefcase(d, s * 0.5, s * 0.66, s * 0.4, s * 0.25, mono or WHITE, hole=DEEP if bg else CLEAR)
    return im.resize((size, size), Image.LANCZOS)


def glyph_c(size, mono=None, bg=True):
    big = size * SS
    s = big
    im = rounded_bg(big, gradient(big, big)) if bg else Image.new("RGBA", (big, big), CLEAR)
    d = ImageDraw.Draw(im)
    cx, cy, r = s * 0.5, s * 0.42, s * 0.25
    ring = s * 0.03
    d.ellipse((cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring), fill=mono or GOLD)
    d.polygon([(cx - r * 0.75, cy + r * 0.6), (cx + r * 0.75, cy + r * 0.6), (cx, s * 0.87)], fill=mono or WHITE)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=mono or WHITE)
    briefcase(d, cx, cy + s * 0.035, r * 1.1, r * 0.72, CLEAR if mono else PRIMARY, hole=mono or WHITE)
    return im.resize((size, size), Image.LANCZOS)


OPTIONS = {"a": glyph_a, "b": glyph_b, "c": glyph_c}


def font(size, bold=True):
    base = ROOT / "node_modules" / "@expo-google-fonts" / "poppins"
    f = base / ("700Bold/Poppins_700Bold.ttf" if bold else "400Regular/Poppins_400Regular.ttf")
    return ImageFont.truetype(str(f), size)


def feature_graphic(glyph):
    w, h = 1024, 500
    im = gradient(w, h).convert("RGBA")
    logo = glyph(300)
    im.paste(logo, (70, 100), logo)
    d = ImageDraw.Draw(im)
    d.text((410, 110), "Khaleej Rozgar", font=font(64), fill=WHITE)
    d.text((412, 198), "Gulf Jobs & Govt Jobs", font=font(36), fill=GOLD)
    d.text((412, 262), "Saudi Arabia · UAE · Qatar", font=font(30, False), fill=WHITE)
    d.text((412, 304), "Kuwait · Oman · Bahrain", font=font(30, False), fill=WHITE)
    d.text((412, 366), "Job alerts · Free job posts", font=font(26, False), fill=(220, 240, 230))
    return im.convert("RGB")


def main():
    pick = "a"
    if "--option" in sys.argv:
        pick = sys.argv[sys.argv.index("--option") + 1].lower()
    BRAND.mkdir(parents=True, exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGB", (3 * 360 + 80, 470), (247, 248, 246))
    d = ImageDraw.Draw(sheet)
    for i, (k, fn) in enumerate(OPTIONS.items()):
        icon = fn(320)
        icon.save(BRAND / f"option-{k}.png")
        sheet.paste(icon, (40 + i * 360, 40), icon)
        small = fn(48)
        sheet.paste(small, (40 + i * 360 + 136, 372), small)
        d.text((40 + i * 360 + 116, 425), f"Option {k.upper()}", font=font(24), fill=(29, 36, 32))
    sheet.save(BRAND / "logo-options.png")

    g = OPTIONS[pick]
    g(1024).save(ASSETS / "icon.png")
    g(512).convert("RGB").save(STORE / "icon-512.png")
    fg = Image.new("RGBA", (1024, 1024), CLEAR)
    inner = g(680, bg=False)
    fg.paste(inner, (172, 172), inner)
    fg.save(ASSETS / "android-icon-foreground.png")
    mono = Image.new("RGBA", (1024, 1024), CLEAR)
    m = g(680, mono=WHITE, bg=False)
    mono.paste(m, (172, 172), m)
    mono.save(ASSETS / "android-icon-monochrome.png")
    g(96, mono=WHITE, bg=False).save(ASSETS / "notification-icon.png")
    g(400, bg=False).save(ASSETS / "splash-icon.png")
    g(48).save(ASSETS / "favicon.png")
    feature_graphic(g).save(STORE / "feature-graphic-1024x500.png")
    print(f"logo option {pick.upper()} -> assets/ + store-listing/ ; options sheet: assets/brand/logo-options.png")


if __name__ == "__main__":
    main()
