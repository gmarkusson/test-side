 1 // script.js v6 — Light mode only + KPI calculator
 2 'use strict';
 3 console.log('Loaded script.js v6 (light-only)');
 4 
 5 // Force light theme immediately
 6 document.documentElement.classList.add('light');
 7 
 8 // --- helpers ---------------------------------------------------------------
 9 const $ = (sel, root = document) => root.querySelector(sel);
10 
11 const CURRENCY_MAP = {
12   ISK: { locale: 'is-IS', code: 'ISK', minFraction: 0, maxFraction: 0 },
13   EUR: { locale: 'de-DE', code: 'EUR', minFraction: 2, maxFraction: 2 },
14   GBP: { locale: 'en-GB', code: 'GBP', minFraction: 2, maxFraction: 2 },
15   USD: { locale: 'en-US', code: 'USD', minFraction: 2, maxFraction: 2 },
16   SEK: { locale: 'sv-SE', code: 'SEK', minFraction: 0, maxFraction: 0 },
17   NOK: { locale: 'nb-NO', code: 'NOK', minFraction: 0, maxFraction: 0 },
18   DKK: { locale: 'da-DK', code: 'DKK', minFraction: 0, maxFraction: 0 }
19 };
20 
21 function parseNum(v) {
22   if (v == null) return NaN;
23   const s = String(v).trim();
24   if (!s) return NaN;
25   let t = s.replace(/\s/g, '');
26   if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) {
27     t = t.replace(/\./g, '').replace(',', '.');
28   } else {
29     t = t.replace(/,/g, '');
30   }
31   const n = Number(t);
32   return Number.isFinite(n) ? n : NaN;
33 }
34 
35 function fmtCurrency(val, currency) {
36   const cfg = CURRENCY_MAP[currency] || CURRENCY_MAP.EUR;
37   return new Intl.NumberFormat(cfg.locale, {
38     style: 'currency',
39     currency: cfg.code,
40     minimumFractionDigits: cfg.minFraction,
41     maximumFractionDigits: cfg.maxFraction
42   }).format(val);
43 }
44 
45 function fmtNumber(val, digits = 2) {
46   return new Intl.NumberFormat(undefined, {
47     minimumFractionDigits: digits,
48     maximumFractionDigits: digits
49   }).format(val);
50 }
51 
52 // --- UI elements -----------------------------------------------------------
53 const currencySel = $('#currencySelect');
54 const form = $('#kpiForm');
55 const resWrap = $('#kpiResults');
56 const postStatus = $('#postStatus');
57 
58 const f = {
59   volumeKg: $('input[name="volumeKg"]'),
60   sellPrice: $('input[name="sellPrice"]'),
61   rawCost:   $('input[name="rawCost"]'),
62   procCost:  $('input[name="procCost"]'),
63   freight:   $('input[name="freight"]'),
64   yieldPct:  $('input[name="yieldPct"]'),
65   webhook:   $('input[name="webhookUrl"]')
66 };
67 
68 const out = {
69   netKg:        $('#r_netKg'),
70   revenue:      $('#r_revenue'),
71   totalCost:    $('#r_totalCost'),
72   profit:       $('#r_profit'),
73   marginPct:    $('#r_marginPct'),
74   profitPerKg:  $('#r_profitPerKg')
75 };
76 
77 // --- core calculation ------------------------------------------------------
78 function calculate() {
79   const currency = currencySel.value;
80 
81   const volumeKg = parseNum(f.volumeKg.value);
82   const sell     = parseNum(f.sellPrice.value);
83   const raw      = parseNum(f.rawCost.value);
84   const proc     = parseNum(f.procCost.value);
85   const freight  = parseNum(f.freight.value || 0);
86   let   yieldPct = parseNum(f.yieldPct.value || 100);   // default 100
87 
88   if (!Number.isFinite(yieldPct)) throw new Error('Yield (%) must be a number.');
89   yieldPct = Math.min(100, Math.max(0, yieldPct));       // clamp 0..100
90 
91   const fields = { volumeKg, sell, raw, proc, freight };
92   for (const [k, v] of Object.entries(fields)) {
93     if (!Number.isFinite(v)) throw new Error(`Please enter a valid number for "${k}".`);
94   }
95 
96   const netKg = Math.max(0, volumeKg * (yieldPct / 100)); // ✅ use Yield directly
97   const revenue = netKg * sell;
98   const totalCost = netKg * (raw + proc + freight);
99   const profit = revenue - totalCost;
100   const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
101   const profitPerKg = netKg > 0 ? profit / netKg : 0;
102 
103   out.netKg.textContent       = fmtNumber(netKg, 2) + ' kg';
104   out.revenue.textContent     = fmtCurrency(revenue, currency);
105   out.totalCost.textContent   = fmtCurrency(totalCost, currency);
106   out.profit.textContent      = fmtCurrency(profit, currency);
107   out.marginPct.textContent   = fmtNumber(marginPct, 1) + ' %';
108   out.profitPerKg.textContent = fmtCurrency(profitPerKg, currency) + ' /kg';
109 
110   resWrap.hidden = false;
111 
112   return { currency, netKg, revenue, totalCost, profit, marginPct, profitPerKg,
113            inputs: { volumeKg, sell, raw, proc, freight, yieldPct } };
114 }
115 
116 // --- webhook (optional) ----------------------------------------------------
117 async function postWebhook(payload) {
118   const url = (f.webhook.value || '').trim();
119   postStatus.textContent = '';
120   if (!url) return;
121 
122   try {
123     const res = await fetch(url, {
124       method: 'POST',
125       headers: { 'content-type': 'application/json' },
126       body: JSON.stringify(payload)
127     });
128     postStatus.textContent = res.ok ? 'Posted results to webhook ✔' : `Webhook error: ${res.status}`;
129   } catch (err) {
130     postStatus.textContent = 'Webhook failed: ' + err.message;
131   }
132 }
133 
134 // --- events ----------------------------------------------------------------
135 form?.addEventListener('submit', async (e) => {
136   e.preventDefault();
137   try {
138     const result = calculate();
139     await postWebhook(result);
140   } catch (err) {
141     alert(err.message || String(err));
142   }
143 });
144 
145 form?.addEventListener('reset', () => {
146   setTimeout(() => {
147     resWrap.hidden = true;
148     postStatus.textContent = '';
149     Object.values(out).forEach(el => el.textContent = '–');
150   }, 0);
151 });
152 
153 currencySel?.addEventListener('change', () => {
154   if (!resWrap.hidden) {
155     try { calculate(); } catch {}
156   }
157 });
158 
159 // --- nav (hamburger) -------------------------------------------------------
160 const navToggle = $('#navToggle');
161 const siteNav = $('#siteNav');
162 navToggle?.addEventListener('click', () => {
163   const open = siteNav.classList.toggle('open');
164   navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
165 });
