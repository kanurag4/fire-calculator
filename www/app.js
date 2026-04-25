'use strict';

const $ = id => document.getElementById(id);

const els = {
  portfolio:         $('portfolio'),
  expenses:          $('expenses'),
  savings:           $('savings'),
  age:               $('age'),
  returnRate:        $('returnRate'),
  inflation:         $('inflation'),
  swr:               $('swr'),
  summaryCards:      $('summaryCards'),
  fireTypeBody:      $('fireTypeBody'),
  yearTableBody:     $('yearTableBody'),
  yearDetails:       $('yearDetails'),
  sensitivityToggle: $('sensitivityToggle'),
  fireNumberDerived: $('fireNumberDerived'),
  realReturnDerived: $('realReturnDerived'),
  savingsHint:       $('savingsHint'),
};

const STORAGE_KEY = 'kv_fire_inputs';

const DEFAULTS = {
  portfolio:  '50,000',
  expenses:   '60,000',
  savings:    '25,000',
  age:        30,
  returnRate: 7,
  inflation:  2.5,
  swr:        4,
};

let fireChart = null;
let debounceTimer = null;

// ── Init ─────────────────────────────────────────────────────────────────────

loadFromStorage();
updateDerivedDisplays();
bindEvents();
renderResults();

// ── Storage ──────────────────────────────────────────────────────────────────

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    portfolio:  els.portfolio.value,
    expenses:   els.expenses.value,
    savings:    els.savings.value,
    age:        els.age.value,
    returnRate: els.returnRate.value,
    inflation:  els.inflation.value,
    swr:        els.swr.value,
  }));
}

function loadFromStorage() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) {}
  const d = Object.assign({}, DEFAULTS, saved);

  els.portfolio.value  = d.portfolio;
  els.expenses.value   = d.expenses;
  els.savings.value    = d.savings;
  els.age.value        = d.age;
  els.returnRate.value = d.returnRate;
  els.inflation.value  = d.inflation;
  els.swr.value        = d.swr;
}

// ── Events ───────────────────────────────────────────────────────────────────

function bindEvents() {
  [els.portfolio, els.expenses, els.savings].forEach(el => {
    el.addEventListener('input', () => {
      formatMoneyInput(el);
      saveToStorage();
      updateDerivedDisplays();
      scheduleRender();
    });
  });

  [els.age, els.returnRate, els.inflation, els.swr].forEach(el => {
    el.addEventListener('input', () => {
      saveToStorage();
      updateDerivedDisplays();
      scheduleRender();
    });
  });

  els.sensitivityToggle.addEventListener('change', renderResults);

  els.yearDetails.addEventListener('toggle', () => {
    if (fireChart) fireChart.resize();
  });
}

function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderResults, 280);
}

// ── Derived displays ─────────────────────────────────────────────────────────

function updateDerivedDisplays() {
  const expenses   = parseMoney(els.expenses);
  const swr        = parseFloat(els.swr.value) / 100 || 0.04;
  const ret        = parseFloat(els.returnRate.value) / 100 || 0;
  const inf        = parseFloat(els.inflation.value) / 100 || 0;
  const savings    = parseMoney(els.savings);

  els.fireNumberDerived.textContent = expenses > 0 && swr > 0
    ? `FIRE Number: ${formatCurrency(expenses / swr)}`
    : '';

  const realReturn = ((1 + ret) / (1 + inf) - 1) * 100;
  els.realReturnDerived.textContent = `Real return: ${realReturn.toFixed(2)}% p.a.`;

  const superContrib = Math.round(savings * 0.12 / 1.12);
  els.savingsHint.textContent = savings > 0
    ? `~${formatCurrency(superContrib)} of this may be employer super (12% SG)`
    : '';
}

// ── Input reading ─────────────────────────────────────────────────────────────

