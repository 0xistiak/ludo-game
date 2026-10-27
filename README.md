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

## 📜 Classic Ludo Rules (`classic` ruleset)

PlayWebLudo strictly follows classic Ludo King / Ludo Star gameplay rules:

1. **Leaving Base**: A token leaves base only on rolling a **6** and enters its colored start cell.
2. **Safe Cells**: 8 safe cells on the track (4 Start cells: Red 0, Green 13, Yellow 26, Blue 39; 4 Star cells: 8, 21, 34, 47). Tokens on safe cells cannot be captured.
3. **Extra Roll on Six**: Rolling a 6 always awards an extra roll. The player may choose to EITHER bring a new token out of base OR move an existing token along the track/lane. Both choices are presented as distinct legal options.
4. **Three Attempts in Base**: When a player has all active tokens in base (none on the track or in home lane), they get up to **3 roll attempts per turn** to roll a 6. If none is a 6, the turn passes. Tracked in state via `rollAttempts`.
5. **Three Consecutive Sixes**: Rolling three 6s in a row cancels the third 6, awards no move, and passes the turn immediately.
6. **Capture Bonus Roll**: Capturing an opponent token on any non-safe cell sends it back to its base yard AND awards the capturer an immediate bonus roll (`bonusReason: 'capture'`).
7. **Home Reach Bonus Roll**: A token reaching center home awards an immediate bonus roll (`bonusReason: 'home'`).
8. **Exact Roll to Finish**: Entering the center home requires an exact roll. If the roll is larger than needed, that token cannot move.
9. **No Legal Move Pass**: If a roll produces no legal moves, the turn passes after a brief "No move" prompt.
10. **Blocks / Stacks**: Tokens of the same color may share any cell. Teammates never capture each other. The engine supports a `blockCannotBeCaptured` config flag with **default `false`** (classic mode allows capturing stacks unless on safe cells; setting to `true` protects 2+ stacked same-color tokens).
11. **Equivalent-Move De-duplication**: Moves that produce identical outcomes are de-duplicated:
    - All tokens in base represent **ONE** legal choice.
    - Two same-color tokens on the same cell represent **ONE** legal choice.
12. **Auto-Move**: When `getAutoMove(state)` finds exactly ONE legal choice, it applies automatically after ~350ms (can be toggled in Settings). When 2+ choices exist, they are highlighted with pulsing glow rings and wait for tap.
13. **2v2 Cooperative Teammate Control**: In 2v2 mode, when a player has finished all 4 of their tokens, on their turn they roll and move their **teammate's** tokens. A team wins when all 8 tokens are home.
14. **Deterministic Server Authority**: The online multiplayer server runs the identical pure TypeScript engine with server-side cryptographically secure RNG.

---

## 🧠 Pure Game Engine (`/src/engine`)

The game engine is pure TypeScript with **zero React or DOM dependencies**, making it deterministic, unit-testable, and server-authoritative.

- **Board Geometry (`geometry.ts`)**:
  - 52 shared perimeter track cells.
  - 4 color home lanes (6 steps each leading to the center home).
  - Explicit start cells: Red (0), Green (13), Yellow (26), Blue (39).
  - Explicit home lane entry cells: Red (51), Green (12), Yellow (25), Blue (38).
  - Safe cells: 4 start cells + 4 star cells (8, 21, 34, 47). Pawns on safe cells cannot be captured.
- **Configurable Ruleset (`DEFAULT_RULESET`)**:
  - `needSixToLeaveBase: true`
  - `sixGivesExtraTurn: true`
  - `threeConsecutiveSixesLoss: true`
  - `exactRollToFinish: true`
  - `captureGivesExtraTurn: true`
  - `homeFinishGivesExtraTurn: true`
  - `starCellsAreSafe: true`
  - `startCellsAreSafe: true`
  - `blockCannotBeCaptured: false` (default)
  - `threeRollAttemptsInBase: true`
- **State Properties**:
  - `currentPlayer`: Active player's color (`PlayerColor`).
  - `diceValue` / `currentRoll`: Current dice roll.
  - `phase`: `'awaiting-roll' | 'awaiting-move' | 'game_over'`.
  - `consecutiveSixes`: Counter for consecutive sixes (0..3).
  - `rollAttempts`: Counter for base roll attempts (0..3).
  - `bonusRoll`: `{ hasBonus: boolean, reason: 'six' | 'capture' | 'home' | null }`.
  - `lastMove`: `{ tokenId, from, to, path: number[], capturedTokenIds, reachedHome, awardedExtraTurn, bonusReason, roll }`.
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
