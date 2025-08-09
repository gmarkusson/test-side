// script.js v7 — Light-only + KPI calculator
'use strict';
console.log('Loaded script.js v7 (light-only)');

// Force light theme immediately
document.documentElement.classList.add('light');

// ---------- helpers ----------
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
  const s = String(v).trim();
  if (!s) return NaN;
  let t = s.replace(/\s/g, '');
  // EU-style decimal comma handling
  if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else {
    t = t.replace(/,/g, '');
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

// ---------- UI elements ----------
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
  yieldPct:  $('input[name="yieldPct"]'),
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

// ---------- core calculation ----------
function calculate() {
  const currency = currencySel.value;

  const volumeKg = parseNum(f.volumeKg.value);
  const sell     = parseNum(f.sellPrice.value);
  const raw      = parseNum(f.rawCost.value);
  const proc     = parseNum(f.procCost.value);
  const freight  = parseNum(f.freight.value || 0);
  let   yieldPct = parseNum(f.yieldPct.value || 100);   // default 100

  if (!Number.isFinite(yieldPct)) throw new Error('Yield (%) must be a number.');
  yieldPct = Math.min(100, Math.max(0, yieldPct));       // clamp 0..100

  const fields = { volumeKg, sell, raw, proc, freight };
  for (const [k, v] of Object.entries(fields)) {
    if (!Number.isFinite(v)) throw new Error(`Please enter a valid number for "${k}".`);
  }

  // Use Yield (%) directly
  const netKg = Math.max(0, volumeKg * (yieldPct / 100));
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
           inputs: { volumeKg, sell, raw, proc, freight, yieldPct } };
}

// ---------- webhook (optional) ----------
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

// ---------- events ----------
document.getElementById('calcBtn')?.addEventListener('click', async () => {
  try {
    const result = calculate();
    await postWebhook(result);
  } catch (err) {
    alert(err.message || String(err));
  }
});

// Support Enter key in any field
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const result = calculate();
    await postWebhook(result);
  } catch (err) {
    alert(err.message || String(err));
  }
});

// Recalculate formatting if currency changes after results shown
currencySel?.addEventListener('change', () => {
  if (!resWrap.hidden) {
    try { calculate(); } catch {}
  }
});

// ---------- nav (hamburger) ----------
const navToggle = $('#navToggle');
const siteNav = $('#siteNav');
navToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});
