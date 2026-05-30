#!/usr/bin/env python3
"""
Blue Archive AssetBundle から TextAsset / Texture2D を抽出する補助スクリプト。

使い方:
  pip install UnityPy Pillow
  python scripts/extract-spine-bundles.py ~/Downloads/mimica-ba-rio ~/Downloads/mimica-ba-extracted

その後、extracted 内で CH0158 / home / skel / atlas を検索して MimicaAssets へ配置。
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import UnityPy
except ImportError:
    print("UnityPy が必要です: pip install UnityPy Pillow", file=sys.stderr)
    sys.exit(1)


def to_bytes(script) -> bytes:
    if isinstance(script, bytes):
        return script
    if isinstance(script, bytearray):
        return bytes(script)
    if isinstance(script, str):
        return script.encode("utf-8", "surrogateescape")
    return bytes(script)


def sanitize_asset_name(name: str, fallback: str) -> str:
    basename = Path(name).name
    if not basename or basename in (".", ".."):
        return fallback
    return basename


def export_object(obj, base: Path) -> None:
    typ = obj.type.name
    if typ == "TextAsset":
        data = obj.read()
        fallback = f"textasset_{obj.path_id}"
        name = sanitize_asset_name(data.m_Name, fallback) if data.m_Name else fallback
        out_name = name if Path(name).suffix else f"{name}.bytes"
        out = base / "TextAsset" / out_name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(to_bytes(data.m_Script))
        print(f"  TextAsset: {out.name}")
    elif typ == "Texture2D":
        data = obj.read()
        fallback = f"texture_{obj.path_id}"
        name = sanitize_asset_name(data.m_Name, fallback) if data.m_Name else fallback
        out = base / "Texture2D" / f"{name}.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        data.image.save(out)
        print(f"  Texture2D: {out.name}")


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser()
    dst = Path(sys.argv[2]).expanduser()
    if not src.exists():
        print(f"入力が見つかりません: {src}", file=sys.stderr)
        sys.exit(1)

    dst.mkdir(parents=True, exist_ok=True)
    file_count = sum(1 for p in src.rglob("*") if p.is_file())
    print(f"走査: {file_count} ファイル")

    for bundle in src.rglob("*"):
        if not bundle.is_file():
            continue
        try:
            env = UnityPy.load(str(bundle))
        except Exception as exc:
            print(f"skip bundle {bundle}: {exc}", file=sys.stderr)
            continue
        print(f"\n[{bundle.name}]")
        for obj in env.objects:
            if obj.type.name in ("TextAsset", "Texture2D"):
                try:
                    export_object(obj, dst)
                except Exception as exc:
                    print(f"  skip {obj.type.name}: {exc}")


if __name__ == "__main__":
    main()
