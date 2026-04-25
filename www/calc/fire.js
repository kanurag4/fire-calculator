function computeFireProjection(inputs) {
  const {
    currentPortfolio = 0,
    annualExpenses = 60000,
    annualSavings = 25000,
    investmentReturn = 0.07,
    inflation = 0.025,
    swr = 0.04,
    currentAge = 30,
    maxYears = 50,
  } = inputs;

  const rows = [];
  let portfolio = currentPortfolio;

  for (let year = 1; year <= maxYears; year++) {
    const inflationFactor = Math.pow(1 + inflation, year);
    const fireNumber = swr > 0 ? (annualExpenses * inflationFactor) / swr : Infinity;
    const growth = portfolio * investmentReturn;
    portfolio = portfolio + growth + annualSavings;
    const pctToFire = fireNumber > 0 && isFinite(fireNumber)
      ? Math.min((portfolio / fireNumber) * 100, 100)
      : 0;
    const fireReached = portfolio >= fireNumber;

    rows.push({
      year,
      age: currentAge + year,
      portfolio,
      growth,
      contributions: annualSavings,
      fireNumber,
      pctToFire,
      fireReached,
    });

    if (fireReached) break;
  }

  return rows;
}

function coastFireNumber(annualExpenses, swr, investmentReturn, inflation, currentAge, coastAge) {
  const retirementAge = coastAge || 65;
  const yearsToCoast = Math.max(retirementAge - currentAge, 0);
  if (yearsToCoast === 0) return annualExpenses / swr;
  const inflationFactor = Math.pow(1 + inflation, yearsToCoast);
  const fireNumberAtRetirement = swr > 0 ? (annualExpenses * inflationFactor) / swr : Infinity;
  return fireNumberAtRetirement / Math.pow(1 + investmentReturn, yearsToCoast);
}

function fireTypeBreakdown(annualExpenses, swr, investmentReturn, inflation, currentPortfolio, annualSavings, currentAge) {
  const types = [
    { name: 'Lean FIRE', multiplier: 0.67 },
    { name: 'Your FIRE', multiplier: 1.0 },
    { name: 'Fat FIRE', multiplier: 1.67 },
  ];

  return types.map(t => {
    const expenses = annualExpenses * t.multiplier;
    const fireNumber = swr > 0 ? expenses / swr : Infinity;
    const rows = computeFireProjection({
      currentPortfolio,
      annualExpenses: expenses,
      annualSavings,
      investmentReturn,
      inflation,
      swr,
      currentAge,
    });
    const fireRow = rows.find(r => r.fireReached);
    return {
      name: t.name,
      annualExpenses: expenses,
      fireNumber,
      yearsToFire: fireRow ? fireRow.year : null,
      fireAge: fireRow ? fireRow.age : null,
    };
  });
}

if (typeof module !== 'undefined') module.exports = { computeFireProjection, coastFireNumber, fireTypeBreakdown };
