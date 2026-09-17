# DESIGN.md — UVa Online Judge Portal

> AI-readable design specification for the UVa Portal interface.

---

## 1. Design Philosophy

- **Vibe / Tone**: Precision Developer Judge Terminal. High contrast, dark-mode first, authentic competitive programming workspace (Linear/Vercel/Codeforces/Kattis engineering quality).
- **Core Principles**:
  - **Single-Screen Flow**: Solve, code, submit, and track verdicts without navigating away or losing context.
  - **Information Density**: Compact tabular metrics without clutter; clear visual hierarchy between metadata, code, and judge feedback.
  - **Tactile Feedback**: Immediate responsive state changes on user action (`translateY(1px) scale(0.99)` on active buttons, glowing live telemetry indicator).
  - **No AI Slop**: No purple neon gradients, no cards-inside-cards-inside-cards, no unreadable low-contrast text.

---

## 2. Color System

```css
/* Backgrounds */
--bg: #090d12;              /* Deepest terminal canvas */
--surface: #0f161e;         /* Elevated panels & tables */
--surface-2: #151e2a;       /* Active rows, cards, and modal bars */
--surface-3: #1c2837;       /* Hover states and chip backgrounds */

/* Micro-Borders */
--border: #1f2c3c;          /* Structural containment */
--border-subtle: rgba(255, 255, 255, 0.06); /* Row dividers */
--border-hover: #2f4258;    /* Interactive hover borders */

/* Typography */
--text: #f0f6fc;            /* High contrast primary text */
--text-muted: #8b9bb0;      /* Secondary metadata & labels */
--text-dim: #546577;        /* Tertiary placeholders & counters */

/* Semantic Judge Tokens */
--accent: #388bfd;          /* Action & interactive blue */
--accent-hover: #58a6ff;
--accent-subtle: rgba(56, 139, 253, 0.12);

--ok: #2ea043;              /* Accepted (AC) emerald */
--ok-hover: #3fb950;
--ok-subtle: rgba(46, 160, 67, 0.14);

--pending: #d29922;         /* Judge Queue / Judging amber */
--pending-subtle: rgba(210, 153, 34, 0.14);

--bad: #f85149;             /* Wrong Answer (WA) / Runtime Error crimson */
--bad-subtle: rgba(248, 81, 73, 0.14);
```

---

## 3. Typography

- **UI / Headings**: `'Space Grotesk', system-ui, -apple-system, sans-serif`
  - Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
  - Letter spacing: `-0.01em` on panel titles, `0.04em` on uppercase micro-labels.
- **Data / Code / Monospace**: `'JetBrains Mono', ui-monospace, monospace`
  - Used for problem numbers, run IDs, runtime metrics, countdown timers, compiler selections, and code editor.
  - `font-variant-numeric: tabular-nums` for timers and counters.
- **Copywriting**:
  - Ellipsis: Use `…` (single unicode char) rather than three dots `...`.
  - Loading states end with `…`: `"Judging solution…"`, `"Connecting to UVa…"`.

---

## 4. Spacing & Radius System

- **Spacing Scale**: `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`.
- **Border Radius**:
  - Controls, inputs, and small buttons: `6px`
  - Containers, tables, and cards: `8px`
  - Modal sheets and drawers: `10px`
  - Status badges, nav pills, and counters: `999px` (full pill)

---

## 5. Components & Interaction Patterns

### 5.1 Problem Statement Workspace (Split View)
- In `SubmitPanel`, setting a problem number automatically triggers the 2-column split view:
  - **Left Pane**: Sticky embedded PDF viewer (`submit-statement-col`) with header bar and "Open in tab" link.
  - **Right Pane**: Solution submission form (language, source code, submit CTA) and live judge verdict card.
  - Toggle button allows collapsing the statement pane to give full width to the code editor.

### 5.2 Slide-Over Statement Drawer
- In `Problems`, `Sheets`, and `Contests` panels, clicking "View statement" opens a docked 56vw right drawer.
- Non-blocking slide-over with dark backdrop blur.
- Header includes problem title, "Submit solution →" primary button, and "Open in tab" fallback.

### 5.3 Asynchronous Verdict Polling Card
- When code is submitted and is queued (`"In judge queue"`), the card shows:
  - Rotating amber spinner (`.spinner`).
  - Badge: `In judge queue (judging…)`.
  - Automatic transition to final verdict badge (`Accepted`, `Wrong answer`, etc.) once resolved by `/api/poll/<run_id>`.

### 5.4 Navigation Rail
- Left rail with UVa Judge brand badge and green live status beacon (`Judge Online`).
- Nav buttons with Phosphor icon, active inset border accent (`3px inset var(--accent)`), and user footer.

---

## 6. Iconography

- Library: `@phosphor-icons/react`
- Standard stroke weight: `regular` (or `bold`/`fill` for active states).
- Standard sizes: `14px`–`16px` inline with text, `18px` in headers, `26px` in scoreboard stats.
- All icon-only buttons include `aria-label` for screen reader accessibility.

---

## 7. Web Interface Guidelines Compliance

- **Accessibility**:
  - Semantic HTML tags (`<aside>`, `<nav>`, `<main>`, `<table>`, `<button>`).
  - Keyboard focus indicators with `:focus-visible`.
  - Decorative icons include `aria-hidden="true"`.
  - `aria-live="polite"` on judge verdict result updates.
- **Motion**:
  - Explicit CSS transitions (`transition: border-color 0.15s, background 0.15s`).
  - `@media (prefers-reduced-motion: reduce)` disables keyframe spins and sliding animations.

