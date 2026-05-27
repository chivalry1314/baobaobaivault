---
name: Dreamy Bubble Outline
source: sharefrontend/src/app/globals.css
---

## Overview

This document describes the **actual UI style currently implemented** in `sharefrontend`.
It replaces the previous dreamy-glass spec and aligns with the live visual system used by shared pages.

Core visual direction:

- Pastel background with high-contrast ink outline
- Solid white panels instead of translucent glass cards
- Rounded geometry + comic-like thick borders
- Bold typography hierarchy optimized for quick scanning

## Color Tokens

Primary tokens (from `:root` in `globals.css`):

- `--background: #a2d2fb`
- `--foreground: #2e2856`
- `--outline: #2e2856`
- `--primary: #cdb4f3`
- `--secondary: #aee7d9`
- `--tertiary: #facdf4`
- `--accent: #fcf1a7`
- `--brand: #ff9c9c`
- `--brand-strong: #ff7f9d`

Interaction tokens:

- `--button-primary`, `--button-primary-hover`, `--button-primary-active`
- `--button-subtle`, `--button-subtle-hover`, `--button-subtle-text`
- `--button-rose`, `--button-rose-hover`, `--button-rose-text`

Readability tokens:

- `--text-secondary`
- `--text-muted`
- `--text-subtle`

## Typography

Global body font:

- `Nunito` first, with Chinese fallbacks: `PingFang SC`, `Microsoft YaHei`, `Noto Sans CJK SC`

Type utility scale:

- `type-hero`
- `type-h1`
- `type-h2`
- `type-h3`
- `type-body`
- `type-body-sm`
- `type-meta`

Tone guidelines:

- Headings use heavy weight (`black`/`900`) and compact line-height
- Supporting text uses lower contrast (`foreground` with alpha)
- Overlines and metadata use uppercase tracking

## Shape and Borders

System shape language:

- Card radius: usually `1.5rem` to `2rem+`
- Inputs/buttons: mostly full pill or soft rounded corners
- Borders: strong visible outlines (`3px` to `4px`) using `--line-strong` / `--outline`

This is intentionally not minimal; it should feel playful and tactile.

## Layout Tokens

- `--layout-max: 1500px`

Container policy:

- Primary shared pages should use `max-w-[var(--layout-max)]` as the default shell width.
- Component-local narrower widths are still allowed for dedicated editors/modals/forms.

## Elevation and Shadows

Main shadow tokens:

- `--shadow-card: 0 4px 0 rgba(46, 40, 86, 0.28)`
- `--shadow-lift: 0 8px 0 rgba(46, 40, 86, 0.26)`
- `--shadow-soft: 0 4px 0 rgba(46, 40, 86, 0.2)`

Usage:

- Base panels/cards use `shadow-card` or `shadow-soft`
- Hover-lift surfaces use `card-hover-lift` + `shadow-lift`
- No heavy black blur shadows; elevation is crisp and outlined

## Core Component Classes

Shared structural classes:

- `dream-panel` / `dream-panel-soft`
- `dream-card`
- `route-shell`
- `floating-nav`
- `dream-input` / `dream-textarea`
- `dream-chip` / `metric-pill`
- `btn-primary` / `btn-subtle` / `btn-rose`

Motion helpers:

- `fade-slide-in`
- `card-hover-lift`
- `sparkle`

## Background and Ornament

Background strategy:

- Base page uses solid pastel `--background`
- Large blurred pastel orbs/clouds are layered as decorative atmosphere
- Ornaments are subtle and non-interactive (`pointer-events-none`)

## Accessibility and Interaction Notes

- Focus ring is implemented globally for interactive controls (`a`, `button`, `input`, `textarea`, `select`, etc.) via `:focus-visible` outline + glow
- `prefers-reduced-motion` disables key animation transitions
- Buttons and chips keep strong border contrast for readability
- Legacy low-alpha foreground text utilities have been migrated to explicit semantic tokens (`--text-muted` / `--text-subtle`) in components

## Navigation Semantics

- `/creator` is the semantic entry for Creator Center.
- `/creator/new` is treated as an action route for creating a new card, not a primary nav root.

## Implementation Notes

- The current codebase still contains a compatibility normalization block for legacy translucent surface classes.
- Text contrast migration is complete at component level; new UI code should use semantic text tokens directly instead of alpha-based foreground classes.

## Drift Policy

When changing UI in this project:

1. Use existing CSS variables first
2. Prefer shared utility classes over one-off long class strings
3. Update this file if visual primitives or tokens change
4. Keep language consistency (Chinese-first product copy unless explicitly bilingual)
