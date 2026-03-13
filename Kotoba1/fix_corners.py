"""
全SVGファイルに rounded corner clip-path を適用する。
- すでに <g clip-path="url(#frame)"> でラップ済みのファイルはスキップ
- それ以外は <defs> に clipPath を追加し、コンテンツ全体を <g clip-path="url(#frame)"> でラップ
"""
import os
import re

IMAGE_DIR = "C:/ygami_data/DevWorks/aiay-lab-kids-app/WordAnime/image"

CLIP_DEF = '<clipPath id="frame"><rect width="300" height="300" rx="20"/></clipPath>'
WRAP_OPEN = '\n  <g clip-path="url(#frame)">'
WRAP_CLOSE = '</g>\n'


def fix_svg(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # すでに正しくラップ済みならスキップ
    if '<g clip-path="url(#frame)">' in content:
        return "SKIP"

    # --- 1. <defs> に clipPath を追加 ---
    if '<defs>' in content:
        # 既存 <defs> の直後に挿入
        content = content.replace('<defs>', '<defs>\n    ' + CLIP_DEF, 1)
    else:
        # <defs> がない場合: <svg ...> の直後に <defs> ブロックを挿入
        content = re.sub(
            r'(<svg\b[^>]*>)',
            r'\1\n  <defs>\n    ' + CLIP_DEF + r'\n  </defs>',
            content, count=1
        )

    # --- 2. </defs> の直後に <g clip-path="..."> を挿入 ---
    defs_end = content.find('</defs>')
    if defs_end != -1:
        insert_at = defs_end + len('</defs>')
        content = content[:insert_at] + WRAP_OPEN + content[insert_at:]
    else:
        # defs がなかった（＝追加したが </defs> が別の場所にある）パターンのフォールバック
        content = re.sub(
            r'(<svg\b[^>]*>)',
            r'\1' + WRAP_OPEN,
            content, count=1
        )

    # --- 3. </svg> の直前に </g> を挿入 ---
    last_svg = content.rfind('</svg>')
    if last_svg != -1:
        content = content[:last_svg] + WRAP_CLOSE + content[last_svg:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return "FIXED"


def main():
    files = sorted(f for f in os.listdir(IMAGE_DIR) if f.endswith('.svg'))
    fixed, skipped = [], []

    for fname in files:
        path = os.path.join(IMAGE_DIR, fname)
        result = fix_svg(path)
        if result == "FIXED":
            fixed.append(fname)
        else:
            skipped.append(fname)

    print(f"\n✅ 修正済み ({len(fixed)} ファイル):")
    for f in fixed:
        print(f"   {f}")
    print(f"\n⏭️  スキップ (既に正しい) ({len(skipped)} ファイル):")
    for f in skipped:
        print(f"   {f}")


if __name__ == "__main__":
    main()
