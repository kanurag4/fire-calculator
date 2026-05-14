// Capital Gains Tax calculations for Australian FIRE planning
// Per budget26.md: pre-budget assets (before 12 May 2026) use 50% discount until 1 July 2027,
// then indexation. Post-budget assets use inflation indexation + 30% minimum rate.

/**
 * Returns CGT per $1 of portfolio sold — pre-budget assets (acquired before 12 May 2026).
 * Uses split-gain logic from budget26.md: pre-transition gain gets 50% discount,
 * post-transition gain uses indexation at max(30%, marginalRate).
 *
 * @param {number} marginalRate - Income tax marginal rate (0-0.47)
 * @param {number} costBaseRatio - Fraction of portfolio that is original cost (0-1, e.g. 0.40)
 * @param {number} purchaseYear - Year assets were acquired (e.g. 2020)
 * @param {number} fireYear - Year user expects to reach FIRE (e.g. 2040)
 * @param {number} investmentReturn - Historical/expected investment return (0.01-0.15)
 * @param {number} inflation - Inflation rate (0.01-0.05)
 * @returns {number} Effective CGT cost as fraction of gross withdrawal (0-1)
 */
function calcCGTPreBudget({ marginalRate, costBaseRatio, purchaseYear, fireYear, investmentReturn, inflation }) {
  const TRANSITION = 2027.5; // 1 July 2027
  const cbr = costBaseRatio;
  const totalGainPerDollar = 1 - cbr; // e.g. 0.60 = gain portion of each $1 sold

  // Edge case: FIRE before transition date — all gain uses 50% discount
  if (fireYear <= TRANSITION) {
    return totalGainPerDollar * 0.5 * marginalRate;
  }

  const yearsToTransition = Math.max(0, TRANSITION - purchaseYear);
  const yearsAfterTransition = Math.max(0, fireYear - TRANSITION);

  // Estimate fraction of total gain that is pre-transition using investmentReturn
  const gft = Math.pow(1 + investmentReturn, yearsToTransition); // growth factor to transition
  const gff = Math.pow(1 + investmentReturn, yearsAfterTransition); // growth factor transition to FIRE
  const totalGF = gft * gff;
  const fractionPre = totalGF > 1 ? (gft - 1) / (totalGF - 1) : 0;

  const preGain  = totalGainPerDollar * fractionPre;
  const postGain = totalGainPerDollar * (1 - fractionPre);

  // Pre-transition (before 1 July 2027): 50% CGT discount
  const preCGT = preGain * 0.5 * marginalRate;

  // Post-transition (after 1 July 2027): indexation + 30% floor
  const valueAtTransition = cbr + preGain; // cost base + pre-transition gain
  const inflationFactor = Math.pow(1 + inflation, yearsAfterTransition);
  const indexedBase = valueAtTransition * inflationFactor;
  const indexedGain = Math.max(1 - indexedBase, 0); // 1 = sale price per $1 of portfolio
  const postCGT = indexedGain * Math.max(0.30, marginalRate);

  return preCGT + postCGT;
}

/**
 * Returns CGT per $1 of portfolio sold — post-budget assets (acquired after 12 May 2026).
 * Full gain is taxable; minimum 30% CGT rate; inflation indexation applied at retirement.
 *
 * @param {number} marginalRate - Income tax marginal rate (0-0.47)
 * @param {number} costBaseRatio - Fraction of portfolio that is original cost (0-1)
 * @param {number} yearsToFire - Estimated years until FIRE (e.g. 15)
 * @param {number} inflation - Inflation rate (0.01-0.05)
 * @returns {number} Effective CGT cost as fraction of gross withdrawal (0-1)
 */
function calcCGTPostBudget({ marginalRate, costBaseRatio, yearsToFire, inflation }) {
  const cbr = costBaseRatio;
  // Inflation indexation reduces the taxable gain: cost base grows with inflation
  const inflationFactor = Math.pow(1 + inflation, yearsToFire);
  const indexedBase = cbr * inflationFactor;
  const indexedGain = Math.max(1 - indexedBase, 0); // per $1 of portfolio sold
  const cgtRate = Math.max(0.30, marginalRate); // 30% minimum
  return indexedGain * cgtRate;
}

/**
 * Given net expenses needed after all taxes, returns gross withdrawal required.
 *
 * @param {number} netExpenses - Post-tax annual spending (e.g. 60000)
 * @param {number} cgtPerDollar - Effective CGT cost per $1 of portfolio sold (0-1)
 * @returns {number} Gross annual withdrawal needed (before CGT)
 */
function grossUpWithdrawal(netExpenses, cgtPerDollar) {
  const denom = 1 - cgtPerDollar;
  return denom > 0 ? netExpenses / denom : netExpenses;
}

if (typeof module !== 'undefined') module.exports = { calcCGTPreBudget, calcCGTPostBudget, grossUpWithdrawal };
