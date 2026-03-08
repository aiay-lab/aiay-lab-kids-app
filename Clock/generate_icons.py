"""
とけいアプリ アイコン生成スクリプト
アプリの時計SVGデザインを忠実に再現します（10:10 表示）

Pillow が必要: pip install Pillow
"""

import os, math
from PIL import Image, ImageDraw, ImageFont

os.makedirs('icons', exist_ok=True)

# アプリのカラー定義
BODY  = (0xE8, 0x40, 0x5A)  # 赤 #E8405A
RING  = (0xF5, 0xC0, 0x10)  # 黄 #F5C010
DARK  = (0x1A, 0x1A, 0x1A)  # ほぼ黒
BLUE  = (0x15, 0x65, 0xC0)  # 分針の青 #1565c0
WHITE = (0xFF, 0xFF, 0xFF)
BG    = (0xFF, 0xF9, 0xC4)  # 背景黄 #fff9c4


def draw_rotated_ellipse(img, px_fn, scale, cx, cy, rx, ry, angle_deg, color):
    """SVG の transform=rotate(angle, cx, cy) 付き楕円を描画"""
    prx = max(1.0, rx * scale)
    pry = max(1.0, ry * scale)
    sz  = int(max(prx, pry) * 3) + 4
    tmp = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
    td  = ImageDraw.Draw(tmp)
    c   = sz / 2
    td.ellipse([c - prx, c - pry, c + prx, c + pry], fill=color + (255,))
    tmp = tmp.rotate(-angle_deg, resample=Image.BICUBIC, expand=False)
    pcx, pcy = px_fn(cx, cy)
    img.paste(tmp, (int(pcx - sz / 2), int(pcy - sz / 2)), tmp)


def make_icon(size):
    # SVG viewBox: -120 -130 240 262
    # → 幅240, 高さ262。正方形アイコンに収めるため高さ基準でスケール、左右を中央揃え
    scale = size / 262
    off_x = (size - 240 * scale) / 2

    def svgpx(sx, sy):
        return ((sx + 120) * scale + off_x, (sy + 130) * scale)

    def bbox(cx, cy, r):
        x, y = svgpx(cx, cy)
        pr = r * scale
        return [x - pr, y - pr, x + pr, y + pr]

    # RGBA で描画（ペースト用）
    img = Image.new('RGBA', (size, size), BG + (255,))
    d   = ImageDraw.Draw(img)

    # ---- 本体 ----
    d.ellipse(bbox(0, 0, 104), fill=DARK + (255,))
    d.ellipse(bbox(0, 0, 100), fill=BODY + (255,))

    # ---- 黄金リング ----
    d.ellipse(bbox(0, 0, 91), fill=DARK + (255,))
    d.ellipse(bbox(0, 0, 88), fill=RING + (255,))

    # ---- 文字盤 ----
    d.ellipse(bbox(0, 0, 80), fill=WHITE + (255,))

    # ---- 目盛り ----
    for i in range(60):
        a     = (i * 6 - 90) * math.pi / 180
        major = (i % 5 == 0)
        r_in  = 68 if major else 74
        lw    = max(1, round((3 if major else 1) * scale))
        x1, y1 = svgpx(r_in * math.cos(a), r_in * math.sin(a))
        x2, y2 = svgpx(79   * math.cos(a), 79   * math.sin(a))
        d.line([x1, y1, x2, y2], fill=DARK + (255,), width=lw)

    # ---- 数字 ----
    font_size = max(8, round(14 * scale))
    font = None
    for candidate in [
        r'C:\Windows\Fonts\arialbd.ttf',
        r'C:\Windows\Fonts\arial.ttf',
        r'C:\Windows\Fonts\calibrib.ttf',
        r'C:\Windows\Fonts\calibri.ttf',
    ]:
        try:
            font = ImageFont.truetype(candidate, font_size)
            break
        except Exception:
            pass
    if font is None:
        font = ImageFont.load_default()

    for h in range(1, 13):
        a    = (h * 30 - 90) * math.pi / 180
        x, y = svgpx(62 * math.cos(a), 62 * math.sin(a))
        text = str(h)
        bb   = d.textbbox((0, 0), text, font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        d.text((x - tw / 2 - bb[0], y - th / 2 - bb[1]), text, fill=DARK + (255,), font=font)

    # ---- 針: 10時10分 ----
    hour_deg = 10 * 30 + 10 * 0.5 - 90  # 215°
    min_deg  = 10 * 6  - 90              # -30° (330°)

    def hand(deg, tip_len, tail_len, col, stroke_w):
        r  = math.radians(deg)
        r2 = math.radians(deg + 180)
        x1, y1 = svgpx(tail_len * math.cos(r2), tail_len * math.sin(r2))
        x2, y2 = svgpx(tip_len  * math.cos(r),  tip_len  * math.sin(r))
        lw = max(1, round(stroke_w * scale))
        d.line([x1, y1, x2, y2], fill=col + (255,), width=lw)

    hand(min_deg,  66, 12, BLUE, 4)
    hand(hour_deg, 46, 10, DARK, 6)

    # ---- 中心点 ----
    d.ellipse(bbox(0, 0, 7), fill=DARK  + (255,))
    d.ellipse(bbox(0, 0, 4), fill=WHITE + (255,))

    # ---- 足（回転楕円） ----
    draw_rotated_ellipse(img, svgpx, scale, -38, 108, 18, 10, -25, DARK)
    draw_rotated_ellipse(img, svgpx, scale, -38, 108, 15,  8, -25, BODY)
    draw_rotated_ellipse(img, svgpx, scale,  38, 108, 18, 10,  25, DARK)
    draw_rotated_ellipse(img, svgpx, scale,  38, 108, 15,  8,  25, BODY)

    return img.convert('RGB')


for size in [180, 192, 512]:
    img  = make_icon(size)
    path = f'icons/icon-{size}.png'
    img.save(path)
    print(f'生成: {path}')

print('完了！')
