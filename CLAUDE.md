# FIRE Calculator — Claude Code Guide

## Purpose
A Financial Independence, Retire Early (FIRE) calculator for kashvector.com/fire/. Helps users find their FIRE number, time to retire, and Coast FIRE target using the 4% rule.

## Tech Stack
Vanilla HTML/CSS/JS — no build step, no dependencies except Chart.js (CDN).

## File Structure
```
www/
├── index.html        ← single-page tool
├── app.js            ← ALL DOM, events, localStorage, chart rendering
├── utils.js          ← pure formatting: formatCurrency, parseMoney, formatMoneyInput
├── style.css         ← CSS custom properties (dark theme), two-column layout
└── calc/
    └── fire.js       ← pure projection engine (no DOM access)
tests/
└── fire.test.js      ← Node built-in test runner
package.json          ← { "test": "node --test tests/*.test.js" }
```

## Architecture Rules (from kashvector-lessons.md)
- **DOM boundary:** only `app.js` touches `document`, `window`, `localStorage`
- **calc/fire.js** must be pure functions only — testable with Node, no DOM
- Add `if (typeof module !== 'undefined') module.exports = { ... }` at bottom of every calc file
- Money inputs: `type="text" inputmode="numeric"` — never `type="number"` for $ fields
- Use `parseMoney()` to strip commas before any calculation
- Use cursor-preserving `formatMoneyInput()` on every keystroke
- `localStorage` key: `kv_fire_inputs`
- Destroy Chart.js instance before recreating on each render

## Inputs
| Field | Default |
|---|---|
| Current portfolio | $0 |
| Annual retirement expenses | $60,000 |
| Annual savings/contributions | $25,000 |
| Current age | 30 |
| Investment return p.a. | 7% |
| Dividend yield p.a. | 4% |
| Inflation rate p.a. | 2.5% |
| Safe withdrawal rate | 4% |
| Super balance (optional) | $0 |
| Super contribution rate (optional) | 12% |

## Calculation Engine (calc/fire.js)

### `computeFireProjection(inputs)` → `rows[]`
Nominal projection loop — portfolio grows by return, FIRE number inflates each year:
```
fireNumber(y) = annualExpenses × (1+inflation)^y / swr
portfolio(y)  = portfolio(y-1) × (1+return) + annualSavings
```
Each row: `{ year, age, portfolio, contributions, growth, fireNumber, pctToFire, fireReached }`

### `coastFireNumber(fireNumber, investmentReturn, yearsToCoast)` → `$`
```
coastFire = fireNumber / (1 + investmentReturn)^yearsToCoast
```

## Header
- One-line description + 3 green concept pills: **FIRE Number**, **Coast FIRE**, **Lean / Fat FIRE**
- Pills styled with `rgba(34,197,94,0.08)` background, `--kv-pass` label, stacked label/description layout
- CSS classes: `.header-concepts`, `.concept-pill`

## Tooltips
All input fields have `?` tooltip badges (`.tip` with `data-tip`). Tooltip text covers:
- **Liquid investments** — what counts, note on illiquid property equity
- **Super balance** — preservation age lock-in, still counts for Coast FIRE / retirement 60+
- **Annual expenses** — include all costs and dependants (children)
- **Net rental income** — after-all-costs definition
- **Annual savings** — include employer super contributions
- **Age** — used to calculate FIRE age and years to retirement
- **Investment return** — total return (capital growth + dividends reinvested), AU historical ~9–10%, 7% is conservative
- **Dividend yield** — income yield only (not total return), AU high-yield ETFs/LICs ~4–5%
- **Inflation** — AU long-run ~2.5% context
- **Safe withdrawal rate** — 4% rule explanation, 3–3.5% for longer retirement
- **Dividend Target card** — portfolio needed to live off dividends without selling shares; lower yield = larger target

## Results
1. **Summary cards:** FIRE Number, Years to FIRE, Current Progress, Coast FIRE Number, Dividend Target
   - Dividend Target = `effectiveExpenses / dividendYield` — computed inline in `app.js`, not in `calc/fire.js`
2. **FIRE type table:** Lean (67% expenses) / Standard / Fat (167% expenses) — years away for each
3. **Portfolio growth chart:** portfolio line vs inflating FIRE target line (dashed); sensitivity ±1.5% toggle
4. **Year-by-year table:** collapsible `<details>` — Year, Age, Portfolio, Growth, Contributions, FIRE Number, Progress %

## Design System
CSS variables from kashvector design:
- `--kv-bg: #0f172a` / `--kv-card: #1e293b` / `--kv-text: #f1f5f9`
- `--kv-accent: #38bdf8` / `--kv-pass: #22c55e` / `--kv-fail: #ef4444` / `--kv-warn: #f59e0b`
- Layout: `grid-template-columns: 360px 1fr` — stacks at 780px
- `min-width: 0` on results panel (CSS grid gotcha)

## Testing
```bash
npm test
```
Key test cases: portfolio = FIRE number → 0 years; swr changes scale FIRE number correctly; coast FIRE discounting math; lean/fat multipliers.

## Deployment
1. Copy `www/` → `C:\Projects\StockAnalysis\www\fire\`
2. Push `kanurag4/stock-evaluator` → Cloudflare Pages auto-deploys

**SEO rule:** Before copying, check if the deployed `index.html` has richer SEO content (JSON-LD schema, detailed meta description) than the source. If so, port it to the source first. The deployed copy holds the canonical SEO metadata.

(Tool card and `fire.png` icon already added to StockAnalysis landing page.)

## Plan File
Full implementation plan: `C:\Users\Anurag\.claude\plans\i-am-making-financial-enumerated-diffie.md`
