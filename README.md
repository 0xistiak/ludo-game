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
- **Procedural Sound FX**: Zero remote audio assets; synthesized procedurally via the browser's Web Audio API. Sound is ON by default and can be toggled via the gameplay top bar or Settings modal.
- **Accessibility**: Full `prefers-reduced-motion` support. Explicit active turn badges and text labels so state never relies on color alone.

---

## 🔊 Procedural Audio & iPhone Silent-Switch

PlayWebLudo features a zero-dependency procedural audio engine built on the Web Audio API (`src/utils/audio.ts`) with no external audio files and no network requests.

### Audio Architecture
- **DynamicsCompressor & Master Gain**: All sounds route through a Web Audio `DynamicsCompressorNode` (`threshold: -14dB`, `knee: 25`, `ratio: 10`) and master gain node (default volume ~0.7) to guarantee loud, punchy, distortion-free playback across mobile speakers.
- **Sound Effects Synthesized**:
  1. **UI Click**: Soft pop/tick on button taps.
  2. **Dice Roll**: Bolder, richer rattle with band-pass filtered noise clicks slowing down over ~500ms, 3 wooden knocks, and a resonant low thump on landing.
  3. **Token Move**: Short wooden tock on every cell step (pitch-scaled with hop count).
  4. **Token Exit from Base**: Distinct buoyant pop.
  5. **Capture**: Punchy impact sound with low-frequency saw drop and noise burst.
  6. **Reaching Home**: ~1s ascending 4-note chime (G5, C6, E6, G6) with high specular sparkle.
  7. **Game Win**: Multi-voice victory fanfare celebration.
  8. **Bonus Turn / Turn Cancelled**: Distinct melodic cues for bonus rolls and 3-sixes revert.
- **Controls & Persistence**: Default sound is **ON**. Toggle mute anytime from the top bar icon or the Settings modal. State is saved in `localStorage`.
- **Test Sound Button**: Located in the Settings modal to instantly test UI click, dice roll, and celebration fanfare.

### iPhone Silent-Switch Note
> [!NOTE]
> On iOS (iPhone Safari & WebViews), Web Audio is routed by default through the "ambient" audio category, meaning it is silenced whenever the physical Ring/Silent switch on the side of the iPhone is switched to Silent / Mute.
>
> To ensure game sound works reliably even when the physical silent switch is active, PlayWebLudo automatically:
> 1. Configures `navigator.audioSession.type = 'playback'` where supported on modern iOS.
> 2. Plays a short, inaudible, silent HTML5 audio data URI element upon the first user interaction (`pointerdown`, `touchend`, `click`) to switch the iOS audio session to media playback.
> 3. Resumes suspended contexts automatically on `visibilitychange` and user taps.

---

## 📜 Classic Ludo Rules (`classic` ruleset)

PlayWebLudo strictly follows classic Ludo King / Ludo Star gameplay rules:

1. **One Roll Per Turn**: Each turn starts with exactly **ONE roll**. If the roll is not a 6 and no token can legally move, the turn passes immediately to the next player (after a short "No move" message). There are no multiple roll attempts.
2. **Leaving Base**: A token leaves base only on rolling a **6** and enters its colored start cell. All tokens in base count as one collective choice.
3. **Roll of 6 (Classic Choice)**: Rolling a 6 always awards another roll. When tokens are in base AND tokens are outside on track/lane, the player freely chooses to EITHER bring a new token out of base OR move any outside token. Both options are legal and selectable. After the move, the same player rolls again.
4. **Roll of 1-5 (Player Choice)**: The player may freely move ANY token that is outside base and legal (not blocked by the exact-home rule).
5. **Three Consecutive Sixes (Full Turn Revert)**:
   - At the start of each player's turn, a snapshot of all token positions (`turnStartSnapshot`) is recorded.
   - On rolling a **3rd consecutive 6** in the same turn, the entire turn is cancelled: all token positions are restored to `turnStartSnapshot` (undoing moves made on the first two sixes, and returning any captured opponent tokens back to where they were). The turn passes immediately to the next player with a clear "Three 6s! Turn cancelled" message and slide-back animation.
   - Config flag `revertCapturesOnThreeSixes` defaults to `true`.
   - If a player rolls 6, 6 and then a non-6, the snapshot is discarded when the turn ends normally and all moves are kept.
   - Bonus rolls from capture or reaching home do NOT reset the consecutive-six counter unless a non-6 is rolled.
6. **Capture Bonus Roll**: Capturing an opponent token on any non-safe cell sends it back to its base yard AND awards an immediate bonus roll (`bonusReason: 'capture'`).
7. **Home Reach Bonus Roll**: A token reaching center home awards an immediate bonus roll (`bonusReason: 'home'`).
8. **Exact Roll to Finish**: Entering the center home requires an exact roll. Overshooting rolls cannot be applied to that token.
9. **Safe Cells**: 8 safe cells on the track (4 Start cells: Red 0, Green 13, Yellow 26, Blue 39; 4 Star cells: 8, 21, 34, 47). Tokens on safe cells cannot be captured.
10. **Blocks / Stacks**: Tokens of the same color may share any cell. Teammates never capture each other. The engine supports a `blockCannotBeCaptured` config flag with **default `false`** (classic mode allows capturing stacks unless on safe cells; setting to `true` protects 2+ stacked same-color tokens).
11. **Equivalent-Move De-duplication**: Moves that produce identical outcomes are de-duplicated:
    - All tokens in base represent **ONE** legal choice.
    - Two same-color tokens on the same cell represent **ONE** legal choice.
12. **Auto-Move**: Auto-move triggers ONLY when exactly ONE distinct legal choice exists (toggled via Settings). When 2 or more distinct legal choices exist, the game always waits for the player's tap.
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
  - `revertCapturesOnThreeSixes: true` (default)
  - `exactRollToFinish: true`
  - `captureGivesExtraTurn: true`
  - `homeFinishGivesExtraTurn: true`
  - `starCellsAreSafe: true`
  - `startCellsAreSafe: true`
  - `blockCannotBeCaptured: false` (default)
- **State Properties**:
  - `currentPlayer`: Active player's color (`PlayerColor`).
  - `diceValue` / `currentRoll`: Current dice roll.
  - `phase`: `'awaiting-roll' | 'awaiting-move' | 'game_over'`.
  - `consecutiveSixes`: Counter for consecutive sixes (0..3).
  - `turnStartSnapshot`: Token map snapshot saved at the beginning of each player's turn.
  - `revertedTurn`: Metadata describing any turn revert after 3 consecutive sixes.
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
