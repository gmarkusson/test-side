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
// --- KPI Calculator + optional POST + currency switcher ---
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

  const currencySelect = document.getElementById('currencySelect');

  // ---- Formatting & parsing ----
  const locale = 'is-IS';               // keep Icelandic number style; change if you prefer
  let currency = currencySelect?.value || 'ISK';

  const fmtNumber   = n => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const fmtCurrency = n => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

  // Accept both "14,5" and "14.5"
  const num = v => Number(String(v).replace(',', '.')) || 0;

  // Keep last results so we can re-render when currency changes
  let last = null;

  const render = () => {
    if (!last) return;
    const { netKg, revenue, totalCost, profit, marginPct, profitPerKg } = last;
    out.netKg.textContent       = fmtNumber(netKg) + ' kg';
    out.revenue.textContent     = fmtCurrency(revenue);
    out.totalCost.textContent   = fmtCurrency(totalCost);
    out.profit.textContent      = fmtCurrency(profit);
    out.marginPct.textContent   = fmtNumber(marginPct) + ' %';
    out.profitPerKg.textContent = fmtCurrency(profitPerKg) + ' / kg';
    out.panel.hidden = false;
  };

  currencySelect?.addEventListener('change', () => {
    currency = currencySelect.value;
    render();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    out.status.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    const volumeKg   = num(data.volumeKg);
    const sellPrice  = num(data.sellPrice);
    const rawCost    = num(data.rawCost);
    const procCost   = num(data.procCost);
    const freight    = num(data.freight);
    const wastePct   = num(data.wastePct);
    const webhookUrl = (data.webhookUrl || '').trim();

    // ---- Calculations ----
    const netKg = volumeKg * (1 - wastePct / 100);
    const revenue = netKg * sellPrice;
    const totalCostPerKg = rawCost + procCost + freight;
    const totalCost = netKg * totalCostPerKg;
    const profit = revenue - totalCost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitPerKg = netKg > 0 ? profit / netKg : 0;

    last = { netKg, revenue, totalCost, profit, marginPct, profitPerKg };
    render();

    // ---- Optional POST to webhook ----
    if (webhookUrl) {
      try {
        const payload = {
          timestamp: new Date().toISOString(),
          inputs: { volumeKg, sellPrice, rawCost, procCost, freight, wastePct },
          results: { netKg, revenue, totalCost, profit, marginPct, profitPerKg },
          locale, currency
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
