"""
すうじアプリ アイコン生成スクリプト

Pillow が必要: pip install Pillow
"""

import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('icons', exist_ok=True)

BG      = (0xE3, 0xF2, 0xFD)  # 薄青 #e3f2fd
BLUE    = (0x15, 0x65, 0xC0)  # 青  #1565c0
GREEN   = (0x43, 0xA0, 0x47)  # 緑  #43a047
RED     = (0xE5, 0x39, 0x35)  # 赤  #e53935
WHITE   = (0xFF, 0xFF, 0xFF)
DARK    = (0x1A, 0x1A, 0x1A)


def make_icon(size):
    img = Image.new('RGB', (size, size), BG)
    d   = ImageDraw.Draw(img)

    # 外枠の丸角四角（青）
    margin = int(size * 0.06)
    r      = int(size * 0.18)
    d.rounded_rectangle([margin, margin, size - margin, size - margin],
                        radius=r, fill=BLUE)

    # 内側の白い丸角四角
    pad = int(size * 0.10)
    d.rounded_rectangle([pad, pad, size - pad, size - pad],
                        radius=int(r * 0.7), fill=WHITE)

    # "123" をそれぞれ色付きで描画
    digits      = [('1', BLUE), ('2', GREEN), ('3', RED)]
    font_size   = max(10, int(size * 0.30))

    font = None
    for candidate in [
        r'C:\Windows\Fonts\arialbd.ttf',
        r'C:\Windows\Fonts\Arial Bold.ttf',
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

    # 各文字の幅を測って横並びに配置
    bboxes = [d.textbbox((0, 0), ch, font=font) for ch, _ in digits]
    widths = [bb[2] - bb[0] for bb in bboxes]
    heights= [bb[3] - bb[1] for bb in bboxes]
    gap    = int(size * 0.03)
    total_w = sum(widths) + gap * (len(digits) - 1)
    cx, cy  = size // 2, size // 2

    x = cx - total_w // 2
    for i, ((ch, color), bb, w, h) in enumerate(zip(digits, bboxes, widths, heights)):
        y = cy - h // 2 - bb[1]
        d.text((x - bb[0], y), ch, fill=color, font=font)
        x += w + gap

    return img


for size in [180, 192, 512]:
    img  = make_icon(size)
    path = f'icons/icon-{size}.png'
    img.save(path)
    print(f'生成: {path}')

print('完了！')
