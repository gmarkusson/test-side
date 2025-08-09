// Theme + nav + simple form demo
(function(){
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Persist theme
  const saved = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  if (saved === 'light') root.classList.add('light');

  toggle?.addEventListener('click', () => {
    root.classList.toggle('light');
    localStorage.setItem('theme', root.classList.contains('light') ? 'light' : 'dark');
  });

  navToggle?.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  // Demo contact form handler
  const form = document.getElementById('contactForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    alert('Thanks, ' + data.name + '! This demo just logs your message to the console. Connect a backend to actually send email.');
    console.log('Contact form submission:', data);
    form.reset();
  });
})();
// --- KPI Calculator + optional POST ---
(function () {
  const form = document.getElementById('kpiForm');
  if (!form) return;

  const out = {
    netKg: document.getElementById('r_netKg'),
    revenue: document.getElementById('r_revenue'),
    totalCost: document.getElementById('r_totalCost'),
    profit: document.getElementById('r_profit'),
    marginPct: document.getElementById('r_marginPct'),
    profitPerKg: document.getElementById('r_profitPerKg'),
    panel: document.getElementById('kpiResults'),
    status: document.getElementById('postStatus')
  };

  const fmt = (n, opts = {}) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...opts }).format(n);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    out.status.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    const volumeKg   = Number(data.volumeKg || 0);
    const sellPrice  = Number(data.sellPrice || 0);   // per kg
    const rawCost    = Number(data.rawCost || 0);     // per kg
    const procCost   = Number(data.procCost || 0);    // per kg
    const freight    = Number(data.freight || 0);     // per kg
    const wastePct   = Number(data.wastePct || 0);    // percent
    const webhookUrl = (data.webhookUrl || '').trim();

    // Calculations
    const netKg = volumeKg * (1 - wastePct / 100);
    const revenue = netKg * sellPrice;
    const totalCostPerKg = rawCost + procCost + freight;
    const totalCost = netKg * totalCostPerKg;
    const profit = revenue - totalCost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitPerKg = netKg > 0 ? profit / netKg : 0;

    // Show results
    out.netKg.textContent = fmt(netKg) + ' kg';
    out.revenue.textContent = fmt(revenue);
    out.totalCost.textContent = fmt(totalCost);
    out.profit.textContent = fmt(profit);
    out.marginPct.textContent = fmt(marginPct) + ' %';
    out.profitPerKg.textContent = fmt(profitPerKg);
    out.panel.hidden = false;

    // Optional POST to webhook
    if (webhookUrl) {
      try {
        const payload = {
          timestamp: new Date().toISOString(),
          inputs: { volumeKg, sellPrice, rawCost, procCost, freight, wastePct },
          results: { netKg, revenue, totalCost, profit, marginPct, profitPerKg }
        };
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        out.status.textContent = 'Posted results successfully.';
      } catch (err) {
        out.status.textContent = 'Could not post results: ' + err.message;
      }
    }
  });
})();
