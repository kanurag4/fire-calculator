const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeFireProjection, coastFireNumber, fireTypeBreakdown } = require('../www/calc/fire.js');
const { marginalRate } = require('../www/calc/tax.js');
const { calcCGTPreBudget, calcCGTPostBudget, grossUpWithdrawal } = require('../www/calc/cgt.js');

const near = (actual, expected, tol, msg) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg || ''} Expected ~${expected} (±${tol}), got ${actual.toFixed(2)}`
  );

// ── computeFireProjection ────────────────────────────────────────────────────

test('already at FIRE number reaches FIRE in year 1', () => {
  const fireNumber = 60000 / 0.04; // $1,500,000
  const rows = computeFireProjection({
    currentPortfolio: fireNumber,
    annualExpenses: 60000,
    annualSavings: 0,
    investmentReturn: 0.07,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 40,
  });
  assert.equal(rows[0].fireReached, true);
  assert.equal(rows.length, 1);
});

test('returns correct age for each row', () => {
  const rows = computeFireProjection({
    currentPortfolio: 0,
    annualExpenses: 40000,
    annualSavings: 50000,
    investmentReturn: 0.07,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
  });
  rows.forEach(r => assert.equal(r.age, 30 + r.year));
});

test('portfolio grows each year with contributions and return', () => {
  const rows = computeFireProjection({
    currentPortfolio: 100000,
    annualExpenses: 999999,
    annualSavings: 20000,
    investmentReturn: 0.07,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
    maxYears: 3,
  });
  assert.equal(rows.length, 3);
  near(rows[0].portfolio, 100000 * 1.07 + 20000, 1, 'Year 1 portfolio');
  near(rows[1].portfolio, rows[0].portfolio * 1.07 + 20000, 1, 'Year 2 portfolio');
});

test('zero annual savings still grows via investment return', () => {
  const rows = computeFireProjection({
    currentPortfolio: 500000,
    annualExpenses: 999999,
    annualSavings: 0,
    investmentReturn: 0.1,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
    maxYears: 2,
  });
  near(rows[0].portfolio, 550000, 1, 'Year 1 with 10% return, no contributions');
  near(rows[0].growth, 50000, 1, 'Growth = 10% of 500k');
});

test('higher SWR gives smaller FIRE number and fewer years', () => {
  const baseInputs = {
    currentPortfolio: 0,
    annualExpenses: 60000,
    annualSavings: 30000,
    investmentReturn: 0.07,
    inflation: 0.025,
    currentAge: 30,
  };
  const rows3 = computeFireProjection({ ...baseInputs, swr: 0.03 });
  const rows4 = computeFireProjection({ ...baseInputs, swr: 0.04 });
  const rows5 = computeFireProjection({ ...baseInputs, swr: 0.05 });
  const fire3 = rows3.find(r => r.fireReached);
  const fire4 = rows4.find(r => r.fireReached);
  const fire5 = rows5.find(r => r.fireReached);
  assert.ok(fire3.year > fire4.year, '3% SWR takes longer than 4%');
  assert.ok(fire4.year > fire5.year, '4% SWR takes longer than 5%');
});

test('pctToFire reaches 100 on fireReached row', () => {
  const rows = computeFireProjection({
    currentPortfolio: 0,
    annualExpenses: 40000,
    annualSavings: 50000,
    investmentReturn: 0.07,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
  });
  const fireRow = rows.find(r => r.fireReached);
  assert.ok(fireRow, 'Should reach FIRE');
  near(fireRow.pctToFire, 100, 0.01, 'pctToFire on fire row');
});

test('maxYears caps projection when FIRE unreachable', () => {
  const rows = computeFireProjection({
    currentPortfolio: 0,
    annualExpenses: 2000000,
    annualSavings: 1000,
    investmentReturn: 0.07,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
    maxYears: 10,
  });
  assert.equal(rows.length, 10);
  assert.ok(rows.every(r => !r.fireReached));
});

test('super contributions grow separately at investmentReturn', () => {
  const rows = computeFireProjection({
    liquidPortfolio: 100000,
    superBalance: 50000,
    annualExpenses: 999999,
    annualSavings: 10000,
    annualSuperContributions: 5000,
    investmentReturn: 0.10,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
    maxYears: 2,
  });
  // Year 1: liquid = 100000*1.1 + 10000 = 120000, super = 50000*1.1 + 5000 = 60000
  near(rows[0].liquidPortfolio, 120000, 1, 'Year 1 liquid portfolio');
  near(rows[0].superBalance, 60000, 1, 'Year 1 super balance');
  near(rows[0].portfolio, 180000, 1, 'Year 1 combined portfolio');
  near(rows[0].contributions, 15000, 1, 'Year 1 total contributions');
});

test('zero super contributions leaves super balance growing by return only', () => {
  const rows = computeFireProjection({
    liquidPortfolio: 0,
    superBalance: 100000,
    annualExpenses: 999999,
    annualSavings: 0,
    annualSuperContributions: 0,
    investmentReturn: 0.08,
    inflation: 0.025,
    swr: 0.04,
    currentAge: 30,
    maxYears: 1,
  });
  near(rows[0].superBalance, 108000, 1, 'Super grows by return only');
  near(rows[0].liquidPortfolio, 0, 1, 'Liquid stays zero');
});

// ── coastFireNumber ──────────────────────────────────────────────────────────

test('coastFireNumber returns correct discounted value', () => {
  const annualExpenses = 60000;
  const swr = 0.04;
  const investmentReturn = 0.07;
  const inflation = 0.025;
  const currentAge = 30;
  const coastAge = 65;
  const yearsToCoast = 35;

  const inflatedFire = (annualExpenses * Math.pow(1 + inflation, yearsToCoast)) / swr;
  const expected = inflatedFire / Math.pow(1 + investmentReturn, yearsToCoast);

  const result = coastFireNumber(annualExpenses, swr, investmentReturn, inflation, currentAge, coastAge);
  near(result, expected, 1, 'Coast FIRE discounting');
});

test('coastFireNumber when already at coast age returns todays FIRE number', () => {
  const result = coastFireNumber(60000, 0.04, 0.07, 0.025, 65, 65);
  near(result, 60000 / 0.04, 1, 'Coast age = current age → today FIRE number');
});

// ── fireTypeBreakdown ────────────────────────────────────────────────────────

test('fireTypeBreakdown returns 3 types', () => {
  const types = fireTypeBreakdown(60000, 0.04, 0.07, 0.025, 50000, 25000, 30);
  assert.equal(types.length, 3);
  assert.equal(types[0].name, 'Lean FIRE');
  assert.equal(types[1].name, 'Your FIRE');
  assert.equal(types[2].name, 'Fat FIRE');
});

test('fireTypeBreakdown lean expenses are 67% of user expenses', () => {
  const expenses = 60000;
  const types = fireTypeBreakdown(expenses, 0.04, 0.07, 0.025, 50000, 25000, 30);
  near(types[0].annualExpenses, expenses * 0.67, 1, 'Lean = 67%');
  near(types[2].annualExpenses, expenses * 1.67, 1, 'Fat = 167%');
});

test('fireTypeBreakdown lean FIRE reached before fat FIRE', () => {
  const types = fireTypeBreakdown(60000, 0.04, 0.07, 0.025, 0, 40000, 30);
  const lean = types[0];
  const fat = types[2];
  assert.ok(lean.yearsToFire !== null, 'Lean FIRE should be reached');
  if (fat.yearsToFire !== null) {
    assert.ok(lean.yearsToFire < fat.yearsToFire, 'Lean reached before Fat');
  }
});

// ── marginalRate (tax brackets) ──────────────────────────────────────────────

test('marginalRate returns 0 below threshold', () => {
  assert.equal(marginalRate(0), 0);
  assert.equal(marginalRate(18200), 0);
});

test('marginalRate returns correct rates for 2026-27 brackets', () => {
  near(marginalRate(30000), 0.17, 0.001, 'Income $30k = 17% rate');
  near(marginalRate(80000), 0.32, 0.001, 'Income $80k = 32% rate');
  near(marginalRate(150000), 0.39, 0.001, 'Income $150k = 39% rate');
  near(marginalRate(200000), 0.47, 0.001, 'Income $200k = 47% rate');
});

test('marginalRate handles null/invalid input safely', () => {
  assert.equal(marginalRate(null), 0);
  assert.equal(marginalRate(undefined), 0);
  assert.equal(marginalRate(NaN), 0);
  assert.equal(marginalRate(Infinity), 0);  // Non-finite values return 0
});

// ── grossUpWithdrawal ────────────────────────────────────────────────────────

test('grossUpWithdrawal with zero CGT returns original amount', () => {
  near(grossUpWithdrawal(60000, 0), 60000, 1, 'Zero CGT');
});

test('grossUpWithdrawal correctly grosses up for tax', () => {
  near(grossUpWithdrawal(60000, 0.10), 66666.67, 1, '10% tax requires 11.1% gross-up');
  near(grossUpWithdrawal(60000, 0.20), 75000, 1, '20% tax requires 25% gross-up');
});

test('grossUpWithdrawal handles high tax rates', () => {
  near(grossUpWithdrawal(60000, 0.47), 113207.55, 10, '47% tax requires 113% gross-up');
});

// ── calcCGTPostBudget ────────────────────────────────────────────────────────

test('calcCGTPostBudget returns 0 when cost base ratio is 100% (no gain)', () => {
  const result = calcCGTPostBudget({
    marginalRate: 0.32,
    costBaseRatio: 1.0,
    yearsToFire: 20,
    inflation: 0.025
  });
  near(result, 0, 0.001, 'No gain = no CGT');
});

test('calcCGTPostBudget applies inflation indexation', () => {
  const result = calcCGTPostBudget({
    marginalRate: 0.32,
    costBaseRatio: 0.40,  // 60% gain
    yearsToFire: 20,
    inflation: 0.025
  });
  assert.ok(result > 0, 'Should have some tax');
  assert.ok(result < 0.60 * 0.32, 'Inflation reduces taxable gain');
});

test('calcCGTPostBudget uses 30% floor when marginal rate is lower', () => {
  const result = calcCGTPostBudget({
    marginalRate: 0.17,  // Below 30% floor
    costBaseRatio: 0.50,
    yearsToFire: 10,
    inflation: 0.025
  });
  // Inflation reduces indexed gain: indexedBase = 0.50 * (1.025^10) ≈ 0.64
  // indexedGain = max(1.0 - 0.64, 0) ≈ 0.36
  // CGT = 0.36 * max(0.30, 0.17) = 0.36 * 0.30 ≈ 0.108
  near(result, 0.108, 0.01, 'Should apply 30% floor to indexed gain');
});

// ── calcCGTPreBudget ─────────────────────────────────────────────────────────

test('calcCGTPreBudget returns 0 when cost base ratio is 100%', () => {
  const result = calcCGTPreBudget({
    marginalRate: 0.32,
    costBaseRatio: 1.0,
    purchaseYear: 2015,
    fireYear: 2035,
    investmentReturn: 0.07,
    inflation: 0.025
  });
  near(result, 0, 0.001, 'No gain = no CGT');
});

test('calcCGTPreBudget FIRE before transition uses 50% discount fully', () => {
  const result = calcCGTPreBudget({
    marginalRate: 0.32,
    costBaseRatio: 0.40,
    purchaseYear: 2015,
    fireYear: 2026,  // Before 1 July 2027 transition
    investmentReturn: 0.07,
    inflation: 0.025
  });
  // All gain uses 50% discount: 0.60 * 0.5 * 0.32 = 0.096
  near(result, 0.096, 0.001, 'Full 50% discount before transition');
});

test('calcCGTPreBudget FIRE after transition splits gain at 1 July 2027', () => {
  const result = calcCGTPreBudget({
    marginalRate: 0.32,
    costBaseRatio: 0.40,
    purchaseYear: 2015,
    fireYear: 2035,  // After transition
    investmentReturn: 0.07,
    inflation: 0.025
  });
  assert.ok(result > 0, 'Should have CGT');
  // Pre-transition: 50% discount, Post-transition: indexation at 30%+
  // Result should be between pure 50% discount (0.096) and full indexation (0.18)
  assert.ok(result < 0.60 * 0.32, 'Less than full marginal rate');
});

test('calcCGTPreBudget handles recent purchase year (small pre-transition gain)', () => {
  const result = calcCGTPreBudget({
    marginalRate: 0.32,
    costBaseRatio: 0.40,
    purchaseYear: 2025,  // Recent purchase
    fireYear: 2035,
    investmentReturn: 0.07,
    inflation: 0.025
  });
  assert.ok(result > 0.096, 'Should be more than pre-discount only');
  assert.ok(result < 0.60 * 0.32, 'Still less than full rate');
});
