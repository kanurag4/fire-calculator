# FIRE Calculator — Claude Code Guide

## Purpose
A Financial Independence, Retire Early (FIRE) calculator for kashvector.com/fire/. Helps users find their FIRE number, time to retire, and Coast FIRE target using the 4% rule. The FIRE Number is **tax-adjusted** — it accounts for 2026–27 income tax and CGT so the displayed number is the portfolio size needed to cover post-tax expenses after paying both income tax and capital gains tax on withdrawals.

## Tech Stack
Vanilla HTML/CSS/JS — no build step, no dependencies except Chart.js (CDN).

## File Structure
```
www/
├── index.html        ← single-page tool
├── app.js            ← ALL DOM, events, localStorage, chart rendering
├── utils.js          ← pure formatting: formatCurrency, parseMoney, formatMoneyInput
├── style.css         ← CSS custom properties (dark theme), two-column layout
├── kv-theme.js       ← shared anti-flash dark theme (copied from StockAnalysis)
└── calc/
    ├── tax.js        ← marginalRate(income) — 2026-27 Australian brackets
    ├── cgt.js        ← calcCGTPreBudget, calcCGTPostBudget, grossUpWithdrawal
    └── fire.js       ← pure projection engine (no DOM access)
tests/
└── fire.test.js      ← Node built-in test runner (27 tests)
package.json          ← { "test": "node --test tests/*.test.js" }
```

