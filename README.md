# 🎲 PlayWebLudo — Mobile-First Browser Game

An original, mobile-first browser Ludo game, **PlayWebLudo**, built with Next.js (App Router), TypeScript (strict mode), Tailwind CSS, Motion, Zod, Vitest, and Playwright.

Designed to match the high-fidelity UI specification in `design/ui-spec.png` with pure SVG/CSS vector graphics and zero external image dependencies.

Developed by **[istiak.tech](https://istiak.tech)**.

---

## 🎨 Visual Design & Aesthetics

- **Color Palette**:
  - Background: `#0F172A`
  - Blue: `#1E40AF` / `#3B82F6`
  - Red: `#EF4444`
  - Green: `#22C55E`
  - Yellow: `#FACC15`
  - Purple: `#8B5CF6`
  - Orange: `#F59E0B`
- **Typography**: Google Fonts Poppins & Nunito.
- **Mobile-First**: Designed for 360px–430px mobile viewports (100dvh, safe-area insets, no page scrolling, `touch-action: manipulation`, 44px+ touch targets). Fully centered and responsive on desktop.
- **100% Vector Rendering**: Entire board, 3D pawns, 3D ivory dice, crown badges, and character avatars are drawn in clean SVG and Tailwind CSS.
- **Procedural Sound FX**: Zero remote audio assets; synthesized procedurally via the browser's Web Audio API. Sound is OFF by default and can be toggled via the settings modal.
- **Accessibility**: Full `prefers-reduced-motion` support. Explicit active turn badges and text labels so state never relies on color alone.

---

## 🧠 Pure Game Engine (`/src/engine`)

The game engine is pure TypeScript with **zero React or DOM dependencies**, making it deterministic, unit-testable, and server-authoritative ready for Phase 2.

- **Board Geometry (`geometry.ts`)**:
  - 52 shared perimeter track cells.
  - 4 color home lanes (6 steps each leading to the center home).
  - Explicit start cells: Red (0), Green (13), Yellow (26), Blue (39).
  - Explicit home lane entry cells: Red (51), Green (12), Yellow (25), Blue (38).
  - Safe cells: 4 start cells + 4 star cells (8, 21, 34, 47). Pawns on safe cells cannot be captured.
- **Configurable Ruleset (`DEFAULT_RULESET`)**:
  - Roll an exact **6** to leave base yard.
  - Rolling a 6 grants an **extra turn**.
  - **3 consecutive sixes rule**: Rolling three 6s in a row forfeits the turn immediately.
  - **Exact roll needed** to reach center home (overshoots cannot move).
  - Capturing an opponent sends their pawn back to base yard.
  - Safe cells protect pawns from capture; multiple pawns can coexist on safe cells.
  - Capturing or reaching home does not grant extra turns by default (configurable).
- **Modes**:
  - **1v1 Duel**: Two opposite colors active (e.g. Red vs Yellow). First player to bring all 4 pawns home wins.
  - **2v2 Team Battle**: 4 players in cooperative play. Opposite colors are teammates (Team 1: Red + Yellow, Team 2: Green + Blue). Teammates cannot capture each other. A team wins when all 8 pawns of both teammates reach home.
- **Deterministic RNG**: Dice rolling accepts an injectable RNG function `() => number` for deterministic simulation and automated testing.

---

## 🧪 Verification & Real Test Results

Every test and build command has been executed and verified:

### 1. TypeScript Strict Check
```bash
npx tsc --noEmit
# Exit code: 0 (No type errors)
```

### 2. ESLint Check
```bash
npm run lint
# Exit code: 0 (Clean, 0 errors, 0 warnings)
```

### 3. Vitest Engine Unit Tests
```bash
npm test
# ✓ src/engine/__tests__/engine.test.ts (11 tests) 45ms
#   ✓ 1. Enter with six: token enters track on 6, cannot leave on 1-5
#   ✓ 2. Illegal moves: rejects invalid tokenId or illegal movement
#   ✓ 3. Normal movement: advances token along track correctly
#   ✓ 4. Capture: landing on an opponent on an unsafe cell sends opponent to base
#   ✓ 5. Safe cell: opponent cannot be captured on start or star cells
#   ✓ 6. Exact home finish: must roll exact value to finish in center home
#   ✓ 7. Extra turn: rolling a 6 gives an extra turn to the same player
#   ✓ 8. Three-sixes rule: 3 consecutive sixes results in immediate turn forfeiture
#   ✓ 9. No-legal-move turn skip: skips turn immediately when no moves are possible
#   ✓ 10. 1v1 win: all 4 tokens home triggers game over and blocks moves
#   ✓ 11. 2v2 team win: both teammates must finish all 8 tokens, teammates do not capture each other
```

### 4. Playwright End-to-End Test (Mobile Viewport 390x844)
```bash
npx playwright test
# Running 1 test using 1 worker
#   ✓ Complete journey: Home -> Setup -> Gameplay -> Move -> Result -> Home (8.0s)
# 1 passed (17.2s)
```

### 5. Next.js Production Build
```bash
npm run build
# ✓ Compiled successfully
# ✓ Finished TypeScript
# ✓ Generating static pages (4/4)
# Exit code: 0
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on v24.22)
- npm 9+

### Installation
```bash
git clone <repo-url>
cd Ludo
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your browser (or use Chrome DevTools device mode at 390x844).

### Running Tests
```bash
# Run unit tests
npm test

# Run e2e tests
npx playwright test
```

### Production Build
```bash
npm run build
npm start
```

---

## 📱 Phase 1 Features Summary

- **Home Screen**: 3D Ludo logo, Play Now button, 1v1 / 2v2 mode cards, honest "Not configured yet" modal for Phase 2 online rooms, rules dialog, sound settings, and "Developed by istiak.tech" footer.
- **Game Setup**: Mode selection (1v1 / 2v2), custom player names, color swatches with pawn selection, and Start Game trigger.
- **Gameplay Screen**: Fully responsive SVG board (15x15 grid), animated pawns, 3D ivory dice with tumbling roll animation, active turn indicator badge with glowing border, restart confirmation dialog, and Web Audio synthesizer.
- **Result Screen**: Golden crown victory banner, confetti celebration, winner spotlight card, match stats, Play Again, Rematch, and Home navigation.
- **Storage**: Persistent player preferences and sound settings stored in `localStorage` without secrets.

---

## 🔮 Phase 2 (Coming in Phase 2)

- Supabase anonymous authentication, PostgreSQL database, and Realtime channels.
- Server-authoritative dice rolling and move validation using `/src/engine`.
- Atomic turn versioning to prevent stale/concurrent actions.
- Private 6-character cryptographically random room codes.
- Realtime lobby with seats, teams, ready status, and reconnection handling.
