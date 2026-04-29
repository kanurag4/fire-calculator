function computeFireProjection(inputs) {
  const {
    liquidPortfolio,
    currentPortfolio = 0,
    superBalance = 0,
    annualExpenses = 60000,
    annualSavings = 25000,
    annualSuperContributions = 0,
    investmentReturn = 0.07,
    inflation = 0.025,
    swr = 0.04,
    currentAge = 30,
    maxYears = 50,
  } = inputs;

  // backward compat: if liquidPortfolio not provided, treat currentPortfolio as liquid
  const initLiquid = liquidPortfolio != null ? liquidPortfolio : currentPortfolio;

  const rows = [];
  let liquid = initLiquid;
  let superBal = superBalance;

  for (let year = 1; year <= maxYears; year++) {
    const inflationFactor = Math.pow(1 + inflation, year);
    const fireNumber = swr > 0 ? (annualExpenses * inflationFactor) / swr : Infinity;
    const liquidGrowth = liquid * investmentReturn;
    const superGrowth = superBal * investmentReturn;
    const growth = liquidGrowth + superGrowth;
    liquid = liquid + liquidGrowth + annualSavings;
    superBal = superBal + superGrowth + annualSuperContributions;
    const portfolio = liquid + superBal;
    const pctToFire = fireNumber > 0 && isFinite(fireNumber)
      ? Math.min((portfolio / fireNumber) * 100, 100)
      : 0;
    const fireReached = portfolio >= fireNumber;

    rows.push({
      year,
      age: currentAge + year,
      portfolio,
      liquidPortfolio: liquid,
      superBalance: superBal,
      growth,
      contributions: annualSavings + annualSuperContributions,
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

function fireTypeBreakdown(annualExpenses, swr, investmentReturn, inflation, currentPortfolio, annualSavings, currentAge, superBalance = 0, annualSuperContributions = 0) {
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
      superBalance,
      annualExpenses: expenses,
      annualSavings,
      annualSuperContributions,
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
