# Character packs (local)

Canonical packs live in the private **`mimica-assets`** repository.  
This directory is mostly **Git-ignored** so Spine binaries stay off `mimica` remote.

## Setup

```bash
# clone once (sibling of mimica)
git clone git@github.com:DaisukeKarasawa/mimica-assets.git ../mimica-assets

# from mimica repo root
./scripts/link-character-pack.sh
```

After linking, `packs/rio/` should resolve to `../mimica-assets/packs/rio`.

Override the assets repo path:

```bash
MIMICA_ASSETS_REPO=~/path/to/mimica-assets ./scripts/link-character-pack.sh
```

See [docs/mimica-assets-setup.md](../docs/mimica-assets-setup.md).