## Architecture Rules (from kashvector-lessons.md)
- **DOM boundary:** only `app.js` touches `document`, `window`, `localStorage`
- **calc/*.js** must be pure functions only — testable with Node, no DOM
- Add `if (typeof module !== 'undefined') module.exports = { ... }` at bottom of every calc file
- Money inputs: `type="text" inputmode="numeric"` — never `type="number"` for $ fields
- Use `parseMoney()` to strip commas before any calculation
- Use cursor-preserving `formatMoneyInput()` on every keystroke
- `localStorage` key: `kv_fire_inputs`
- Destroy Chart.js instance before recreating on each render

## Inputs
| Field | Default |
|---|---|
| Liquid investments | $50,000 |
| Super balance | $0 |
| Super contributions / year | $30,000 |
| Annual retirement expenses | $60,000 |
| Annual rental income | $0 |
| Annual savings / contributions | $25,000 |
| Current age | 30 |
| Investment return p.a. | 7% |
| Dividend yield p.a. | 4% |
| Inflation rate p.a. | 2.5% |
| Safe withdrawal rate | 4% |
| Income in retirement | $60,000 |
| Tax rate override | (blank = auto) |
| Assets acquired | Pre-12 May 2026 |
| Approximate purchase year | 2020 |
| Cost base ratio | 40% |

## Calculation Engine

### `calc/tax.js` — `marginalRate(income)` → rate
2026–27 Australian income tax brackets including 2% Medicare levy:
- $0–$18,200 → 0%
- $18,201–$45,000 → 17%
- $45,001–$135,000 → 32%
- $135,001–$190,000 → 39%
- $190,001+ → 47%
Returns 0 for null/undefined/non-finite input.

### `calc/cgt.js`

**`calcCGTPreBudget({ marginalRate, costBaseRatio, purchaseYear, fireYear, investmentReturn, inflation })`** → CGT per $1 sold
- Assets acquired before 12 May 2026
- Splits gain at 1 July 2027 (TRANSITION = 2027.5) using investmentReturn to estimate fraction
- Pre-transition gain: 50% CGT discount at marginalRate
- Post-transition gain: inflation-indexed cost base, taxed at max(0.30, marginalRate)
- If fireYear ≤ 2027.5: all gain uses 50% discount (no split needed)

**`calcCGTPostBudget({ marginalRate, costBaseRatio, yearsToFire, inflation })`** → CGT per $1 sold
- Assets acquired after 12 May 2026
- Cost base indexed by inflation over yearsToFire; gain above that taxed at max(0.30, marginalRate)

**`grossUpWithdrawal(netExpenses, cgtPerDollar)`** → gross withdrawal needed
- Returns `netExpenses / (1 - cgtPerDollar)`

### `calc/fire.js` — `computeFireProjection(inputs)` → `rows[]`
Nominal projection loop — portfolio grows by return, FIRE number inflates each year:
```
fireNumber(y) = annualExpenses × (1+inflation)^y / swr
portfolio(y)  = portfolio(y-1) × (1+return) + annualSavings
```
`annualExpenses` passed in is already the **grossed-up** withdrawal (tax-adjusted) — tax logic is applied upstream in `app.js`.

Each row: `{ year, age, liquidPortfolio, superBalance, portfolio, contributions, growth, fireNumber, pctToFire, fireReached }`

Super tracked separately: grows at same `investmentReturn` but locked until ~60. Included in combined `portfolio` for FIRE comparison.

### `coastFireNumber(annualExpenses, swr, investmentReturn, inflation, currentAge, coastAge)` → `$`
Discounts the inflation-adjusted FIRE number back from `coastAge` to today.

### Tax gross-up flow in `app.js`
1. First-pass untaxed projection → estimate `yearsToFire`
2. Compute `fireYear = currentYear + yearsToFire`
3. Calculate `cgtPerDollar` via `calcCGTPreBudget` or `calcCGTPostBudget`
4. `grossWithdrawal = grossUpWithdrawal(effectiveExpenses, cgtPerDollar)`
5. Second-pass projection using `grossWithdrawal` as `annualExpenses`

## Header
- Logo links to `../` with `← All tools` label below (`home-logo-label`) — required per KashVector design spec
- One-line description + 3 green concept pills: **FIRE Number**, **Coast FIRE**, **Lean / Fat FIRE**
- Pills styled with `rgba(34,197,94,0.08)` background, `--kv-pass` label, stacked label/description layout
- CSS classes: `.header-concepts`, `.concept-pill`

## Tooltips
All input fields have `?` tooltip badges (`.tip` with `data-tip`). Key tooltip text:
- **Liquid investments** — what counts, note on illiquid property equity
- **Super balance** — preservation age lock-in, still counts for Coast FIRE / retirement 60+
- **Super contributions** — employer SG (currently 12%) plus salary sacrifice / personal contributions
- **Annual expenses** — include all costs and dependants; rental income entered below reduces drawdown
- **Annual rental income** — after ALL costs (mortgage interest, rates, insurance, maintenance, management). Leave blank if none.
- **Annual savings** — liquid investments only, exclude super
- **Investment return** — total return (capital growth + dividends reinvested), AU historical ~9–10%, 7% conservative
- **Dividend yield** — income yield only (not total return), AU high-yield ETFs/LICs ~4–5%
- **Inflation** — AU long-run ~2.5% context
- **Safe withdrawal rate** — 4% rule explanation, 3–3.5% for longer retirement
- **Income in retirement** — assessable income used to auto-calculate marginal rate; 2026-27 rates applied
- **Tax rate override** — overrides auto-calculated rate; placeholder shows current auto rate
- **Assets acquired** — pre/post 12 May 2026 determines CGT rules applied
- **Purchase year** — used to split pre/post-1 July 2027 gain for pre-budget assets
- **Cost base ratio** — % of portfolio that is original cost; lower = more taxable gain per $ sold

## Results
1. **Summary cards:** FIRE Number (tax-adjusted), Years to FIRE, Current Progress, Coast FIRE Number, Dividend Target
   - FIRE Number card shows: tax-adjusted number, income tax %, CGT %, "Without tax: $X" comparison
   - Dividend Target = `effectiveExpenses / dividendYield` — computed inline in `app.js`
2. **FIRE type table:** Lean (67% expenses) / Standard / Fat (167% expenses) — years away for each
3. **Portfolio growth chart:** portfolio line vs inflating FIRE target line (dashed); sensitivity ±1.5% toggle
4. **Year-by-year table:** collapsible `<details>` — Year, Age, Portfolio, Growth, Contributions, FIRE Number, Progress %

## Design System
CSS variables from kashvector design:
- `--kv-bg: #0f172a` / `--kv-card: #1e293b` / `--kv-text: #f1f5f9`
- `--kv-accent: #38bdf8` / `--kv-pass: #22c55e` / `--kv-fail: #ef4444` / `--kv-warn: #f59e0b`
- Layout: `grid-template-columns: 360px 1fr` — stacks at 800px
- `min-width: 0` on results panel (CSS grid gotcha)
- `select` elements: styled to match theme via `.field select` (bg, border, color, radius)

## Testing
```bash
npm test
```
27 tests covering: projection engine, super tracking, coast FIRE math, lean/fat multipliers, all tax bracket boundaries, CGT pre/post-budget, grossUpWithdrawal edge cases.

## Deployment
1. Copy `www/` → `C:\Projects\StockAnalysis\www\fire\`
2. Stage: `git add www/fire/... www/index.html` (include landing page if changed)
3. Push `kanurag4/stock-evaluator` → Cloudflare Pages auto-deploys

**SEO rule:** Before copying, check if the deployed `index.html` has richer SEO content (JSON-LD schema, detailed meta description) than the source. If so, port it to the source first.

**Landing page:** FIRE Calculator card at `StockAnalysis/www/index.html` has `featured-card` class and `✓ 2026–27 Federal Budget Ready` badge. Update that file too whenever the card description changes.

(Header uses `fire-icon.svg`; `fire.png` is legacy — do not reference it.)
