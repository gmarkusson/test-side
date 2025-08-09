 1 // --- helpers ---------------------------------------------------------------
 2 const $ = (sel, root = document) => root.querySelector(sel);
 3 
 4 const CURRENCY_MAP = {
 5   ISK: { locale: 'is-IS', code: 'ISK', minFraction: 0, maxFraction: 0 },
 6   EUR: { locale: 'de-DE', code: 'EUR', minFraction: 2, maxFraction: 2 },
 7   GBP: { locale: 'en-GB', code: 'GBP', minFraction: 2, maxFraction: 2 },
 8   USD: { locale: 'en-US', code: 'USD', minFraction: 2, maxFraction: 2 },
 9   SEK: { locale: 'sv-SE', code: 'SEK', minFraction: 0, maxFraction: 0 },
10   NOK: { locale: 'nb-NO', code: 'NOK', minFraction: 0, maxFraction: 0 },
11   DKK: { locale: 'da-DK', code: 'DKK', minFraction: 0, maxFraction: 0 }
12 };
13 
14 function parseNum(v) {
15   if (v == null) return NaN;
16   const s = String(v).trim();
17   if (!s) return NaN;
18   let t = s.replace(/\s/g, '');
19   if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) {
20     t = t.replace(/\./g, '').replace(',', '.');
21   } else {
22     t = t.replace(/,/g, '');
23   }
24   const n = Number(t);
25   return Number.isFinite(n) ? n : NaN;
26 }
27 
28 function fmtCurrency(val, currency) {
29   const cfg = CURRENCY_MAP[currency] || CURRENCY_MAP.EUR;
30   return new Intl.NumberFormat(cfg.locale, {
31     style: 'currency',
32     currency: cfg.code,
33     minimumFractionDigits: cfg.minFraction,
34     maximumFractionDigits: cfg.maxFraction
35   }).format(val);
36 }
37 
38 function fmtNumber(val, digits = 2) {
39   return new Intl.NumberFormat(undefined, {
40     minimumFractionDigits: digits,
41     maximumFractionDigits: digits
42   }).format(val);
43 }
44 
45 // --- UI elements -----------------------------------------------------------
46 const currencySel = $('#currencySelect');
47 const form = $('#kpiForm');
48 const resWrap = $('#kpiResults');
49 const postStatus = $('#postStatus');
50 
51 const f = {
52   volumeKg: $('input[name="volumeKg"]'),
53   sellPrice: $('input[name="sellPrice"]'),
54   rawCost:   $('input[name="rawCost"]'),
55   procCost:  $('input[name="procCost"]'),
56   freight:   $('input[name="freight"]'),
57   yieldPct:  $('input[name="yieldPct"]'),
58   webhook:   $('input[name="webhookUrl"]')
59 };
60 
61 const out = {
62   netKg:        $('#r_netKg'),
63   revenue:      $('#r_revenue'),
64   totalCost:    $('#r_totalCost'),
65   profit:       $('#r_profit'),
66   marginPct:    $('#r_marginPct'),
67   profitPerKg:  $('#r_profitPerKg')
68 };
69 
70 // --- core calculation ------------------------------------------------------
71 function calculate() {
72   const currency = currencySel.value;
73 
74   const volumeKg = parseNum(f.volumeKg.value);
75   const sell     = parseNum(f.sellPrice.value);
76   const raw      = parseNum(f.rawCost.value);
77   const proc     = parseNum(f.procCost.value);
78   const freight  = parseNum(f.freight.value || 0);
79   const yieldPct = parseNum(f.yieldPct.value || 100); // ✅ changed default to 100
80 
81   if (yieldPct < 0 || yieldPct > 100) {
82     throw new Error('Yield (%) must be between 0 and 100.');
83   }
84 
85   const fields = { volumeKg, sell, raw, proc, freight, yieldPct };
86   for (const [k, v] of Object.entries(fields)) {
87     if (!Number.isFinite(v)) {
88       throw new Error(`Please enter a valid number for "${k}".`);
89     }
90   }
91 
92   const netKg = Math.max(0, volumeKg * (yieldPct / 100)); // ✅ fixed calculation
93   const revenue = netKg * sell;
94   const totalCost = netKg * (raw + proc + freight);
95   const profit = revenue - totalCost;
96   const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
97   const profitPerKg = netKg > 0 ? profit / netKg : 0;
98 
99   out.netKg.textContent       = fmtNumber(netKg, 2) + ' kg';
100   out.revenue.textContent     = fmtCurrency(revenue, currency);
101   out.totalCost.textContent   = fmtCurrency(totalCost, currency);
102   out.profit.textContent      = fmtCurrency(profit, currency);
103   out.marginPct.textContent   = fmtNumber(marginPct, 1) + ' %';
104   out.profitPerKg.textContent = fmtCurrency(profitPerKg, currency) + ' /kg';
105 
106   resWrap.hidden = false;
107 
108   return { currency, netKg, revenue, totalCost, profit, marginPct, profitPerKg,
109            inputs: { volumeKg, sell, raw, proc, freight, yieldPct } };
110 }
111 
112 // --- webhook (optional) ----------------------------------------------------
113 async function postWebhook(payload) {
114   const url = (f.webhook.value || '').trim();
115   postStatus.textContent = '';
116   if (!url) return;
117 
118   try {
119     const res = await fetch(url, {
120       method: 'POST',
121       headers: { 'content-type': 'application/json' },
122       body: JSON.stringify(payload)
123     });
124     postStatus.textContent = res.ok ? 'Posted results to webhook ✔' : `Webhook error: ${res.status}`;
125   } catch (err) {
126     postStatus.textContent = 'Webhook failed: ' + err.message;
127   }
128 }
129 
130 // --- events ----------------------------------------------------------------
131 form?.addEventListener('submit', async (e) => {
132   e.preventDefault();
133   try {
134     const result = calculate();
135     await postWebhook(result);
136   } catch (err) {
137     alert(err.message || String(err));
138   }
139 });
140 
141 form?.addEventListener('reset', () => {
142   setTimeout(() => {
143     resWrap.hidden = true;
144     postStatus.textContent = '';
145     Object.values(out).forEach(el => el.textContent = '–');
146   }, 0);
147 });
148 
149 currencySel?.addEventListener('change', () => {
150   if (!resWrap.hidden) {
151     try { calculate(); } catch { /* ignore until form valid */ }
152   }
153 });
154 
155 // --- nav + theme -----------------------------------------------------------
156 const navToggle = $('#navToggle');
157 const siteNav = $('#siteNav');
158 navToggle?.addEventListener('click', () => {
159   const open = siteNav.classList.toggle('open');
160   navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
161 });
162 
163 const themeToggle = $('#themeToggle');
164 themeToggle?.addEventListener('click', () => {
165   const light = document.documentElement.classList.toggle('light');
166   try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch {}
167 });
168 (function initTheme(){
169   try {
170     const saved = localStorage.getItem('theme');
171     if (saved === 'light') document.documentElement.classList.add('light');
172   } catch {}
173 })();
