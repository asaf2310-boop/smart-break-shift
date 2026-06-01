# Bright logo — light home / m3-page

**Date:** 2026-05-23  
**Purpose:** Visible hub + **AllInCenter** wordmark (A / C accent) on light `m3-page` gradient; transparent PNG (no white box).

## Assets

| Role | Path | Constant |
|------|------|----------|
| Full horizontal (hub + wordmark) | `public/allincenter-logo-bright.png` | `BRAND_LOGO_BRIGHT_SRC` |
| Hub icon only | `public/allincenter-icon-bright.png` | `BRAND_ICON_BRIGHT_SRC` |
| Dark login hero (demo) | `public/allincenter-logo-allincenter-hero.png` | `BRAND_LOGO_DARK_SRC` |
| Legacy snapshot / scripts | `public/allincenter-logo.png` | `BRAND_LOGO_SNAPSHOT_SRC` |
| Login snapshot (do not delete) | `public/brand-snapshots/login-hero-full-v1.png` | — |

## Regenerate

```bash
node scripts/create-bright-logo.mjs
```

Source: `public/allincenter-logo.png` (keeps hub/headphones geometry; recolors ink + redraws wordmark).

## Where it appears

| Surface | `onDark` | Asset |
|---------|----------|--------|
| Demo login (`AgentLogin`) | `true` + `brightLogo` | `allincenter-logo-bright.png` + drop-shadow (no multiply) |
| Logged-in home (`Home` → `BrandEntryBlock`) | `false` | `allincenter-logo-bright.png` |
| Corner mark (`BrandHeader`, demo routes) | `false` | bright full PNG (`sm`) |
| Lockup (`md`/`lg` on light) | `false` | bright icon + `BrandWordmark` |

## Verify locally

```bash
VITE_DEMO_MODE=true npm run dev
```

- **Home (logged in):** http://localhost:5173/ — bright logo on light gradient after login.
- **Login:** same origin when logged out — bright logo on purple gradient (`brightLogo`; no multiply).
