"""
aiay-lab-kids-app デプロイスクリプト

使い方:
  python deploy.py

動作:
  1. 現在のバージョンを表示
  2. 新しいバージョンを入力（Enter で自動インクリメント）
  3. version.json / sw.js / Clock.html を更新
  4. main にコミット → release にマージ → 両方 push
"""

import subprocess, json, re, sys
from pathlib import Path

ROOT = Path(__file__).parent
GITHUB_PAGES_URL = 'https://aiay-lab.github.io/aiay-lab-kids-app/Clock/Clock.html'

# ---- ファイルパス定義 ----
# アプリを追加したらここに追加する
APP_FILES = {
    'Clock': {
        'sw':   ROOT / 'Clock' / 'sw.js',
        'html': ROOT / 'Clock' / 'Clock.html',
        'cache_name_prefix': 'tokei-app',
    },
}


def run(cmd):
    result = subprocess.run(cmd, cwd=ROOT, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'  エラー: {result.stderr.strip()}')
        sys.exit(1)
    return result.stdout.strip()


def bump(version, kind):
    ma, mi, pa = map(int, version.split('.'))
    if kind == 'major': return f'{ma + 1}.0.0'
    if kind == 'minor': return f'{ma}.{mi + 1}.0'
    return f'{ma}.{mi}.{pa + 1}'


# ---- 現在バージョン読み込み ----
version_file = ROOT / 'version.json'
current = json.loads(version_file.read_text(encoding='utf-8'))['version']

print('=' * 40)
print(f'  現在のバージョン: {current}')
print(f'  リリースURL: {GITHUB_PAGES_URL}')
print('=' * 40)

bump_ver = input('\nバージョンを上げますか？ [Y/n]: ').strip().lower()
if bump_ver in ('', 'y', 'yes'):
    print(f'  (1) パッチ  → {bump(current, "patch")}')
    print(f'  (2) マイナー → {bump(current, "minor")}')
    print(f'  (3) メジャー → {bump(current, "major")}')
    choice = input('選択 [1]: ').strip() or '1'
    kind_map = {'1': 'patch', '2': 'minor', '3': 'major'}
    if choice not in kind_map:
        print('1〜3 で選んでください')
        sys.exit(1)
    new_ver = bump(current, kind_map[choice])
else:
    new_ver = current

if new_ver != current:
    print(f'\n{current} → {new_ver} に更新します\n')

    # ---- version.json 更新 ----
    version_file.write_text(
        json.dumps({'version': new_ver}, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8'
    )
    print('[OK] version.json')
else:
    print(f'\nバージョンそのまま ({current}) でデプロイします\n')

# ---- 各アプリのファイル更新 ----
for app_name, paths in APP_FILES.items():
    # sw.js の CACHE_NAME 更新
    sw_path = paths['sw']
    prefix  = paths['cache_name_prefix']
    sw_text = sw_path.read_text(encoding='utf-8')
    sw_text = re.sub(
        rf"const CACHE_NAME = '{re.escape(prefix)}-v[\d.]+';",
        f"const CACHE_NAME = '{prefix}-v{new_ver}';",
        sw_text
    )
    sw_path.write_text(sw_text, encoding='utf-8')
    print(f'[OK] {app_name}/sw.js')

    # HTML の <meta name="version"> 更新
    html_path = paths['html']
    html_text = html_path.read_text(encoding='utf-8')
    html_text = re.sub(
        r'<meta name="version" content="[\d.]+">',
        f'<meta name="version" content="{new_ver}">',
        html_text
    )
    html_text = re.sub(
        r'© aiay-lab  v[\d.]+',
        f'© aiay-lab  v{new_ver}',
        html_text
    )
    html_path.write_text(html_text, encoding='utf-8')
    print(f'[OK] {app_name}/Clock.html')

# ---- git 操作 ----
print('\n--- main にコミット ---')
run('git checkout main')
run('git add .')
run(f'git commit -m "v{new_ver}"')
run('git push origin main')
print('[OK] main push 完了')

print('\n--- release にマージ ---')
run('git checkout release')
run('git merge main')
run('git push origin release')
print('[OK] release push 完了')

run('git checkout main')

print(f'\n{"=" * 40}')
print(f'  v{new_ver} をリリースしました！')
print(f'  {GITHUB_PAGES_URL}')
print(f'{"=" * 40}')
