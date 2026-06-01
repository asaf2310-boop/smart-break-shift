# AllinCenter dark login logo

**Spelling:** `AllinCenter` — capital **A** and **C**; sketch wordmark from HERO snapshot (`login-hero-full-v1`).

## Runtime asset

| Role | Path | Constant |
|------|------|----------|
| Demo login hero (`onDark`, `variant="full"`, `size="hero"`) | `public/allincenter-logo-allincenter-hero.png` | `BRAND_LOGO_DARK_SRC` |

Hub: left ~38% crop from `login-hero-full-v1.png` (unchanged pixels). Wordmark: HERO letter bitmaps; **a**/**c** scaled for capitals. Transparent background.

## Regenerate

```bash
node scripts/render-allincenter-hero-match.mjs
```

Source: `public/brand-snapshots/login-hero-full-v1.png`. Colors sampled from HERO ink (e.g. A ≈ rgb(96,55,211), C ≈ rgb(46,114,181)).

## Deprecated (history only)

| Asset | Location |
|-------|----------|
| Patched hero-ac lockup | `public/brand-snapshots/allincenter-logo-hero-ac.png` |
| cap-A variant | `public/brand-snapshots/allincenter-logo-cap-a.png` |
| Patch script | `scripts/create-logo-ac-cap-transparent.mjs` (unused) |

## Wiring

- `AgentLogin` → `BrandEntryBlock` with `onDark`, `variant="full"`, `size="hero"`
- `BrandLogo.logoSrcForSurface(true)` → `BRAND_LOGO_DARK_SRC` only
- Light home / m3-page unchanged: `BRAND_LOGO_BRIGHT_SRC`
