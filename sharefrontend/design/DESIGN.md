---
name: Dreamy ACG Aesthetic
colors:
  surface: '#fff8f8'
  surface-dim: '#eed4d8'
  surface-bright: '#fff8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0f2'
  surface-container: '#ffe8ec'
  surface-container-high: '#fde2e6'
  surface-container-highest: '#f7dce0'
  on-surface: '#26181b'
  on-surface-variant: '#4f4446'
  inverse-surface: '#3d2c30'
  inverse-on-surface: '#ffecef'
  outline: '#817476'
  outline-variant: '#d3c3c5'
  surface-tint: '#78555e'
  primary: '#78555e'
  on-primary: '#ffffff'
  primary-container: '#ffd1dc'
  on-primary-container: '#7a5761'
  inverse-primary: '#e7bbc6'
  secondary: '#725477'
  on-secondary: '#ffffff'
  secondary-container: '#fad3fd'
  on-secondary-container: '#77587c'
  tertiary: '#615e57'
  on-tertiary: '#ffffff'
  tertiary-container: '#e2dcd3'
  on-tertiary-container: '#64605a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e2'
  primary-fixed-dim: '#e7bbc6'
  on-primary-fixed: '#2d141c'
  on-primary-fixed-variant: '#5e3e47'
  secondary-fixed: '#fcd7ff'
  secondary-fixed-dim: '#dfbbe4'
  on-secondary-fixed: '#2a1131'
  on-secondary-fixed-variant: '#593d5f'
  tertiary-fixed: '#e7e2d9'
  tertiary-fixed-dim: '#cbc6bd'
  on-tertiary-fixed: '#1d1b16'
  on-tertiary-fixed-variant: '#494640'
  background: '#fff8f8'
  on-background: '#26181b'
  surface-variant: '#f7dce0'
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

This design system is built to evoke a "healing" (iyashikei) emotional response, tailored for Gen-Z female users immersed in ACG culture. The aesthetic draws heavily from modern Otome game interfaces, prioritizing high visual fidelity, emotional warmth, and romantic charm.

The design style is a hybrid of **Glassmorphism** and **Tactile Softness**. It utilizes translucent, frosted surfaces to create a sense of weightlessness, combined with soft, "squishy" neomorphic shadows that make elements feel touchable. The visual narrative is reinforced by decorative motifs including floating sparkles (glitter), subtle lace-patterned borders, and heart icons used as structural accents rather than just decoration.

## Colors

The palette is anchored in "Sakura Pink" and "Lavender Purple" to create a romantic, twilight-garden atmosphere. 

- **Primary (Sakura):** Used for key actions and focal points.
- **Secondary (Lavender):** Used for interactive states and secondary navigation elements.
- **Tertiary (Creamy White):** The base for surfaces, providing a warmer, more "expensive" feel than pure white.
- **Neutral (Cocoa):** A soft, desaturated brown-grey used for text to maintain high readability without the harshness of black.

Gradients should be used generously on large surfaces, transitioning softly between the primary pink and secondary purple with low opacity.

## Typography

The typography selection prioritizes a "friendly-modern" look. **Plus Jakarta Sans** is utilized for headings and labels due to its open apertures and inherently optimistic, rounded geometric shapes. **Be Vietnam Pro** serves as the body face, offering exceptional legibility for long-form narrative text (common in ACG/Otome styles) while maintaining a warm, contemporary feel.

All type should be rendered with slightly higher line-heights to enhance the "airy" and "dreamy" quality of the layout. Headlines may occasionally use a subtle "glow" text-shadow in the primary color for a magical effect.

## Layout & Spacing

This design system employs a **Fluid Grid** with generous inner padding to create a sense of "breathable luxury." The layout relies on an 8px rhythmic scale, but with larger exterior margins (20px+) to frame the content like a storybook.

Elements should be grouped within floating containers rather than edge-to-edge strips. Use "Cloud-grouping"—where related elements sit on a shared semi-transparent "cloud" surface—to organize information without hard dividers.

## Elevation & Depth

Hierarchy is established through **Soft Tonal Layering** and **Color-Tinted Shadows**. 

1.  **Base Layer:** The creamy white background or a soft pink-to-peach gradient.
2.  **Surface Layer:** Translucent "Glass" panels (80-90% opacity) with a heavy backdrop blur (20px).
3.  **Floating Layer:** Interactive elements like buttons and cards use a dual-shadow system: one soft, wide-cast shadow tinted with Lavender (#E0BBE4) and a smaller, tighter highlight on the top-left edge to simulate 3D roundness.

Avoid using harsh black shadows. Every elevation change should feel like a soft pillow resting on a silken sheet.

## Shapes

The shape language is defined by **Extreme Roundness**. There are no sharp corners in this design system. 

All primary buttons and input fields utilize "Pill-shaped" geometry. Cards and containers use an extra-large radius (min 24px). A distinctive feature of this system is the **"Lace Edge"**: a decorative scalloped or perforated border applied to the bottom or top of key modal headers and card dividers, mimicking delicate fabric. Sparkle shapes (four-pointed stars) should be used as background ornaments near focal points.

## Components

- **Buttons:** High-gloss, pill-shaped buttons with a subtle inner-glow. "Primary" buttons feature a gradient from Sakura to a slightly deeper rose. "Secondary" buttons use a frosted glass effect with a lavender border.
- **Input Fields:** Soft-focus fields with 100% rounded corners. The focus state transitions the border from creamy white to a glowing Sakura pink.
- **Cards:** Large-radius containers with a "Lace" divider separating the image/header from the body text. Backgrounds are slightly translucent.
- **Chips/Tags:** Tiny pill shapes with a "sparkle" icon prefix. Use light pastel fills with darker text for contrast.
- **Checkboxes/Radios:** Customized as small hearts or flowers. When selected, they "bloom" or fill with a saturated pink gradient.
- **Progress Bars:** Soft, rounded tracks. The filler should have a "shimmer" animation, moving left to right like a sparkling liquid.
- **Decorative Elements:** Floating 2D sparkle sprites and "Petal Fall" micro-interactions when a user completes a major task (healing feedback).