function getInputs() {
  return {
    currentPortfolio: parseMoney(els.portfolio),
    annualExpenses:   parseMoney(els.expenses),
    annualSavings:    parseMoney(els.savings),
    investmentReturn: parseFloat(els.returnRate.value) / 100 || 0,
    inflation:        parseFloat(els.inflation.value) / 100 || 0,
    swr:              parseFloat(els.swr.value) / 100 || 0.04,
    currentAge:       parseInt(els.age.value, 10) || 30,
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderResults() {
  const inputs = getInputs();
  const rows   = computeFireProjection(inputs);
  const fireRow = rows.find(r => r.fireReached) || null;

  const todayFireNumber = inputs.swr > 0 ? inputs.annualExpenses / inputs.swr : 0;
  const coast = coastFireNumber(
    inputs.annualExpenses, inputs.swr, inputs.investmentReturn,
    inputs.inflation, inputs.currentAge
  );

  renderCards(inputs, fireRow, todayFireNumber, coast);
  renderFireTypeTable(inputs);
  renderChart(inputs, rows);
  renderYearTable(rows);
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function renderCards(inputs, fireRow, fireNumber, coastFire) {
  const yearsToFire = fireRow ? fireRow.year : null;
  const fireAge     = fireRow ? fireRow.age  : null;
  const pct = fireNumber > 0
    ? Math.min((inputs.currentPortfolio / fireNumber) * 100, 100)
    : 0;

  const yearsClass = yearsToFire && yearsToFire <= 30 ? 'pass' : yearsToFire ? 'warn' : 'fail';
  const coastReached = inputs.currentPortfolio >= coastFire;

  els.summaryCards.innerHTML = `
    <div class="card summary-card">
      <div class="card-label">FIRE Number</div>
      <div class="card-value">${formatCurrency(fireNumber)}</div>
      <div class="card-sub">${(inputs.swr * 100).toFixed(1)}% withdrawal rate · ${formatCurrency(inputs.annualExpenses)}/yr</div>
    </div>
    <div class="card summary-card ${yearsClass}">
      <div class="card-label">Years to FIRE</div>
      <div class="card-value">${yearsToFire ? yearsToFire : '50+'}</div>
      <div class="card-sub">${yearsToFire ? `Retire at age ${fireAge}` : 'Increase savings or reduce expenses'}</div>
    </div>
    <div class="card summary-card">
      <div class="card-label">Current Progress</div>
      <div class="card-value">${pct.toFixed(1)}%</div>
      <div class="card-sub">${formatCurrency(inputs.currentPortfolio)} of ${formatCurrency(fireNumber)}</div>
    </div>
    <div class="card summary-card ${coastReached ? 'pass' : ''}">
      <div class="card-label">Coast FIRE Number</div>
      <div class="card-value">${formatCurrency(coastFire)}</div>
      <div class="card-sub">${coastReached ? 'Already reached — you can coast to 65' : 'Needed now to grow to FIRE by age 65'}</div>
    </div>
  `;
}

// ── FIRE type table ───────────────────────────────────────────────────────────

function renderFireTypeTable(inputs) {
  const types = fireTypeBreakdown(
    inputs.annualExpenses, inputs.swr, inputs.investmentReturn,
    inputs.inflation, inputs.currentPortfolio, inputs.annualSavings, inputs.currentAge
  );

  els.fireTypeBody.innerHTML = types.map(t => {
    const isUser = t.name === 'Your FIRE';
    const years  = t.yearsToFire ? `${t.yearsToFire} yrs` : '50+';
    const age    = t.fireAge     ? `Age ${t.fireAge}` : '—';
    return `
      <tr class="${isUser ? 'type-highlight' : ''}">
        <td>${t.name}</td>
        <td>${formatCurrency(t.annualExpenses)}/yr</td>
        <td>${formatCurrency(t.fireNumber)}</td>
        <td>${years}</td>
        <td>${age}</td>
      </tr>
    `;
  }).join('');
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function padTo(arr, len) {
  const out = arr.slice(0, len);
  while (out.length < len) out.push(null);
  return out;
}

function renderChart(inputs, rows) {
  const n      = rows.length;
  const labels = rows.map(r => `Age ${r.age}`);

  const datasets = [
    {
      label: 'Portfolio',
      data: rows.map(r => r.portfolio),
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56,189,248,0.07)',
      fill: true,
      tension: 0.35,
      pointRadius: n <= 15 ? 3 : 0,
      borderWidth: 2,
    },
    {
      label: 'FIRE Target',
      data: rows.map(r => r.fireNumber),
      borderColor: '#ef4444',
      borderDash: [6, 4],
      fill: false,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 1.5,
    },
  ];

  if (els.sensitivityToggle.checked) {
    const hiRows = computeFireProjection({ ...inputs, investmentReturn: inputs.investmentReturn + 0.015, maxYears: n });
    const loRows = computeFireProjection({ ...inputs, investmentReturn: Math.max(0, inputs.investmentReturn - 0.015), maxYears: n });

    datasets.push({
      label: '+1.5% return',
      data: padTo(hiRows.map(r => r.portfolio), n),
      borderColor: 'rgba(56,189,248,0.38)',
      borderDash: [4, 4],
      fill: false,
      pointRadius: 0,
      tension: 0.35,
      borderWidth: 1.5,
    });
    datasets.push({
      label: '−1.5% return',
      data: padTo(loRows.map(r => r.portfolio), n),
      borderColor: 'rgba(239,68,68,0.38)',
      borderDash: [4, 4],
      fill: false,
      pointRadius: 0,
      tension: 0.35,
      borderWidth: 1.5,
    });
  }

  if (fireChart) fireChart.destroy();

  fireChart = new Chart($('fireChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 20 },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? formatCurrency(ctx.parsed.y) : '—'}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
          grid:  { color: 'rgba(51,65,85,0.5)' },
        },
        y: {
          afterFit: scale => { scale.width = 90; },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 6,
            font: { size: 11 },
            callback: v => {
              if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
              if (v >= 1000)    return '$' + (v / 1000).toFixed(0) + 'k';
              return '$' + v;
            },
          },
          grid: { color: 'rgba(51,65,85,0.5)' },
        },
      },
    },
  });
}

// ── Year table ────────────────────────────────────────────────────────────────

function renderYearTable(rows) {
  els.yearTableBody.innerHTML = rows.map(r => {
    const pctClass = r.pctToFire >= 100 ? 'td-pass' : r.pctToFire >= 75 ? 'td-warn' : '';
    return `
      <tr class="${r.fireReached ? 'fire-reached' : ''}">
        <td>${r.year}</td>
        <td>${r.age}</td>
        <td>${formatCurrency(r.portfolio)}</td>
        <td class="td-pass">${formatCurrency(r.growth)}</td>
        <td>${formatCurrency(r.contributions)}</td>
        <td>${formatCurrency(r.fireNumber)}</td>
        <td class="${pctClass}">${r.pctToFire.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');
}
