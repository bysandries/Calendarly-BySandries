# Calendarly UI Design System

> **Glassmorphism Dark-Mode Design Language**
> Foundation document for Figma design, AI-assisted component generation, and iPhone-responsive UI development.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design Tokens](#2-design-tokens)
   - [Color Palette](#21-color-palette)
   - [Typography](#22-typography)
   - [Spacing Scale](#23-spacing-scale)
   - [Border Radius](#24-border-radius)
   - [Shadows](#25-shadows)
   - [Motion Tokens](#26-motion-tokens)
   - [Z-Index Hierarchy](#27-z-index-hierarchy)
3. [Component Library](#3-component-library)
4. [Page Layout Patterns](#4-page-layout-patterns)
5. [Responsive System](#5-responsive-system)
   - [Current Breakpoints](#51-current-breakpoints)
   - [iPhone-Specific Recommendations](#52-iphone-specific-recommendations)
6. [Figma Usage Guide](#6-figma-usage-guide)

---

## 1. Design Philosophy

### Visual Language: Glassmorphism on Pure Black

Calendarly is built on a **pure black canvas** (`#000000`) overlaid with semi-transparent glass surfaces. The aesthetic is designed to:

- Minimize visual noise so cognitive resources go to the data, not the chrome
- Use neon accent colors to create sharp contrast and draw attention to interactive elements
- Simulate physical depth through blur, transparency, and layered shadows

**Three core principles:**
1. **Hierarchy through contrast** — Text scales from `#f0f0f0` (primary) to `#444444` (dimmed). Background layers from `#000000` to `rgba(255,255,255,0.06)` create perceived elevation.
2. **Motion with purpose** — Four timing tokens (fast, default, slow, spring) correspond to specific interaction types. No animation is decorative.
3. **Local-first density** — Unlike SaaS dashboards that pad for marketing, Calendarly packs information efficiently. Minimum padding is 8px; default content padding is 32px 40px on desktop.

### PALM Methodology Visual Metaphor

The UI is structured around the PALM cycle:
- **Plan** (blue accent `#3498DB`) — Intent, scheduling, future-facing
- **Act** (orange `#E67E22`) — In progress, action, present moment
- **Measure** (green `#2ECC71`) — Done, completed, verified
- **Learn** (purple `#8E44AD`) / reflection — Retrospective, knowledge, someday

These colors are used consistently in task statuses, event columns, and project phases.

---

## 2. Design Tokens

These tokens map directly from `client/src/index.css` CSS Custom Properties. When importing to Figma, use the **Tokens Studio for Figma** or **Figma Variables** plugin.

### 2.1 Color Palette

#### Canvas (Background Layers)

| Token Name | CSS Variable | Hex / RGBA | Figma Group | Usage |
|-----------|--------------|------------|-------------|-------|
| `bg/primary` | `--bg-primary` | `#000000` | Canvas | Page background |
| `bg/surface` | `--bg-surface` | `#0a0a0a` | Canvas | Elevated surfaces, sidebars |
| `bg/card` | `--bg-card` | `rgba(255,255,255,0.03)` | Canvas | Card backgrounds |
| `bg/card-hover` | `--bg-card-hover` | `rgba(255,255,255,0.06)` | Canvas | Card hover state |
| `bg/input` | `--bg-input` | `rgba(255,255,255,0.04)` | Canvas | Form field backgrounds |
| `bg/input-focus` | `--bg-input-focus` | `rgba(255,255,255,0.08)` | Canvas | Focused form fields |

#### Glass (Surfaces & Borders)

| Token Name | CSS Variable | RGBA | Figma Group | Usage |
|-----------|--------------|------|-------------|-------|
| `glass/bg` | `--glass-bg` | `rgba(255,255,255,0.03)` | Glass | Base glass surface |
| `glass/bg-strong` | `--glass-bg-strong` | `rgba(255,255,255,0.06)` | Glass | Elevated glass (hover) |
| `glass/border` | `--glass-border` | `rgba(255,255,255,0.06)` | Glass | Default border |
| `glass/border-hover` | `--glass-border-hover` | `rgba(255,255,255,0.12)` | Glass | Hovered border |
| `glass/border-active` | `--glass-border-active` | `rgba(255,255,255,0.18)` | Glass | Active/focused border |

#### Text

| Token Name | CSS Variable | Hex | Contrast (on #000) | Usage |
|-----------|--------------|-----|---------------------|-------|
| `text/primary` | `--text-primary` | `#f0f0f0` | ≈15:1 | Body text, labels |
| `text/secondary` | `--text-secondary` | `#999999` | ≈7:1 | Secondary labels |
| `text/muted` | `--text-muted` | `#666666` | ≈4.5:1 | Muted hints, timestamps |
| `text/dimmed` | `--text-dimmed` | `#444444` | ≈3:1 | De-emphasized content |

#### Borders

| Token Name | CSS Variable | RGBA | Usage |
|-----------|--------------|------|-------|
| `border/subtle` | `--border-subtle` | `rgba(255,255,255,0.06)` | Dividers, section lines |
| `border/default` | `--border-default` | `rgba(255,255,255,0.08)` | Card borders, inputs |
| `border/strong` | `--border-strong` | `rgba(255,255,255,0.15)` | Focused elements, active |

#### Accent Colors

| Token Name | CSS Variable | Hex | Usage |
|-----------|--------------|-----|-------|
| `accent/primary` | `--accent-primary` | `#3498DB` | Primary buttons, links, active states |
| `accent/success` | `--accent-success` | `#2ECC71` | Success states, done status |
| `accent/warning` | `--accent-warning` | `#F39C12` | Warnings, waiting status |
| `accent/danger` | `--accent-danger` | `#E74C3C` | Destructive actions, errors |

#### Neon Glows (box-shadow values)

| Token Name | CSS Variable | Value | Usage |
|-----------|--------------|-------|-------|
| `glow/blue` | `--neon-blue` | `0 0 20px rgba(52,152,219,0.3)` | Primary button hover |
| `glow/green` | `--neon-green` | `0 0 20px rgba(46,204,113,0.3)` | Success/done hover |
| `glow/orange` | `--neon-orange` | `0 0 20px rgba(230,126,34,0.3)` | In-progress hover |
| `glow/purple` | `--neon-purple` | `0 0 20px rgba(155,89,182,0.3)` | Someday/creative hover |

#### Area Colors

Used for life-area categorization on events, projects, and analytics.

| Area | Token | CSS Variable | Hex |
|------|-------|--------------|-----|
| Sleep | `area/sleep` | `--area-sleep` | `#2C3E50` |
| Work | `area/work` | `--area-work` | `#E67E22` |
| Math | `area/math` | `--area-math` | `#F1C40F` |
| Coding | `area/coding` | `--area-coding` | `#3498DB` |
| Creative | `area/creative` | `--area-creative` | `#9B59B6` |
| Fitness | `area/fitness` | `--area-fitness` | `#2ECC71` |
| General | `area/general` | `--area-general` | `#95A5A6` |

#### Status Colors (GTD Pipeline)

| Status | Token | CSS Variable | Hex |
|--------|-------|--------------|-----|
| Inbox | `status/inbox` | `--status-inbox` | `#95A5A6` |
| Next Step | `status/next-step` | `--status-next-step` | `#3498DB` |
| In Progress | `status/in-progress` | `--status-in-progress` | `#E67E22` |
| Waiting | `status/waiting` | `--status-waiting` | `#F39C12` |
| Someday | `status/someday` | `--status-someday` | `#8E44AD` |
| Reference | `status/reference` | `--status-reference` | `#7F8C8D` |
| Done | `status/done` | `--status-done` | `#2ECC71` |

#### Priority Colors

| Priority | Token | Hex | Label |
|----------|-------|-----|-------|
| None | `priority/0` | `#444444` | No priority |
| P1 | `priority/1` | `#3498DB` | Low |
| P2 | `priority/2` | `#E67E22` | Medium |
| P3 | `priority/3` | `#E74C3C` | High |

---

### 2.2 Typography

**Font family:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`  
**Code font:** `'SF Mono', 'Fira Code', 'Consolas', monospace`

#### Type Scale

| Scale Step | rem | px (16px base) | Weight | Line Height | Usage |
|-----------|-----|----------------|--------|-------------|-------|
| `type/micro` | 0.60rem | ~10px | 600 | 1.2 | Phase badges, micro labels |
| `type/tiny` | 0.65rem | ~10px | 600 | 1.2 | Section labels, small badges |
| `type/label-sm` | 0.70rem | ~11px | 600 | 1.4 | Form labels, hint text |
| `type/badge` | 0.75rem | ~12px | 600 | 1.2 | Status badges, timestamps |
| `type/button` | 0.80rem | ~13px | 600 | 1.2 | Button text, input text |
| `type/body-sm` | 0.85rem | ~14px | 400/500 | 1.5 | Secondary body, task titles |
| `type/body` | 0.90rem | ~14px | 400 | 1.6 | Table content, habit rows |
| `type/body-md` | 1.00rem | 16px | 500/600 | 1.5 | Modal headers, drawer titles |
| `type/title-sm` | 1.10rem | ~18px | 600 | 1.3 | Page section headers |
| `type/title` | 1.20rem | ~19px | 600 | 1.3 | Modal titles |
| `type/title-lg` | 1.50rem | 24px | 700 | 1.2 | Stat values, KPI numbers |
| `type/heading` | 1.75rem | 28px | 700/800 | 1.2 | Page titles (h2) |
| `type/display` | 2.40rem | ~38px | 700 | 1.0 | Pomodoro timer display |

#### Font Weights Reference

| Weight | Value | Figma Style Name |
|--------|-------|-----------------|
| Light | 300 | Inter/Light |
| Regular | 400 | Inter/Regular |
| Medium | 500 | Inter/Medium |
| Semi-Bold | 600 | Inter/SemiBold |
| Bold | 700 | Inter/Bold |
| Extra-Bold | 800 | Inter/ExtraBold |

---

### 2.3 Spacing Scale

Base unit: **4px**. All spacing is a multiple of 4px.

| Token | px | CSS Usage |
|-------|----|-----------|
| `space/1` | 4px | Gap in badges, tight icon spacing |
| `space/1.5` | 6px | Gap in small components |
| `space/2` | 8px | Button padding, tight card padding |
| `space/2.5` | 10px | Medium-small spacing |
| `space/3` | 12px | Standard card padding |
| `space/4` | 16px | Panel padding, section gaps |
| `space/5` | 20px | Bottom margins, medium gaps |
| `space/6` | 24px | Section separation |
| `space/8` | 32px | Page margins (mobile/tablet) |
| `space/10` | 40px | Page padding (desktop) |
| `space/12` | 48px | Large section gaps |
| `space/20` | 80px | Empty state padding |

---

### 2.4 Border Radius

| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| `radius/sm` | `--radius-sm` | 6px | Inputs, small badges, tooltips |
| `radius/md` | `--radius-md` | 10px | Cards, dropdowns, popovers |
| `radius/lg` | `--radius-lg` | 16px | Modals, drawers |
| `radius/xl` | `--radius-xl` | 20px | Large panels, pomodoro timer |
| `radius/pill` | — | 999px | Status badges, area chips |
| `radius/circle` | — | 50% | Icon buttons, avatars, color swatches |

---

### 2.5 Shadows

| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| `shadow/sm` | `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.3)` | Cards, small popovers |
| `shadow/md` | `--shadow-md` | `0 4px 16px rgba(0,0,0,0.4)` | Dropdowns, drawers |
| `shadow/lg` | `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.5)` | Modals, dialogs |
| `shadow/xl` | `--shadow-xl` | `0 16px 64px rgba(0,0,0,0.6)` | Full-screen overlays |

---

### 2.6 Motion Tokens

| Token | CSS Variable | Value | When to Use |
|-------|-------------|-------|-------------|
| `motion/fast` | `--transition-fast` | `150ms cubic-bezier(0.4,0,0.2,1)` | Button hover, badge hover, immediate feedback |
| `motion/default` | `--transition-default` | `250ms cubic-bezier(0.4,0,0.2,1)` | Modal open, sidebar expand, property changes |
| `motion/slow` | `--transition-slow` | `400ms cubic-bezier(0.4,0,0.2,1)` | Intentional, deliberate transitions |
| `motion/spring` | `--transition-spring` | `500ms cubic-bezier(0.34,1.56,0.64,1)` | Toast notifications, playful bounce effects |

**Named animation keyframes:**

| Name | Duration | Usage |
|------|----------|-------|
| `fadeIn` | 200ms ease | Page content entrance |
| `slideUp` | 300ms ease | Modal/drawer entrance |
| `shimmer` | 1.5s ease-in-out infinite | Skeleton loaders |
| `pulse` | 2s ease-in-out infinite | Connection status dot |
| `gradientShift` | 3s ease infinite | Sidebar logo gradient |
| `pomodoro-pulse` | 1s ease-in-out infinite | Active timer indicator |

---

### 2.7 Z-Index Hierarchy

| Level | Value | Usage |
|-------|-------|-------|
| `z/behind` | -1 | Behind backgrounds |
| `z/base` | 0 | Default stacking |
| `z/sticky` | 10 | Sticky table headers |
| `z/fab` | 50 | Floating action buttons, panel toggles |
| `z/sidebar` | 100 | Sidebar panel |
| `z/dropdown` | 200 | Dropdowns, tooltips, pickers |
| `z/modal` | 1000 | Modals, drawers, dialogs |
| `z/overlay` | 2000 | Top-level overlays (note detail split view) |
| `z/toast` | 9999 | Toast/notification stack |

---

## 3. Component Library

Each component entry describes: purpose, states, key CSS classes, dimensions, and Figma notes.

---

### 3.1 Sidebar Navigation

**Purpose:** Primary app navigation. Fixed left panel, collapsible.

**Dimensions:**
- Expanded: `240px` wide, full viewport height
- Collapsed: `64px` wide (icon-only)

**Variants / States:**

| Variant | Trigger | Description |
|---------|---------|-------------|
| Expanded | Default ≥1024px, user toggle | Logo + icon + label per nav item |
| Collapsed | ≤1024px auto, user toggle | Icon only; label appears as `::after` tooltip on hover |
| Active item | Current route | 3px left border bar (`--accent-primary`), animated height |
| Hover item | Mouse over | `--bg-card-hover` background, border lightens |

**Key CSS classes:**
```css
.sidebar                  /* Container: fixed, z-100, glass blur */
.sidebar.collapsed        /* Collapsed width override */
.nav-item                 /* Each nav link */
.nav-item.active          /* Active route */
.nav-label                /* Label text (hidden in collapsed) */
.sidebar-section-label    /* Section divider text */
```

**Figma Notes:**
- Create as Auto Layout frame (vertical, fill height)
- Two variants: `Sidebar/Expanded` and `Sidebar/Collapsed`
- Nav items: use component set with `state=default/hover/active`
- Collapse toggle icon at bottom

---

### 3.2 Buttons

#### Primary Button
```
Background:  --accent-primary (#3498DB)
Text:        white, 0.8rem, weight 600
Padding:     8px 18px
Radius:      --radius-sm (6px)
Hover:       brightness(1.15) + --neon-blue glow + translateY(-1px)
Active:      scale(0.95)
Transition:  --transition-fast
Min height:  32px (desktop) → 44px (iPhone touch target)
```

#### Ghost Button
```
Background:  transparent
Border:      1px solid --border-default
Text:        --text-secondary
Hover:       Background → --bg-card-hover, border → --border-strong, text brightens
```

#### Danger Button
```
Background:  --accent-danger (#E74C3C) at 15% opacity
Border:      1px solid rgba(231,76,60,0.3)
Text:        --accent-danger
Hover:       Full red background, white text
```

#### Icon Button
```
Background:  transparent
Padding:     8px
Size:        Typically 32px × 32px (icon 16px)
Hover:       --bg-card-hover background
Radius:      --radius-sm
Touch target: 44px × 44px on iPhone (add padding to hit area)
```

#### Floating Action Button (FAB)
```
Size:        48px × 48px (desktop) → 56px × 56px (mobile)
Radius:      50%
Background:  --accent-primary
Shadow:      --shadow-md + neon glow
Position:    Fixed, bottom-right (mobile: above bottom nav bar)
```

**Figma Notes:**
- Button component set: `type=Primary/Ghost/Danger/Icon/FAB` × `state=default/hover/active/disabled`
- Use Auto Layout with `hug content` for text buttons
- Fixed size for Icon and FAB variants

---

### 3.3 Cards (Glass Card Pattern)

**Base glass card:**
```css
background:       var(--glass-bg);                    /* rgba(255,255,255,0.03) */
border:           1px solid var(--glass-border);      /* rgba(255,255,255,0.06) */
border-radius:    var(--radius-md);                   /* 10px */
padding:          12px–20px;
backdrop-filter:  blur(24px);
transition:       all var(--transition-default);

/* Hover elevation: */
background:       var(--glass-bg-strong);
border-color:     var(--glass-border-hover);
box-shadow:       var(--shadow-md);
transform:        translateY(-2px);
```

**Card types:**

| Type | Min Width | Max Height | Notes |
|------|-----------|------------|-------|
| Note card | 320px (auto-fill grid) | Line-clamp 4 lines | Preview text truncated |
| Extract card | 320px | Auto | Chapter badge overlay |
| Stat card | Auto | Auto | Title + large value + optional subtext |
| Project card | Auto | Auto | Progress bar, phase badge, stats row |
| Habit card | Full width | Auto | Table-row style, colored left border |
| KPI card | Auto | Auto | Radial gauge, area color accent |

**Figma Notes:**
- Base card as component with `hover` interactive state
- Overlay blur using Figma's **Background Blur** effect (24px)
- Card fill: `rgba(255,255,255,3%)` using Figma color styles

---

### 3.4 Badges

#### Status Badges (GTD)

All status badges share this structure:
```
Background: {status-color} at 15% opacity
Border:     1px solid {status-color} at 20% opacity
Padding:    4px 12px
Radius:     20px (pill)
Font:       0.75rem, weight 600
Display:    inline-flex, align-items center, gap 4px
```

| Badge | Class | Color |
|-------|-------|-------|
| Inbox | `.status-badge.inbox` | `#95A5A6` |
| Next Step | `.status-badge.next-step` | `#3498DB` |
| In Progress | `.status-badge.in-progress` | `#E67E22` |
| Waiting | `.status-badge.waiting` | `#F39C12` |
| Someday | `.status-badge.someday` | `#8E44AD` |
| Reference | `.status-badge.reference` | `#7F8C8D` |
| Done | `.status-badge.done` | `#2ECC71` |
| Not Done | `.status-badge.not-done` | `#E74C3C` |
| Cancelled | `.status-badge.cancelled` | `#7F8C8D` |
| To Calendar | `.status-badge.to-calendar` | `#9B59B6` |
| Delegate | `.status-badge.delegate` | `#F1C40F` |
| Snoozed | `.status-badge.snoozed` | `#7F8C8D` |

#### Priority Dots

```
Size:      8px × 8px circle
Colors:    P0=#444444, P1=#3498DB, P2=#E67E22, P3=#E74C3C
Display:   Inline colored dot before task title
```

#### Area Chips

```
Structure:  color swatch (12px circle) + area name
Background: --bg-input
Border:     1px solid --border-default
Padding:    4px 10px 4px 8px
Radius:     999px
Font:       0.75rem, weight 500
```

---

### 3.5 Form Elements

#### Text Input
```
Background:    --bg-input (rgba 4%)
Border:        1px solid --border-default
Radius:        --radius-sm (6px)
Padding:       8px 12px (compact) / 10px 14px (standard)
Font:          0.875rem, inherit family
Color:         --text-primary
Placeholder:   --text-muted

Focus:
  Border-color: --accent-primary
  Box-shadow:   0 0 0 3px rgba(52,152,219,0.15)
  Background:   --bg-input-focus

IMPORTANT FOR IPHONE: font-size must be ≥ 16px to prevent iOS keyboard zoom
```

#### Select
```
Appearance: none
Background: --bg-input + SVG chevron via background-image
Same sizing and focus states as text input
```

#### Textarea
```
Min-height: 100px
Resize:     vertical
All input styles apply
```

#### Checkbox
```
Accent-color: --accent-primary
Size:         16px × 16px
```

---

### 3.6 Tables

```
border-collapse:  separate
border-spacing:   0

Header row:
  Position: sticky, top: 0
  Font:     0.7rem, uppercase, letter-spacing 0.1em
  Color:    --text-muted
  Z-index:  10

Data rows:
  Padding:  14px 16px per cell
  Hover:    --bg-card-hover background
  Border-bottom: 1px solid --border-subtle

Area strip (optional):
  3px left border on row using area color

Responsive:
  min-width: 700px (horizontal scroll below this)
  On iPhone: Convert to card-list pattern (see Section 5.2)
```

---

### 3.7 Modals & Overlays

**Overlay backdrop:**
```
Position:         fixed, full viewport
Background:       rgba(0,0,0,0.7)
Backdrop-filter:  blur(4px)
Z-index:          1000
Animation:        fadeIn 200ms
```

**Modal content:**
```
Position:         relative, centered (margin: auto)
Background:       --bg-surface (#0a0a0a)
Border:           1px solid --glass-border
Radius:           --radius-lg (16px)
Padding:          24px–32px
Box-shadow:       --shadow-xl
Animation:        slideUp 300ms (translateY 20px → 0)

Size variants:
  Small:   max-width 480px
  Default: max-width 560px
  Large:   max-width 720px
  Extra:   max-width 1000px (Notes split view)
  iPhone:  100vw, 90dvh (full-screen bottom sheet — see Section 5.2)
```

---

### 3.8 Drawers / Slide Panels

**SlideDrawer (Calendar event drawer):**
```
Position:   Fixed, right: 0, top: 0, bottom: 0
Width:      420px (desktop) → 100vw (iPhone)
Background: --bg-surface
Border-left: 1px solid --glass-border
Z-index:    1000
Animation:  translateX(100%) → translateX(0), 300ms ease

Overlay:    Same backdrop as modal
Dismiss:    Escape key, click outside
```

**Figma Notes:**
- Drawer frame at 420px, variant `Drawer/Desktop`
- iPhone variant at 390px full-width, variant `Drawer/Mobile`

---

### 3.9 Tabs

#### Underline Tabs (Tasks page)
```
Tab list:      flex row, border-bottom: 1px solid --border-subtle
Tab item:      padding 8px 16px, no background
Active:        border-bottom: 2px solid --accent-primary, color: --text-primary, box-shadow: --neon-blue
Inactive:      color: --text-secondary
Badge:         Pill count badge, background --glass-bg-strong
```

#### Rounded Tabs (Agents page)
```
Tab item:      padding 8px 20px, border-radius 8px 8px 0 0
Active:        background: tab's accent color at 15%, border-top: 2px solid accent color
Inactive:      transparent
```

#### Vertical Tabs (Settings page)
```
Direction:     column, sidebar layout
Item padding:  10px 16px
Active:        background: purple gradient, left-border: 3px solid --accent-primary
```

---

### 3.10 Area Picker & Project Picker

**Trigger (pill button):**
```
Background:  --bg-input
Border:      1px solid --border-default
Padding:     4px 10px 4px 8px
Radius:      999px
Font:        0.75rem, weight 500
Contains:    Color swatch (12px circle) + area/project name + chevron icon
```

**Dropdown:**
```
Position:    absolute, top: calc(100% + 6px), left: 0
Min-width:   260px (Area) / 220px (Project)
Max-height:  240px (Area) / 320px (Project)
Overflow:    auto
Background:  --bg-surface
Border:      1px solid --glass-border
Radius:      --radius-md
Shadow:      --shadow-lg
Z-index:     200
```

**Items:**
```
Padding:   8px 12px
Font:      0.8rem
Hover:     --bg-card-hover background
Selected:  3px left border (accent) + background tint
```

**Project Picker extras:**
- Search input at top
- "Create new project" dashed button at bottom

---

### 3.11 Empty States

```
Container:
  display:     flex, flex-direction column, align-items center
  padding:     80px 40px (large) / 40px 24px (compact)
  text-align:  center

Icon:
  font-size:   3rem (emoji or SVG)
  opacity:     0.3
  margin-bottom: 16px

Title:
  font-size:   1.1rem, weight 600
  color:       --text-secondary

Description:
  font-size:   0.85rem
  color:       --text-muted
  max-width:   360px
  line-height: 1.6
```

---

### 3.12 Skeleton Loaders

```
Background:  linear-gradient(90deg, --bg-card 25%, --bg-card-hover 50%, --bg-card 75%)
Animation:   shimmer 1.5s ease-in-out infinite
Radius:      6px

Row skeleton:  height 52px, full width
Card skeleton: height 180px, full width
```

---

### 3.13 Toast Notifications

```
Position:    Fixed, bottom-right (or top-right)
Z-index:     9999
Padding:     12px 16px
Radius:      --radius-md
Background:  --bg-surface
Border:      1px solid --glass-border
Shadow:      --shadow-lg
Animation:   slideUp + fadeIn with --transition-spring (500ms bounce)

Variants:
  Success: left border 3px --accent-success
  Warning: left border 3px --accent-warning
  Error:   left border 3px --accent-danger
  Info:    left border 3px --accent-primary
```

---

## 4. Page Layout Patterns

### 4.1 App Shell

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar (fixed, 240px or 64px)  │  Main Content (flex: 1)  │
│                                  │                           │
│ • Logo                           │ ← Page Header            │
│ • Nav Items (icon + label)       │   (h2 + description)     │
│ • Status Dot                     │                           │
│ • Collapse Toggle                │ ← Page Content           │
│                                  │   (varies per route)     │
└─────────────────────────────────────────────────────────────┘

Main Content padding: 32px 40px (desktop)
Sidebar transition: width 250ms ease
```

### 4.2 Grid Layout

```css
/* Card grid pattern used across Notes, Projects, Analytics */
display: grid;
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
gap: 16px;
```

### 4.3 Calendar Grid (Dual Column)

```
┌─────────┬──────────────────┬──────────────────┐
│ Time    │     PLAN         │     MEASURE      │
│ column  │  (intent)        │  (reality)       │
├─────────┼──────────────────┼──────────────────┤
│  9:00   │ [Event block]    │ [Event block]    │
│         │                  │                  │
│ 10:00   │                  │ [Measure event]  │
├─────────┴──────────────────┴──────────────────┤
│             ← Pomodoro Panel (collapsible) →  │
└───────────────────────────────────────────────┘

Hour height: --hour-height (80px)
Plan lane: rgba(255,255,255,0.02) background
Measure lane: rgba(0,0,0,0.2) background
```

### 4.4 Split Panel (Notes / Habits Drawer)

```
┌─────────────────────┬─────────────────────┐
│   Left Panel        │   Right Panel       │
│   (form / list)     │   (detail / hist.)  │
│   flex: 1           │   flex: 1           │
└─────────────────────┴─────────────────────┘

Breaks to single column at ≤768px (flex-direction: column)
```

### 4.5 Kanban Board

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Next Steps  │ In Progress  │   Waiting    │  Completed   │
│ (blue border)│(orange border)│(amber border)│(green border)│
│              │              │              │              │
│ [Card]       │ [Card]       │ [Card]       │ [Card]       │
│ [Card]       │              │              │ [Card]       │
└──────────────┴──────────────┴──────────────┴──────────────┘

Column min-width: 280px
Horizontal scroll on overflow
Drag-over: 1px dashed border (accent color)
```

---

## 5. Responsive System

### 5.1 Current Breakpoints

```css
/* ── Breakpoint 1: Tablet/iPad ── */
@media (max-width: 1024px) {
  /* Sidebar auto-collapses */
  .main-content { padding: 24px 28px; }
  .cards-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
}

/* ── Breakpoint 2: Mobile/Small Tablet ── */
@media (max-width: 768px) {
  .sidebar { width: var(--sidebar-collapsed) !important; }
  .main-content { margin-left: var(--sidebar-collapsed); padding: 16px 20px; }
  .sidebar .nav-label, .sidebar-logo-full, .sidebar-section-label { display: none; }
  .cards-grid { grid-template-columns: 1fr; }
  .note-detail-body { flex-direction: column; }
}

/* ── Breakpoint 3: Small Phone ── */
@media (max-width: 480px) {
  .main-content { padding: 12px 16px; }
}
```

| Name | Width Range | Sidebar | Layout |
|------|-------------|---------|--------|
| Desktop | ≥1024px | Expanded (240px) | Multi-column |
| Tablet | 768–1024px | Collapsed (64px) | 2-column grids |
| Mobile | 480–768px | Collapsed + hidden labels | Single column |
| Small Phone | <480px | Collapsed | Minimal padding |

---

### 5.2 iPhone-Specific Recommendations

These recommendations apply to native web running in Safari on iPhone, and to a future React Native or PWA mobile port.

#### Target Device Sizes

| Device | Viewport Width | Logical Resolution |
|--------|---------------|-------------------|
| iPhone SE (3rd gen) | 375px | 375 × 667 |
| iPhone 14 / 15 | 390px | 390 × 844 |
| iPhone 14 Plus / 15 Plus | 428px | 428 × 926 |
| iPhone 14 Pro Max / 15 Pro Max | 430px | 430 × 932 |

**Recommended breakpoints to add:**
```css
@media (max-width: 430px) { /* iPhone Pro Max and below */ }
@media (max-width: 390px) { /* iPhone 14/15 standard and below */ }
@media (max-width: 375px) { /* iPhone SE and very small phones */ }
```

---

#### Navigation: Replace Sidebar with Bottom Tab Bar

On iPhone, the sidebar pattern must be replaced with a **bottom tab bar**. This is the iOS native navigation paradigm.

```
┌─────────────────────────────────┐
│                                 │
│         Page Content            │
│         (full width)            │
│                                 │
├─────────────────────────────────┤
│  📅  ✅  📊  🎯  ⚙️            │  ← Bottom Tab Bar
│  Cal Task Stats Habits Settings │
└─────────────────────────────────┘
```

**CSS implementation snippet:**

```css
@media (max-width: 768px) {
  /* Hide sidebar entirely */
  .sidebar { display: none; }

  /* Remove sidebar offset from main content */
  .main-content {
    margin-left: 0;
    padding: 16px 16px;
    /* Reserve space for bottom nav + safe area */
    padding-bottom: calc(64px + env(safe-area-inset-bottom));
  }

  /* Bottom nav bar */
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(10, 10, 10, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--glass-border);
    z-index: 100;
    justify-content: space-around;
    align-items: center;
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bottom-nav-item.active {
    color: var(--accent-primary);
  }

  .bottom-nav-icon {
    font-size: 1.4rem;
    line-height: 1;
  }
}

/* Show bottom nav only on mobile */
.bottom-nav {
  display: none;
}
```

**Tabs to expose in bottom bar (5 max):**
1. Calendar (📅)
2. Tasks (✅)
3. Analytics (📊)
4. Habits (🎯)
5. Settings (⚙️)

Secondary pages (Projects, Notes, Extracts, Kanban) accessible via a "More" tab or from within parent pages.

---

#### Safe Area Insets (iPhone Notch & Home Indicator)

```css
:root {
  --safe-top:    env(safe-area-inset-top);
  --safe-right:  env(safe-area-inset-right);
  --safe-bottom: env(safe-area-inset-bottom);
  --safe-left:   env(safe-area-inset-left);
}

/* Apply to any full-screen containers */
.fullscreen-modal {
  padding-top:    var(--safe-top);
  padding-bottom: var(--safe-bottom);
}
```

**In HTML `<head>`:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

---

#### Touch Targets (Apple HIG Minimum: 44×44px)

```css
/* Utility class for any tappable element */
.touch-target {
  min-width:  44px;
  min-height: 44px;
  display:    flex;
  align-items: center;
  justify-content: center;
}

/* Apply on mobile to all interactive elements */
@media (max-width: 768px) {
  .btn, button, [role="button"] {
    min-height: 44px;
  }

  .nav-item, .list-row, tr {
    min-height: 48px;
  }

  /* Icon buttons need padding to hit 44px */
  .icon-btn {
    padding: 12px;
  }
}
```

---

#### Typography: Prevent iOS Zoom

**Critical rule:** Any `<input>`, `<select>`, or `<textarea>` with `font-size < 16px` triggers iOS Safari's automatic zoom on focus. This breaks the layout.

```css
@media (max-width: 768px) {
  input, select, textarea {
    font-size: 16px !important;
  }

  /* Also increase base body size slightly */
  body {
    font-size: 15px;
  }

  /* Scale up type scale by one step */
  .type-badge   { font-size: 0.80rem; }  /* was 0.75 */
  .type-button  { font-size: 0.875rem; } /* was 0.80 */
  .type-body-sm { font-size: 0.925rem; } /* was 0.85 */
}
```

---

#### Calendar: Day-Scroll Mode on iPhone

The dual-column weekly grid is unworkable at 390px. Replace with a **single-day horizontal scroll** view on iPhone.

```css
@media (max-width: 768px) {
  .calendar-grid {
    /* Show only current day, scroll horizontally to next/prev */
    display: flex;
    overflow-x: scroll;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .calendar-day-column {
    min-width: 100vw;
    scroll-snap-align: start;
  }

  /* Reduce hour height for more events visible */
  :root {
    --hour-height: 56px;
  }
}
```

**Navigation:** Swipe left/right between days. Optionally add a day-picker header strip with `scroll-snap`.

---

#### Tables: Card List Pattern on iPhone

Replace horizontal-scroll tables with a stacked card list.

```css
@media (max-width: 480px) {
  /* Hide table structure, convert to cards */
  table, thead, tbody, th, td, tr {
    display: block;
  }

  thead tr {
    display: none; /* Hide column headers */
  }

  tbody tr {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    margin-bottom: 8px;
  }

  td::before {
    /* Use data-label attribute for inline labels */
    content: attr(data-label);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    display: block;
    margin-bottom: 2px;
  }
}
```

---

#### Modals & Drawers: Bottom Sheet on iPhone

Replace centered modals with **bottom sheets** that slide up from the bottom edge.

```css
@media (max-width: 768px) {
  .modal-overlay {
    align-items: flex-end; /* Stack content to bottom */
  }

  .modal-content {
    width: 100vw;
    max-width: 100vw;
    max-height: 90dvh;       /* 90% of dynamic viewport height */
    border-radius: 20px 20px 0 0;  /* Round top corners only */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* Handle bar at top */
    padding-top: 20px;
  }

  .modal-content::before {
    content: '';
    display: block;
    width: 40px;
    height: 4px;
    background: var(--border-strong);
    border-radius: 2px;
    margin: 0 auto 16px;
  }

  /* Drawers become full-screen bottom sheets */
  .slide-drawer {
    top: auto;
    bottom: 0;
    right: 0;
    left: 0;
    width: 100vw;
    height: 90dvh;
    border-radius: 20px 20px 0 0;
    border-left: none;
    border-top: 1px solid var(--glass-border);
    animation: slideUp var(--transition-default) ease;
  }
}
```

---

#### Scrolling Performance on iOS

```css
/* Apply to all scrollable containers */
.scrollable {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Prevent pull-to-refresh on the main layout */
body {
  overscroll-behavior-y: none;
}
```

---

#### Complete iPhone CSS Addition Summary

To make the current web app iPhone-ready, add these CSS blocks to `index.css`:

```css
/* ── iPhone Responsive Layer ── */

/* 1. Viewport meta (add to index.html) */
/* <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"> */

/* 2. Safe area custom properties */
:root {
  --safe-top:    env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
}

/* 3. Bottom navigation (hidden by default) */
.bottom-nav { display: none; }

@media (max-width: 768px) {
  /* --- Layout --- */
  .sidebar { display: none; }
  .main-content {
    margin-left: 0;
    padding: 16px 16px calc(64px + var(--safe-bottom));
  }
  .bottom-nav { display: flex; /* see full spec above */ }

  /* --- Touch targets --- */
  .btn, button, [role="button"] { min-height: 44px; }
  .icon-btn { padding: 12px; }

  /* --- Typography zoom prevention --- */
  input, select, textarea { font-size: 16px !important; }

  /* --- Modals as bottom sheets --- */
  .modal-overlay { align-items: flex-end; }
  .modal-content {
    width: 100vw;
    max-width: 100vw;
    max-height: 90dvh;
    border-radius: 20px 20px 0 0;
    -webkit-overflow-scrolling: touch;
  }

  /* --- Scrolling --- */
  .scrollable { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
  body { overscroll-behavior-y: none; }

  /* --- Calendar --- */
  :root { --hour-height: 56px; }
}

@media (max-width: 390px) {
  .main-content { padding: 12px 12px calc(64px + var(--safe-bottom)); }
}

@media (max-width: 375px) {
  /* iPhone SE — small adjustments */
  .main-content { padding: 8px 12px calc(64px + var(--safe-bottom)); }
}
```

---

### 5.3 Responsive Checklist for Figma

When designing mobile frames in Figma, verify:

- [ ] All tap targets are 44×44px minimum
- [ ] No text below 14px (preferably 16px for inputs)
- [ ] Sidebar replaced with bottom tab bar
- [ ] Modals designed as bottom sheets with rounded top corners
- [ ] Calendar uses day-scroll view (not weekly grid)
- [ ] Tables use card-list layout
- [ ] Content does not extend into safe areas (notch / home indicator)
- [ ] FAB is positioned above the bottom tab bar

---

## 6. Figma Usage Guide

### 6.1 Token Import Workflow

1. Install the **Tokens Studio for Figma** plugin (or use native **Figma Variables** if on a Pro plan)
2. Create a new Variable Collection named `Calendarly Tokens`
3. Add Groups matching the token structure in Section 2:
   - `Canvas` → bg/* tokens
   - `Glass` → glass/* tokens
   - `Text` → text/* tokens
   - `Border` → border/* tokens
   - `Accent` → accent/* tokens
   - `Glow` → glow/* tokens
   - `Area` → area/* tokens
   - `Status` → status/* tokens
   - `Priority` → priority/* tokens
   - `Radius` → radius/* tokens
   - `Shadow` → shadow/* tokens
   - `Motion` → motion/* tokens (note values for documentation, not native Figma)

### 6.2 Color Style Group Structure

```
Calendarly/Canvas/Primary
Calendarly/Canvas/Surface
Calendarly/Canvas/Card
Calendarly/Canvas/Card Hover
Calendarly/Canvas/Input
Calendarly/Canvas/Input Focus
Calendarly/Glass/Border
Calendarly/Glass/Border Hover
Calendarly/Glass/Border Active
Calendarly/Text/Primary
Calendarly/Text/Secondary
Calendarly/Text/Muted
Calendarly/Text/Dimmed
Calendarly/Accent/Primary
Calendarly/Accent/Success
Calendarly/Accent/Warning
Calendarly/Accent/Danger
Calendarly/Area/Sleep … /General
Calendarly/Status/Inbox … /Done
Calendarly/Priority/None … /High
```

### 6.3 Component Naming Convention

```
ComponentName/Variant/State

Examples:
  Button/Primary/Default
  Button/Primary/Hover
  Button/Primary/Active
  Button/Ghost/Default
  Badge/Status/In Progress
  Badge/Priority/P3
  Card/Glass/Default
  Card/Glass/Hover
  Input/Text/Default
  Input/Text/Focus
  Input/Text/Error
  Sidebar/Expanded
  Sidebar/Collapsed
  NavItem/Default
  NavItem/Active
  NavItem/Hover
```

### 6.4 Auto Layout Settings

| Component | Direction | Padding | Gap | Resizing |
|-----------|-----------|---------|-----|----------|
| Buttons | Horizontal | 8px 18px | — | Hug content |
| Nav items | Horizontal | 8px 16px | 12px | Fill container |
| Cards | Vertical | 16px | 12px | Fill container |
| Badges | Horizontal | 4px 12px | 4px | Hug content |
| Modal | Vertical | 24px | 16px | Fixed width |
| Bottom nav | Horizontal | 0 | 0 | Fill container |
| Bottom nav item | Vertical | 10px 8px | 2px | Fixed 44px width |

### 6.5 Frame Sizes to Create

| Frame Name | Size | Purpose |
|-----------|------|---------|
| `Desktop/1440` | 1440 × 900 | Primary desktop design |
| `Desktop/1280` | 1280 × 800 | Small laptop |
| `iPad/Mini` | 768 × 1024 | Tablet (portrait) |
| `iPhone/14` | 390 × 844 | Primary iPhone target |
| `iPhone/SE` | 375 × 667 | Small iPhone |
| `iPhone/ProMax` | 430 × 932 | Large iPhone |

### 6.6 Glassmorphism in Figma

To replicate the glassmorphism effect in Figma:

1. **Fill:** Use a color fill with `rgba(255,255,255,3%)` — set opacity to 3%
2. **Border:** 1px stroke, `rgba(255,255,255,6%)`
3. **Background Blur:** Add **Layer Effect > Background Blur** at 24px
4. **Note:** Background blur only renders when placed over content in Figma. Set a dark image or gradient behind the frame for preview accuracy.
5. **Frosted Glass Trick:** Use a rectangle with gradient fill (dark → darker) + background blur + low-opacity white fill layered on top.

### 6.7 Prototyping Motion

Since Figma doesn't support CSS easing curves directly, approximate them:

| Token | Figma Easing | Duration |
|-------|-------------|----------|
| `motion/fast` | Ease Out | 150ms |
| `motion/default` | Ease Out | 250ms |
| `motion/slow` | Ease In Out | 400ms |
| `motion/spring` | Spring (use Smart Animate) | 500ms |

Use **Smart Animate** between component variants with matching layer names for hover/active state transitions.
