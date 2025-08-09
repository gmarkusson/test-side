// --- helpers ---------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);

const CURRENCY_MAP = {
  ISK: { locale: 'is-IS', code: 'ISK', minFraction: 0, maxFraction: 0 },
  EUR: { locale: 'de-DE', code: 'EUR', minFraction: 2, maxFraction: 2 },
  GBP: { locale: 'en-GB', code: 'GBP', minFraction: 2, maxFraction: 2 },
  USD: { locale: 'en-US', code: 'USD', minFraction: 2, maxFraction: 2 },
  SEK: { locale: 'sv-SE', code: 'SEK', minFraction: 0, maxFraction: 0 },
  NOK: { locale: 'nb-NO', code: 'NOK', minFraction: 0, maxFraction: 0 },
  DKK: { locale: 'da-DK', code: 'DKK', minFraction: 0, maxFraction: 0 }
};

function parseNum(v) {
  if (v == null) return NaN;
  // accept "1.234,56" or "1,234.56" or "1234,56" or "1234.56"
  const s = String(v).trim();
  if (!s) return NaN;
  // remove spaces
  let t = s.replace(/\s/g, '');
  // if comma is decimal (common in EU), replace last comma with dot and strip others
  if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else {
    t = t.replace(/,/g, ''); // US-style thousands
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function fmtCurrency(val, currency) {
  const cfg = CURRENCY_MAP[currency] || CURRENCY_MAP.EUR;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    minimumFractionDigits: cfg.minFraction,
    maximumFractionDigits: cfg.maxFraction
  }).format(val);
}

function fmtNumber(val, digits = 2) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(val);
}

// --- UI elements -----------------------------------------------------------
const currencySel = $('#currencySelect');
const form = $('#kpiForm');
const resWrap = $('#kpiResults');
const postStatus = $('#postStatus');

const f = {
  volumeKg: $('input[name="volumeKg"]'),
  sellPrice: $('input[name="sellPrice"]'),
  rawCost:   $('input[name="rawCost"]'),
  procCost:  $('input[name="procCost"]'),
  freight:   $('input[name="freight"]'),
  wastePct:  $('input[name="wastePct"]'),
  webhook:   $('input[name="webhookUrl"]')
};

const out = {
  netKg:        $('#r_netKg'),
  revenue:      $('#r_revenue'),
  totalCost:    $('#r_totalCost'),
  profit:       $('#r_profit'),
  marginPct:    $('#r_marginPct'),
  profitPerKg:  $('#r_profitPerKg')
};

// --- core calculation ------------------------------------------------------
function calculate() {
  const currency = currencySel.value;

  const volumeKg = parseNum(f.volumeKg.value);
  const sell     = parseNum(f.sellPrice.value);
  const raw      = parseNum(f.rawCost.value);
  const proc     = parseNum(f.procCost.value);
  const freight  = parseNum(f.freight.value || 0);
  const waste    = parseNum(f.wastePct.value || 0);

  const fields = { volumeKg, sell, raw, proc, freight, waste };
  for (const [k, v] of Object.entries(fields)) {
    if (!Number.isFinite(v)) {
      throw new Error(`Please enter a valid number for "${k}".`);
    }
  }

  const netKg = Math.max(0, volumeKg * (1 - waste / 100));
  const revenue = netKg * sell;
  const totalCost = netKg * (raw + proc + freight);
  const profit = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const profitPerKg = netKg > 0 ? profit / netKg : 0;

  // write outputs
  out.netKg.textContent       = fmtNumber(netKg, 2) + ' kg';
  out.revenue.textContent     = fmtCurrency(revenue, currency);
  out.totalCost.textContent   = fmtCurrency(totalCost, currency);
  out.profit.textContent      = fmtCurrency(profit, currency);
  out.marginPct.textContent   = fmtNumber(marginPct, 1) + ' %';
  out.profitPerKg.textContent = fmtCurrency(profitPerKg, currency) + ' /kg';

  // reveal block
  resWrap.hidden = false;

  return { currency, netKg, revenue, totalCost, profit, marginPct, profitPerKg,
           inputs: { volumeKg, sell, raw, proc, freight, waste } };
}

// --- webhook (optional) ----------------------------------------------------
async function postWebhook(payload) {
  const url = (f.webhook.value || '').trim();
  postStatus.textContent = '';
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    postStatus.textContent = res.ok ? 'Posted results to webhook ✔' : `Webhook error: ${res.status}`;
  } catch (err) {
    postStatus.textContent = 'Webhook failed: ' + err.message;
  }
}

// --- events ----------------------------------------------------------------
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const result = calculate();
    await postWebhook(result);
  } catch (err) {
    alert(err.message || String(err));
  }
});

form?.addEventListener('reset', () => {
  setTimeout(() => {
    resWrap.hidden = true;
    postStatus.textContent = '';
    // optional: clear outputs
    Object.values(out).forEach(el => el.textContent = '–');
  }, 0);
});

// If user changes currency after calculation, reformat using existing values:
currencySel?.addEventListener('change', () => {
  if (!resWrap.hidden) {
    try { calculate(); } catch { /* ignore until form valid */ }
  }
});

// --- nav + theme (optional if you already had these) -----------------------
const navToggle = $('#navToggle');
const siteNav = $('#siteNav');
navToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

const themeToggle = $('#themeToggle');
themeToggle?.addEventListener('click', () => {
  const light = document.documentElement.classList.toggle('light');
  try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch {}
});
(function initTheme(){
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') document.documentElement.classList.add('light');
  } catch {}
})();
