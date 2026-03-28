/* ============================================================
   BisectionLab — Core Application Logic (Single Chart)
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
let mainChart     = null;
let iterationData = [];
let lastResult    = null;
let activeTab     = 'func';

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  animateStatPlaceholders();
});

// ── Background Particles ──────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById('bgParticles');
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    const size = Math.random() * 120 + 40;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;
      animation-duration:${Math.random()*20+15}s;
      animation-delay:${Math.random()*-20}s;
      opacity:${Math.random()*0.3};
    `;
    container.appendChild(p);
  }
}

function animateStatPlaceholders() {
  ['statIter','statError','statRoot'].forEach(id => {
    document.getElementById(id).style.opacity = '0.4';
  });
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  activeTab = name;
  ['func','conv','error'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === name);
  });
  if (lastResult) renderActiveChart();
}

// ── Load example ──────────────────────────────────────────────
function loadExample(fn, a, b) {
  document.getElementById('funcInput').value = fn;
  document.getElementById('aInput').value    = a;
  document.getElementById('bInput').value    = b;
  document.getElementById('funcInput').focus();
}

// ── Reset ─────────────────────────────────────────────────────
function resetAll() {
  iterationData = [];
  lastResult    = null;
  destroyChart();
  document.getElementById('chartPlaceholder').style.display = '';
  document.getElementById('summaryCards').style.display     = 'none';
  document.getElementById('panelTable').style.display       = 'none';
  document.getElementById('statusBox').style.display        = 'none';
  document.getElementById('iterBody').innerHTML             = '';
  ['statIter','statError','statRoot'].forEach(id => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).style.opacity = '0.4';
  });
}

function destroyChart() {
  if (mainChart) { mainChart.destroy(); mainChart = null; }
}

// ── Main bisection runner ─────────────────────────────────────
function runBisection() {
  const funcStr  = document.getElementById('funcInput').value.trim();
  let   a        = parseFloat(document.getElementById('aInput').value);
  let   b        = parseFloat(document.getElementById('bInput').value);
  const tol      = parseFloat(document.getElementById('tolInput').value);
  const maxIter  = parseInt(document.getElementById('maxIterInput').value, 10);
  const stopCrit = document.querySelector('input[name="stopCrit"]:checked').value;

  if (!funcStr)              return showStatus('error','⚠','Por favor ingresa una función f(x).');
  if (isNaN(a)||isNaN(b))   return showStatus('error','⚠','Los límites a y b deben ser números.');
  if (a >= b)                return showStatus('error','⚠','El límite inferior a debe ser menor que b.');
  if (isNaN(tol)||tol <= 0) return showStatus('error','⚠','La tolerancia debe ser un número positivo.');

  let compiled;
  try { compiled = math.compile(funcStr); }
  catch(e) { return showStatus('error','✕',`Error de sintaxis: ${e.message}`); }

  const f = x => compiled.evaluate({ x });

  let fa, fb;
  try { fa = f(a); fb = f(b); }
  catch(e) { return showStatus('error','✕','Error al evaluar la función en los límites.'); }

  if (!isFinite(fa)||!isFinite(fb))
    return showStatus('error','✕','La función produce valores no finitos en los límites.');

  if (fa * fb >= 0)
    return showStatus('warning','⚠',
      `f(a)·f(b) = ${(fa*fb).toExponential(3)} ≥ 0. No se cumple Bolzano. Verifica el intervalo.`);

  const btn = document.getElementById('btnCalculate');
  btn.disabled = true;
  btn.classList.add('calculating');

  setTimeout(() => {
    const origA = a, origB = b;
    const iterations = [];
    let cPrev = a, converged = false;

    for (let n = 1; n <= maxIter; n++) {
      const c  = (a + b) / 2;
      let   fc;
      try { fc = f(c); } catch(e) { break; }

      let error;
      if (n === 1) {
        error = Math.abs(b - a) / 2;
      } else {
        switch(stopCrit) {
          case 'abs':  error = Math.abs(b - a) / 2; break;
          case 'rel':  error = Math.abs(c) > 1e-15 ? Math.abs((c-cPrev)/c) : Math.abs(c-cPrev); break;
          case 'func': error = Math.abs(fc); break;
        }
      }

      iterations.push({ n, a, b, c, fa, fc, fb, error });
      cPrev = c;

      if (fa * fc < 0) { b = c; fb = fc; }
      else             { a = c; fa = fc; }

      if (error <= tol) { converged = true; break; }
    }

    iterationData = iterations;
    const final   = iterations[iterations.length - 1];

    lastResult = { f, origA, origB, funcStr, iterations, converged,
                   root: final.c, froot: final.fc, finalError: final.error };

    renderTable(iterations, converged);
    renderActiveChart();
    updateHeroStats(iterations.length, final.error, final.c);
    updateSummaryCards(final.c, final.error, iterations.length, final.fc);
    showStatus(
      converged ? 'success' : 'warning',
      converged ? '✓' : '⚡',
      converged
        ? `Convergió en ${iterations.length} iteraciones. Raíz ≈ ${fmt(final.c,10)}, Error ≈ ${fmtSci(final.error)}`
        : `Se alcanzó el máximo de ${maxIter} iteraciones. Raíz aprox. ≈ ${fmt(final.c,10)}`
    );

    btn.disabled = false;
    btn.classList.remove('calculating');
  }, 40);
}

// ── Render active chart ───────────────────────────────────────
function renderActiveChart() {
  switch(activeTab) {
    case 'func':  buildFuncChart();  break;
    case 'conv':  buildConvChart();  break;
    case 'error': buildErrorChart(); break;
  }
}

// ── Chart 1: f(x) curve ───────────────────────────────────────
function buildFuncChart() {
  destroyChart();
  document.getElementById('chartPlaceholder').style.display = 'none';

  const { f, origA, origB, iterations } = lastResult;
  const root   = iterations[iterations.length-1].c;
  const froot  = iterations[iterations.length-1].fc;
  const margin = Math.abs(origB - origA) * 0.3;
  const xMin   = origA - margin, xMax = origB + margin;
  const N      = 300;
  const xs     = Array.from({length:N}, (_,i) => xMin + i/(N-1)*(xMax-xMin));
  const ys     = xs.map(x => { try { const v=f(x); return isFinite(v)&&Math.abs(v)<1e10?v:null; }catch{return null;} });

  const ctx = document.getElementById('mainChart').getContext('2d');
  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: xs.map(v => v.toFixed(4)),
      datasets: [
        {
          label: 'f(x)',
          data: ys,
          borderColor: '#818cf8',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.15,
          fill: false,
        },
        {
          label: 'y = 0',
          data: xs.map(() => 0),
          borderColor: 'rgba(255,255,255,0.18)',
          borderWidth: 1,
          borderDash: [6,4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: `Raíz ≈ ${fmt(root,6)}`,
          type: 'scatter',
          data: [{ x: xs[closestIdx(xs, root)].toFixed(4), y: froot }],
          pointRadius: 9,
          pointHoverRadius: 11,
          backgroundColor: '#a855f7',
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 4,
        }
      ]
    },
    options: makeOptions(`Gráfica de f(x) = ${lastResult.funcStr}`)
  });
}

// ── Chart 2: convergence ──────────────────────────────────────
function buildConvChart() {
  destroyChart();
  document.getElementById('chartPlaceholder').style.display = 'none';

  const { iterations } = lastResult;
  const root = iterations[iterations.length-1].c;

  const ctx = document.getElementById('mainChart').getContext('2d');
  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: iterations.map(r => `n=${r.n}`),
      datasets: [
        {
          label: 'c_n (punto medio)',
          data: iterations.map(r => r.c),
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168,85,247,0.08)',
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#a855f7',
          pointBorderColor: 'rgba(168,85,247,0.25)',
          pointBorderWidth: 3,
          tension: 0.2,
          fill: false,
        },
        {
          label: `Raíz ≈ ${fmt(root,8)}`,
          data: iterations.map(() => root),
          borderColor: 'rgba(16,185,129,0.5)',
          borderWidth: 1.5,
          borderDash: [6,4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: makeOptions('Convergencia de c_n → raíz en cada iteración')
  });
}

// ── Chart 3: error ────────────────────────────────────────────
function buildErrorChart() {
  destroyChart();
  document.getElementById('chartPlaceholder').style.display = 'none';

  const { iterations } = lastResult;
  const errVals = iterations.map(r => +Math.log10(r.error + 1e-300).toFixed(4));

  const ctx = document.getElementById('mainChart').getContext('2d');
  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: iterations.map(r => `n=${r.n}`),
      datasets: [
        {
          label: 'log₁₀(Error)',
          data: errVals,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: 'rgba(245,158,11,0.25)',
          pointBorderWidth: 3,
          tension: 0.3,
          fill: true,
        }
      ]
    },
    options: makeOptions('Reducción del error — log₁₀(Error) por iteración')
  });
}

// ── Shared chart options factory ──────────────────────────────
function makeOptions(titleText) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      title: {
        display: true,
        text: titleText,
        color: '#e2e8f0',
        font: { family: 'Inter', size: 13, weight: '600' },
        padding: { bottom: 14 }
      },
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11 },
          padding: 20,
          boxWidth: 14,
          boxHeight: 3,
          usePointStyle: false,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(13,13,28,0.96)',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Inter', size: 12 },
        bodyFont:  { family: 'JetBrains Mono', size: 11 },
      }
    },
    scales: {
      x: {
        ticks: { color: '#475569', font: { family: 'Inter', size: 10 }, maxTicksLimit: 10, maxRotation: 0 },
        grid:  { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 7 },
        grid:  { color: 'rgba(255,255,255,0.04)' },
      }
    }
  };
}

// ── Helper: find closest index ────────────────────────────────
function closestIdx(arr, val) {
  let best = 0, bestDist = Infinity;
  arr.forEach((v,i) => { const d = Math.abs(v-val); if(d<bestDist){bestDist=d;best=i;} });
  return best;
}

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

// ── Hero stats ────────────────────────────────────────────────
function updateHeroStats(iters, error, root) {
  animateCount('statIter', iters);
  setTimeout(() => setStatText('statError', fmtSci(error)), 100);
  setTimeout(() => setStatText('statRoot', fmt(root, 8)), 200);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  el.style.opacity = '1';
  let start = null;
  const step = ts => {
    if (!start) start = ts;
    const p = Math.min((ts-start)/500, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1-p, 3)));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

function setStatText(id, text) {
  const el = document.getElementById(id);
  el.style.opacity = '1';
  el.textContent   = text;
}

// ── Summary cards ─────────────────────────────────────────────
function updateSummaryCards(root, error, iters, froot) {
  document.getElementById('cardRoot').textContent  = fmt(root, 10);
  document.getElementById('cardError').textContent = fmtSci(error);
  document.getElementById('cardIter').textContent  = iters;
  document.getElementById('cardFval').textContent  = fmtSci(froot);
  document.getElementById('summaryCards').style.display = '';
}

// ── Status ────────────────────────────────────────────────────
function showStatus(type, icon, msg) {
  const box = document.getElementById('statusBox');
  box.className = `status-box ${type}`;
  box.style.display = 'flex';
  document.getElementById('statusIcon').textContent = icon;
  const txt = document.getElementById('statusMsg');
  txt.textContent = msg;
  txt.className   = `status-msg ${type}`;
}

// ── CSV export ────────────────────────────────────────────────
function exportCSV() {
  if (!iterationData.length) return;
  const rows = iterationData.map(r =>
    `${r.n},${r.a},${r.b},${r.c},${r.fa},${r.fc},${r.fb},${r.error}`
  );
  const csv  = ['n,a,b,c,f(a),f(c),f(b),Error', ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:'biseccion.csv' }).click();
  URL.revokeObjectURL(url);
}

// ── Formatters ────────────────────────────────────────────────
function fmt(v, decimals = 8) {
  if (v==null || !isFinite(v)) return '—';
  return Number(v).toFixed(decimals);
}

function fmtSci(v) {
  if (v==null || !isFinite(v)) return '—';
  const n = Number(v);
  if (n === 0) return '0';
  if (Math.abs(n)<1e-4 || Math.abs(n)>=1e6) return n.toExponential(4);
  return n.toFixed(8);
}

// ── Keyboard shortcut ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='Enter') runBisection();
});
