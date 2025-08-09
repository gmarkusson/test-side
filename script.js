 1 // script.js v5 — uses Yield (%) directly
 2 'use strict';
 3 console.log('Loaded script.js v5');
 4 
 5 // --- helpers ---------------------------------------------------------------
 6 const $ = (sel, root = document) => root.querySelector(sel);
 7 
 8 const CURRENCY_MAP = {
 9   ISK: { locale: 'is-IS', code: 'ISK', minFraction: 0, maxFraction: 0 },
10   EUR: { locale: 'de-DE', code: 'EUR', minFraction: 2, maxFraction: 2 },
11   GBP: { locale: 'en-GB', code: 'GBP', minFraction: 2, maxFraction: 2 },
12   USD: { locale: 'en-US', code: 'USD', minFraction: 2, maxFraction: 2 },
13   SEK: { locale: 'sv-SE', code: 'SEK', minFraction: 0, maxFraction: 0 },
14   NOK: { locale: 'nb-NO', code: 'NOK', minFraction: 0, maxFraction: 0 },
15   DKK: { locale: 'da-DK', code: 'DKK', minFraction: 0, maxFraction: 0 }
16 };
17 
18 function parseNum(v) {
19   if (v == null) return NaN;
20   const s = String(v).trim();
21   if (!s) return NaN;
22   let t = s.replace(/\s/g, '');
23   // EU-style decimal comma handling
24   if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) {
25     t = t.replace(/\./g, '').replace(',', '.');
26   } else {
27     t = t.replace(/,/g, '');
28   }
29   const n = Number(t);
30   return Number.isFinite(n) ? n : NaN;
31 }
32 
33 function fmtCurrency(val, currency) {
34   const cfg = CURRENCY_MAP[currency] || CURRENCY_MAP.EUR;
35   return new Intl.NumberFormat(cfg.locale, {
36     style: 'currency',
37     currency: cfg.code,
38     minimumFractionDigits: cfg.minFraction,
39     maximumFractionDigits: cfg.maxFraction
40   }).format(val);
41 }
42 
43 function fmtNumber(val, digits = 2) {
44   return new Intl.NumberFormat(undefined, {
45     minimumFractionDigits: digits,
46     maximumFractionDigits: digits
47   }).format(val);
48 }
49 
50 // --- UI elements -----------------------------------------------------------
51 const currencySel = $('#currencySelect');
52 const form = $('#kpiForm');
53 const resWrap = $('#kpiResults');
54 const postStatus = $('#postStatus');
55 
56 const f = {
57   volumeKg: $('input[name="volumeKg"]'),
58   sellPrice: $('input[name="sellPrice"]'),
59   rawCost:   $('input[name="rawCost"]'),
60   procCost:  $('input[name="procCost"]'),
61   freight:   $('input[name="freight"]'),
62   yieldPct:  $('input[name="yieldPct"]'),
63   webhook:   $('input[name="webhookUrl"]')
64 };
65 
66 const out = {
67   netKg:        $('#r_netKg'),
68   revenue:      $('#r_revenue'),
69   totalCost:    $('#r_totalCost'),
70   profit:       $('#r_profit'),
71   marginPct:    $('#r_marginPct'),
72   profitPerKg:  $('#r_profitPerKg')
73 };
74 
75 // --- core calculation ------------------------------------------------------
76 function calculate() {
77   const currency = currencySel.value;
78 
79   const volumeKg = parseNum(f.volumeKg.value);
80   const sell     = parseNum(f.sellPrice.value);
81   const raw      = parseNum(f.rawCost.value);
82   const proc     = parseNum(f.procCost.value);
83   const freight  = parseNum(f.freight.value || 0);
84   let   yieldPct = parseNum(f.yieldPct.value || 100); // default 100
85 
86   if (!Number.isFinite(yieldPct)) throw new Error('Yield (%) must be a number.');
87   yieldPct = Math.min(100, Math.max(0, yieldPct));     // clamp 0..100
88 
89   const fields = { volumeKg, sell, raw, proc, freight };
90   for (const [k, v] of Object.entries(fields)) {
91     if (!Number.isFinite(v)) throw new Error(`Please enter a valid number for "${k}".`);
92   }
93 
94   // ✅ Yield (%) is used directly
95   const netKg = Math.max(0, volumeKg * (yieldPct / 100));
96   const revenue = netKg * sell;
97   const totalCost = netKg * (raw + proc + freight);
98   const profit = revenue - totalCost;
99   const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
100   const profitPerKg = netKg > 0 ? profit / netKg : 0;
101 
102   out.netKg.textContent       = fmtNumber(netKg, 2) + ' kg';
103   out.revenue.textContent     = fmtCurrency(revenue, currency);
104   out.totalCost.textContent   = fmtCurrency(totalCost, currency);
105   out.profit.textContent      = fmtCurrency(profit, currency);
106   out.marginPct.textContent   = fmtNumber(marginPct, 1) + ' %';
107   out.profitPerKg.textContent = fmtCurrency(profitPerKg, currency) + ' /kg';
108 
109   resWrap.hidden = false;
110 
111   return { currency, netKg, revenue, totalCost, profit, marginPct, profitPerKg,
112            inputs: { volumeKg, sell, raw, proc, freight, yieldPct } };
113 }
114 
115 // --- webhook (optional) ----------------------------------------------------
116 async function postWebhook(payload) {
117   const url = (f.webhook.value || '').trim();
118   postStatus.textContent = '';
119   if (!url) return;
120 
121   try {
122     const res = await fetch(url, {
123       method: 'POST',
124       headers: { 'content-type': 'application/json' },
125       body: JSON.stringify(payload)
126     });
127     postStatus.textContent = res.ok ? 'Posted results to webhook ✔' : `Webhook error: ${res.status}`;
128   } catch (err) {
129     postStatus.textContent = 'Webhook failed: ' + err.message;
130   }
131 }
132 
133 // --- events ----------------------------------------------------------------
134 form?.addEventListener('submit', async (e) => {
135   e.preventDefault();
136   try {
137     const result = calculate();
138     await postWebhook(result);
139   } catch (err) {
140     alert(err.message || String(err));
141   }
142 });
143 
144 form?.addEventListener('reset', () => {
145   setTimeout(() => {
146     resWrap.hidden = true;
147     postStatus.textContent = '';
148     Object.values(out).forEach(el => el.textContent = '–');
149   }, 0);
150 });
151 
152 // Recalculate formatting when currency changes
153 currencySel?.addEventListener('change', () => {
154   if (!resWrap.hidden) {
155     try { calculate(); } catch {}
156   }
157 });
158 
159 // --- nav + theme -----------------------------------------------------------
160 const navToggle = $('#navToggle');
161 const siteNav = $('#siteNav');
162 navToggle?.addEventListener('click', () => {
163   const open = siteNav.classList.toggle('open');
164   navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
165 });
166 
167 const themeToggle = $('#themeToggle');
168 themeToggle?.addEventListener('click', () => {
169   const light = document.documentElement.classList.toggle('light');
170   try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch {}
171 });
(function initTheme(){
  try {
    const saved = localStorage.getItem('theme');
    if (!saved || saved === 'light') {
      document.documentElement.classList.add('light'); // default to light
    }
  } catch {
    document.documentElement.classList.add('light');
  }
})();
