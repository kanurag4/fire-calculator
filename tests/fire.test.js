const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeFireProjection, coastFireNumber, fireTypeBreakdown } = require('../www/calc/fire.js');

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
