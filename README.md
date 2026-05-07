# FIRE Calculator

A Financial Independence, Retire Early (FIRE) calculator. Helps you find your FIRE number, time to retire, and Coast FIRE target using the 4% rule.

Live at: [kashvector.com/fire/](https://kashvector.com/fire/)

## Features

- **FIRE Number** — how much you need to retire based on your expenses and safe withdrawal rate
- **Coast FIRE** — the portfolio size you need today to coast to retirement without further contributions
- **Lean / Fat FIRE** — years to retire at 67% or 167% of your target expenses
- **Dividend Target** — portfolio needed to live off dividends without selling shares
- **Portfolio growth chart** — portfolio vs inflating FIRE target, with ±1.5% sensitivity toggle
- **Year-by-year table** — full projection breakdown

## Tech Stack

Vanilla HTML/CSS/JS — no build step, no dependencies except [Chart.js](https://www.chartjs.org/) (CDN).

## File Structure

```
www/
├── index.html        ← single-page tool
├── app.js            ← DOM, events, localStorage, chart rendering
├── utils.js          ← pure formatting utilities
├── style.css         ← CSS custom properties (dark theme), two-column layout
└── calc/
    └── fire.js       ← pure projection engine (no DOM access)
tests/
└── fire.test.js      ← Node built-in test runner
package.json
```

## Inputs

| Field | Default |
|---|---|
| Current portfolio | $0 |
| Annual retirement expenses | $60,000 |
| Annual savings / contributions | $25,000 |
| Current age | 30 |
| Investment return p.a. | 7% |
| Dividend yield p.a. | 4% |
| Inflation rate p.a. | 2.5% |
| Safe withdrawal rate | 4% |
| Super balance (optional) | $0 |
| Super contribution rate (optional) | 12% |

## Calculation

### FIRE Projection (`calc/fire.js`)

Nominal projection loop — portfolio grows by return, FIRE number inflates each year:

```
fireNumber(y) = annualExpenses × (1 + inflation)^y / swr
portfolio(y)  = portfolio(y-1) × (1 + return) + annualSavings
```

### Coast FIRE

```
coastFire = fireNumber / (1 + investmentReturn)^yearsToCoast
```

## Running Tests

```bash
npm test
```

Uses Node's built-in test runner — no extra dependencies required.

## Deployment

Copy `www/` to your web server or static hosting provider. Cloudflare Pages auto-deploys on push to `kanurag4/stock-evaluator`.
