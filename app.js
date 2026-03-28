/* ============================================================
   BisectionLab — Core Application Logic
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
let chartFunc  = null;
let chartConv  = null;
let chartError = null;
let iterationData = [];
let lastResult    = null;

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  animateStatPlaceholders();
});

// ── Background Particles ──────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById('bgParticles');
  const count = 18;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    const size = Math.random() * 120 + 40;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 20 + 15}s;
      animation-delay: ${Math.random() * -20}s;
      opacity: ${Math.random() * 0.3};
    `;
    container.appendChild(p);
  }
}

// ── Stat placeholder pulse ────────────────────────────────────
function animateStatPlaceholders() {
  ['statIter', 'statError', 'statRoot'].forEach(id => {
    const el = document.getElementById(id);
    el.style.opacity = '0.4';
  });
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  ['func', 'conv', 'error'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === name);
    const canvas = document.getElementById(`chart${capitalize(t)}`);
    canvas.classList.toggle('active', t === name);
  });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Load example ──────────────────────────────────────────────
function loadExample(fn, a, b) {
  document.getElementById('funcInput').value = fn;
  document.getElementById('aInput').value = a;
  document.getElementById('bInput').value = b;
  document.getElementById('funcInput').focus();
}

// ── Reset ─────────────────────────────────────────────────────
function resetAll() {
  iterationData = [];
  lastResult    = null;
  ['chartFunc', 'chartConv', 'chartError'].forEach(id => {
    const canvas = document.getElementById(id);
    canvas.classList.remove('active');
  });
  document.getElementById('chartPlaceholder').style.display = '';
  document.getElementById('summaryCards').style.display = 'none';
  document.getElementById('panelTable').style.display = 'none';
  document.getElementById('statusBox').style.display = 'none';
  document.getElementById('iterBody').innerHTML = '';
  ['statIter','statError','statRoot'].forEach(id => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).style.opacity = '0.4';
  });
  destroyCharts();
}

function destroyCharts() {
  [chartFunc, chartConv, chartError].forEach(c => { if (c) c.destroy(); });
  chartFunc = chartConv = chartError = null;
}

// ── Main bisection runner ─────────────────────────────────────
function runBisection() {
  // Inputs
  const funcStr = document.getElementById('funcInput').value.trim();
  let a    = parseFloat(document.getElementById('aInput').value);
  let b    = parseFloat(document.getElementById('bInput').value);
  const tol    = parseFloat(document.getElementById('tolInput').value);
  const maxIter = parseInt(document.getElementById('maxIterInput').value, 10);
  const stopCrit = document.querySelector('input[name="stopCrit"]:checked').value;

  // Validation
  if (!funcStr) return showStatus('error', '⚠', 'Por favor ingresa una función f(x).');
  if (isNaN(a) || isNaN(b)) return showStatus('error', '⚠', 'Los límites a y b deben ser números.');
  if (a >= b) return showStatus('error', '⚠', 'El límite inferior a debe ser menor que b.');
  if (isNaN(tol) || tol <= 0) return showStatus('error', '⚠', 'La tolerancia debe ser un número positivo.');

  // Compile expression safely
  let compiled;
  try {
    compiled = math.compile(funcStr);
  } catch (e) {
    return showStatus('error', '✕', `Error de sintaxis: ${e.message}`);
  }

  const f = (x) => compiled.evaluate({ x });

  // Evaluate at borders
  let fa, fb;
  try { fa = f(a); fb = f(b); } catch (e) {
    return showStatus('error', '✕', 'Error al evaluar la función en los límites.');
  }

  if (!isFinite(fa) || !isFinite(fb)) {
    return showStatus('error', '✕', 'La función produce valores no finitos en los límites del intervalo.');
  }

  if (fa * fb >= 0) {
    return showStatus('warning', '⚠',
      `f(a)·f(b) = ${(fa*fb).toExponential(3)} ≥ 0. No se cumple el Teorema de Bolzano. Verifica el intervalo.`);
  }

  // ── Bisection algorithm ──
  const btn = document.getElementById('btnCalculate');
  btn.disabled = true;
  btn.classList.add('calculating');

  setTimeout(() => {
    let iterations = [];
    let error = Infinity;
    let cPrev = a;
    let converged = false;
    let origA = a, origB = b;

    for (let n = 1; n <= maxIter; n++) {
      const c = (a + b) / 2;
      let fc, fcPrev = (n === 1) ? fa : iterFC(iterations, n - 1);

      try { fc = f(c); } catch (e) { break; }

      // Compute error according to criterion
      if (n === 1) {
        error = Math.abs(b - a) / 2;
      } else {
        switch (stopCrit) {
          case 'abs': error = Math.abs(b - a) / 2;                           break;
          case 'rel': error = (Math.abs(c) > 1e-15) ? Math.abs((c - cPrev) / c) : Math.abs(c - cPrev); break;
          case 'func': error = Math.abs(fc);                                 break;
        }
      }

      iterations.push({
        n, a: a, b: b, c: c,
        fa: (n === 1) ? fa : iterFA(iterations, n - 1, a),
        fc: fc,
        fb: fb,
        error: error,
        newA: (fa * fc < 0) ? a : c,
        newB: (fa * fc < 0) ? c : b,
      });

      cPrev = c;

      if (fa * fc < 0) { b = c; fb = fc; }
      else             { a = c; fa = fc; }

      if (error <= tol) { converged = true; break; }
    }

    iterationData = iterations;

    const finalRow = iterations[iterations.length - 1];
    const root  = finalRow.c;
    const froot = finalRow.fc;

    lastResult = { root, froot, iterations: iterations.length, finalError: finalRow.error, converged, origA, origB, funcStr };

    renderTable(iterations, converged);
    renderCharts(f, origA, origB, iterations, converged);
    updateHeroStats(iterations.length, finalRow.error, root);
    updateSummaryCards(root, finalRow.error, iterations.length, froot);
    showStatus(
      converged ? 'success' : 'warning',
      converged ? '✓' : '⚡',
      converged
        ? `Convergió en ${iterations.length} iteraciones. Raíz ≈ ${fmt(root, 10)}, Error ≈ ${fmtSci(finalRow.error)}`
        : `Se alcanzó el máximo de iteraciones (${maxIter}). Raíz aproximada ≈ ${fmt(root, 10)}`
    );

    btn.disabled = false;
    btn.classList.remove('calculating');
  }, 40);
}

// helpers for re-reading f(a), f(c) across iterations
function iterFA(iters, n, currentA) { return iters[n-1] ? iters[n-1].fa : currentA; }
function iterFC(iters, n)  { return iters[n-1] ? iters[n-1].fc : 0; }

// ── Render table ──────────────────────────────────────────────
function renderTable(iterations, converged) {
  const tbody = document.getElementById('iterBody');
  tbody.innerHTML = '';
  const last = iterations.length - 1;
  iterations.forEach((row, i) => {
    const tr = document.createElement('tr');
    if (i === last && converged) tr.classList.add('row-converged');
    tr.innerHTML = `
      <td>${row.n}</td>
      <td>${fmt(row.a)}</td>
      <td>${fmt(row.b)}</td>
      <td class="highlight-c">${fmt(row.c)}</td>
      <td>${fmtSci(row.fa)}</td>
      <td>${fmtSci(row.fc)}</td>
      <td>${fmtSci(row.fb)}</td>
      <td class="highlight-err">${fmtSci(row.error)}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('panelTable').style.display = '';
}

// ── Render charts ─────────────────────────────────────────────
function renderCharts(f, a, b, iterations, converged) {
  destroyCharts();
  document.getElementById('chartPlaceholder').style.display = 'none';
  document.getElementById('chartFunc').classList.add('active');

  // ── Chart 1: Function + root ──
  const margin = Math.abs(b - a) * 0.3;
  const xMin = a - margin, xMax = b + margin;
  const pts = 400;
  const xVals = Array.from({ length: pts }, (_, i) => xMin + (i / (pts - 1)) * (xMax - xMin));
  const yVals = xVals.map(x => { try { const y = f(x); return isFinite(y) && Math.abs(y) < 1e10 ? y : null; } catch { return null; } });

  const root = iterations[iterations.length - 1].c;

  const ctxF = document.getElementById('chartFunc').getContext('2d');
  chartFunc = new Chart(ctxF, {
    type: 'line',
    data: {
      labels: xVals.map(v => v.toFixed(4)),
      datasets: [
        {
          label: 'f(x)',
          data: yVals,
          borderColor: 'rgba(99,102,241,1)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: false,
          tension: 0.15,
        },
        {
          label: 'y = 0',
          data: xVals.map(() => 0),
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: `Raíz ≈ ${fmt(root, 6)}`,
          data: xVals.map(x => Math.abs(x - root) < (xMax - xMin) / pts * 1.5 ? f(root) : null),
          borderColor: 'rgba(168,85,247,0)',
          pointRadius: xVals.map(x => Math.abs(x - root) < (xMax - xMin) / pts * 1.5 ? 8 : 0),
          pointBackgroundColor: 'rgba(168,85,247,0.9)',
          pointBorderColor: 'rgba(168,85,247,0.3)',
          pointBorderWidth: 4,
          fill: false,
        }
      ]
    },
    options: chartBaseOptions('Gráfica de f(x) en el intervalo [' + fmt(a,3) + ', ' + fmt(b,3) + ']')
  });

  // ── Chart 2: Convergence (c_n) ──
  const cVals = iterations.map(r => r.c);
  const ctxC = document.getElementById('chartConv').getContext('2d');
  chartConv = new Chart(ctxC, {
    type: 'line',
    data: {
      labels: iterations.map(r => `n=${r.n}`),
      datasets: [
        {
          label: 'c_n (punto medio)',
          data: cVals,
          borderColor: 'rgba(168,85,247,0.9)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(168,85,247,0.8)',
          pointBorderColor: 'rgba(168,85,247,0.3)',
          pointBorderWidth: 3,
          fill: false,
          tension: 0.2,
        },
        {
          label: `Raíz aprox. ≈ ${fmt(root, 6)}`,
          data: iterations.map(() => root),
          borderColor: 'rgba(16,185,129,0.6)',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: chartBaseOptions('Convergencia: c_n → raíz en cada iteración')
  });

  // ── Chart 3: Error per iteration ──
  const errVals = iterations.map(r => Math.log10(r.error + 1e-300));
  const ctxE = document.getElementById('chartError').getContext('2d');
  chartError = new Chart(ctxE, {
    type: 'line',
    data: {
      labels: iterations.map(r => `n=${r.n}`),
      datasets: [
        {
          label: 'log₁₀(Error)',
          data: errVals,
          borderColor: 'rgba(245,158,11,0.9)',
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(245,158,11,0.8)',
          pointBorderColor: 'rgba(245,158,11,0.2)',
          pointBorderWidth: 3,
          fill: true,
          tension: 0.3,
        }
      ]
    },
    options: chartBaseOptions('Reducción del error por iteración — log₁₀(Error)')
  });
}

function chartBaseOptions(title, extras = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11 },
          padding: 16,
        }
      },
      title: {
        display: true,
        text: title,
        color: '#f1f5f9',
        font: { family: 'Inter', size: 13, weight: '600' },
        padding: { bottom: 12 }
      },
      tooltip: {
        backgroundColor: 'rgba(15,15,30,0.95)',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#475569',
          font: { family: 'Inter', size: 10 },
          maxTicksLimit: 10,
          maxRotation: 0,
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks: {
          color: '#475569',
          font: { family: 'JetBrains Mono', size: 10 },
          maxTicksLimit: 7,
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      }
    },
    ...extras
  };
}

// ── Update hero stats ─────────────────────────────────────────
function updateHeroStats(iters, error, root) {
  animateValue('statIter', iters, 0, false);
  setTimeout(() => setStatText('statError', fmtSci(error)), 150);
  setTimeout(() => setStatText('statRoot',  fmt(root, 8)),  300);
}

function animateValue(id, target, from, isFloat) {
  const el = document.getElementById(id);
  el.style.opacity = '1';
  let start = null;
  const duration = 600;
  const step = ts => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const val = from + (target - from) * easeOut(progress);
    el.textContent = isFloat ? val.toFixed(6) : Math.round(val);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = isFloat ? target.toFixed(6) : target;
  };
  requestAnimationFrame(step);
}

function setStatText(id, text) {
  const el = document.getElementById(id);
  el.style.opacity = '1';
  el.textContent = text;
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ── Summary cards ─────────────────────────────────────────────
function updateSummaryCards(root, error, iters, froot) {
  document.getElementById('cardRoot').textContent  = fmt(root, 10);
  document.getElementById('cardError').textContent = fmtSci(error);
  document.getElementById('cardIter').textContent  = iters;
  document.getElementById('cardFval').textContent  = fmtSci(froot);
  document.getElementById('summaryCards').style.display = '';
}

// ── Status box ────────────────────────────────────────────────
function showStatus(type, icon, msg) {
  const box  = document.getElementById('statusBox');
  const ico  = document.getElementById('statusIcon');
  const txt  = document.getElementById('statusMsg');
  box.className = `status-box ${type}`;
  box.style.display = 'flex';
  ico.textContent = icon;
  txt.textContent = msg;
  txt.className = `status-msg ${type}`;
}

// ── CSV export ────────────────────────────────────────────────
function exportCSV() {
  if (!iterationData.length) return;
  const header = 'n,a,b,c,f(a),f(c),f(b),Error';
  const rows = iterationData.map(r =>
    `${r.n},${r.a},${r.b},${r.c},${r.fa},${r.fc},${r.fb},${r.error}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'biseccion.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Formatting helpers ────────────────────────────────────────
function fmt(v, decimals = 8) {
  if (v === undefined || v === null) return '—';
  return Number(v).toFixed(decimals);
}

function fmtSci(v) {
  if (v === undefined || v === null || !isFinite(v)) return '—';
  const n = Number(v);
  if (Math.abs(n) === 0) return '0';
  if (Math.abs(n) < 1e-4 || Math.abs(n) >= 1e6) return n.toExponential(6);
  return n.toFixed(8);
}

// ── Keyboard shortcut ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runBisection();
});
