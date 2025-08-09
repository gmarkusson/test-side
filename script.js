// Helpers
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

// Shared UI
const currencySel = $('#currencySelect');

// ---------------- Calculator 1: Key Numbers ----------------
const form1 = $('#kpiForm');
const res1 = $('#kpiResults');
const postStatus = $('#postStatus');

const f1 = {
  volumeKg: $('input[name="volumeKg"]'),
  sellPrice: $('input[name="sellPrice"]'),
  rawCost:   $('input[name="rawCost"]'),
  procCost:  $('input[name="procCost"]'),
  freight:   $('input[name="freight"]'),
  yieldPct:  $('input[name="yieldPct"]'),
  webhook:   $('input[name="webhookUrl"]')
};

const out1 = {
  netKg:        $('#r_netKg'),
  revenue:      $('#r_revenue'),
  totalCost:    $('#r_totalCost'),
  profit:       $('#r_profit'),
  marginPct:    $('#r_marginPct'),
  profitPerKg:  $('#r_profitPerKg')
};

function calculateKPI() {
  const currency = currencySel.value;

  const volumeKg = parseNum(f1.volumeKg.value);
  const sell     = parseNum(f1.sellPrice.value);
  const raw      = parseNum(f1.rawCost.value);
  const proc     = parseNum(f1.procCost.value);
  const freight  = parseNum(f1.freight.value || 0);
  const yieldPct = parseNum(f1.yieldPct.value || 100);

  if (yieldPct < 0 || yieldPct > 100) throw new Error('Yield (%) must be between 0 and 100.');
  const fields = { volumeKg, sell, raw, proc, freight, yieldPct };
  for (const [k, v] of Object.entries(fields)) if (!Number.isFinite(v)) throw new Error(`Please enter a valid number for "${k}".`);

  const netKg = Math.max(0, volumeKg * (yieldPct / 100));
  const revenue = netKg * sell;
  const totalCost = netKg * (raw + proc + freight);
  const profit = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const profitPerKg = netKg > 0 ? profit / netKg : 0;

  out1.netKg.textContent       = fmtNumber(netKg, 2) + ' kg';
  out1.revenue.textContent     = fmtCurrency(revenue, currency);
  out1.totalCost.textContent   = fmtCurrency(totalCost, currency);
  out1.profit.textContent      = fmtCurrency(profit, currency);
  out1.marginPct.textContent   = fmtNumber(marginPct, 1) + ' %';
  out1.profitPerKg.textContent = fmtCurrency(profitPerKg, currency) + ' /kg';

  res1.hidden = false;

  return { currency, netKg, revenue, totalCost, profit, marginPct, profitPerKg,
           inputs: { volumeKg, sell, raw, proc, freight, yieldPct } };
}

// Optional webhook for calc 1
async function postWebhook(payload) {
  const url = (f1.webhook?.value || '').trim();
  if (!url) return;
  postStatus.textContent = '';
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

form1?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try { const r = calculateKPI(); await postWebhook(r); } catch (err) { alert(err.message || String(err)); }
});
form1?.addEventListener('reset', () => {
  setTimeout(() => {
    res1.hidden = true;
    postStatus.textContent = '';
    Object.values(out1).forEach(el => el.textContent = '–');
  }, 0);
});
currencySel?.addEventListener('change', () => {
  if (!res1.hidden) { try { calculateKPI(); } catch {} }
  if (!$('#dayResults').hidden) { try { calculateDay(); } catch {} }
  if (!$('#advResults').hidden) { try { calculateAdvanced(); } catch {} }
});

// ---------------- Calculator 2: Factory Day (single-batch) ----------------
const form2 = $('#dayForm');
const res2 = $('#dayResults');

const f2 = {
  staffCount:          $('input[name="staffCount"]', form2),
  staffCostPerPerson:  $('input[name="staffCostPerPerson"]', form2),
  supCount:            $('input[name="supCount"]', form2),
  supCostPerPerson:    $('input[name="supCostPerPerson"]', form2),
  rawName:             $('input[name="rawName"]', form2),
  rawUsedKg:           $('input[name="rawUsedKg"]', form2),
  rawCostPerKg:        $('input[name="rawCostPerKg"]', form2),
  packCostPerKg:       $('input[name="packCostPerKg"]', form2),
  productName:         $('input[name="productName"]', form2),
  producedKg:          $('input[name="producedKg"]', form2),
  sellPriceDay:        $('input[name="sellPriceDay"]', form2),
  housingCost:         $('input[name="housingCost"]', form2),
  adminCost:           $('input[name="adminCost"]', form2),
  elecKwh:             $('input[name="elecKwh"]', form2),
  elecCostPerKwh:      $('input[name="elecCostPerKwh"]', form2),
  waterM3:             $('input[name="waterM3"]', form2),
  waterCostPerM3:      $('input[name="waterCostPerM3"]', form2),
  freightPerKg:        $('input[name="freightPerKg"]', form2),
  maintenanceCost:     $('input[name="maintenanceCost"]', form2),
  deprCost:            $('input[name="deprCost"]', form2),
  otherCost:           $('input[name="otherCost"]', form2)
};

const out2 = {
  yieldPct:   $('#d_yieldPct'),
  revenue:    $('#d_revenue'),
  totalCost:  $('#d_totalCost'),
  profit:     $('#d_profit'),
  marginPct:  $('#d_marginPct'),
  costPerKg:  $('#d_costPerKg'),
  laborFloor: $('#d_laborFloor'),
  laborSup:   $('#d_laborSup'),
  rawCost:    $('#d_rawCost'),
  packCost:   $('#d_packCost'),
  freight:    $('#d_freightCost'),
  utilities:  $('#d_utilities'),
  housing:    $('#d_housing'),
  admin:      $('#d_admin'),
  maint:      $('#d_maint'),
  depr:       $('#d_depr'),
  other:      $('#d_other')
};

function calculateDay() {
  const currency = currencySel.value;

  const staffCount         = parseNum(f2.staffCount.value);
  const staffCostPerPerson = parseNum(f2.staffCostPerPerson.value);
  const supCount           = parseNum(f2.supCount.value);
  const supCostPerPerson   = parseNum(f2.supCostPerPerson.value);
  const rawUsedKg          = parseNum(f2.rawUsedKg.value);
  const rawCostPerKg       = parseNum(f2.rawCostPerKg.value);
  const packCostPerKg      = parseNum(f2.packCostPerKg.value);
  const producedKg         = parseNum(f2.producedKg.value);
  const sellPriceDay       = parseNum(f2.sellPriceDay.value);
  const housingCost        = parseNum(f2.housingCost.value || 0);
  const adminCost          = parseNum(f2.adminCost.value || 0);
  const elecKwh            = parseNum(f2.elecKwh.value || 0);
  const elecCostPerKwh     = parseNum(f2.elecCostPerKwh.value || 0);
  const waterM3            = parseNum(f2.waterM3.value || 0);
  const waterCostPerM3     = parseNum(f2.waterCostPerM3.value || 0);
  const freightPerKg       = parseNum(f2.freightPerKg.value || 0);
  const maintenanceCost    = parseNum(f2.maintenanceCost.value || 0);
  const deprCost           = parseNum(f2.deprCost.value || 0);
  const otherCost          = parseNum(f2.otherCost.value || 0);

  const required = { staffCount, staffCostPerPerson, supCount, supCostPerPerson, rawUsedKg, rawCostPerKg, packCostPerKg, producedKg, sellPriceDay };
  for (const [k, v] of Object.entries(required)) if (!Number.isFinite(v)) throw new Error(`Please enter a valid number for "${k}".`);

  const laborFloor = staffCount * staffCostPerPerson;
  const laborSup   = supCount   * supCostPerPerson;
  const rawCost  = rawUsedKg  * rawCostPerKg;
  const packCost = producedKg * packCostPerKg;

  const utilElec  = elecKwh  * elecCostPerKwh;
  const utilWater = waterM3  * waterCostPerM3;
  const utilities = utilElec + utilWater;

  const freight = producedKg * freightPerKg;

  const revenue   = producedKg * sellPriceDay;
  const yieldPct  = rawUsedKg > 0 ? (producedKg / rawUsedKg) * 100 : 0;

  const totalCost = laborFloor + laborSup + rawCost + packCost + freight
                  + utilities + housingCost + adminCost + maintenanceCost
                  + deprCost + otherCost;

  const profit    = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const costPerKg = producedKg > 0 ? totalCost / producedKg : 0;

  out2.yieldPct.textContent  = fmtNumber(yieldPct, 1) + ' %';
  out2.revenue.textContent   = fmtCurrency(revenue, currency);
  out2.totalCost.textContent = fmtCurrency(totalCost, currency);
  out2.profit.textContent    = fmtCurrency(profit, currency);
  out2.marginPct.textContent = fmtNumber(marginPct, 1) + ' %';
  out2.costPerKg.textContent = fmtCurrency(costPerKg, currency) + ' /kg';

  out2.laborFloor.textContent = fmtCurrency(laborFloor, currency);
  out2.laborSup.textContent   = fmtCurrency(laborSup, currency);
  out2.rawCost.textContent    = fmtCurrency(rawCost, currency);
  out2.packCost.textContent   = fmtCurrency(packCost, currency);
  out2.freight.textContent    = fmtCurrency(freight, currency);
  out2.utilities.textContent  = fmtCurrency(utilities, currency);
  out2.housing.textContent    = fmtCurrency(housingCost, currency);
  out2.admin.textContent      = fmtCurrency(adminCost, currency);
  out2.maint.textContent      = fmtCurrency(maintenanceCost, currency);
  out2.depr.textContent       = fmtCurrency(deprCost, currency);
  out2.other.textContent      = fmtCurrency(otherCost, currency);

  res2.hidden = false;
}

form2?.addEventListener('submit', (e) => { e.preventDefault(); try { calculateDay(); } catch (err) { alert(err.message || String(err)); } });
form2?.addEventListener('reset', () => {
  setTimeout(() => {
    res2.hidden = true;
    [ '#d_yieldPct','#d_revenue','#d_totalCost','#d_profit','#d_marginPct','#d_costPerKg',
      '#d_laborFloor','#d_laborSup','#d_rawCost','#d_packCost','#d_freightCost','#d_utilities',
      '#d_housing','#d_admin','#d_maint','#d_depr','#d_other'
    ].forEach(id => $(id).textContent = '–');
  }, 0);
});

// ---------------- Calculator 3: Multi-species & products ----------------
const formA = $('#advForm');
const resA = $('#advResults');
const rawTbody = $('#rawTable tbody');
const skuTbody = $('#skuTable tbody');
const prodTbody = $('#prodTable tbody');
const speciesSummary = $('#speciesSummary');

// Add default rows
function addRawRow(data = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" name="species" placeholder="e.g. Salmon" value="${data.species||''}"></td>
    <td><input type="text" name="rawName" placeholder="e.g. Atlantic salmon HOG" value="${data.rawName||''}"></td>
    <td><input type="text" inputmode="decimal" name="usedKg" value="${data.usedKg||''}"></td>
    <td><input type="text" inputmode="decimal" name="costPerKg" value="${data.costPerKg||''}"></td>
    <td><button type="button" class="btn remove">✕</button></td>
  `;
  rawTbody.appendChild(tr);
}
function addSkuRow(data = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" name="skuName" placeholder="e.g. Vacuum pouch 150µ" value="${data.skuName||''}"></td>
    <td><input type="text" inputmode="decimal" name="skuCostPerKg" value="${data.skuCostPerKg||''}"></td>
    <td><button type="button" class="btn remove">✕</button></td>
  `;
  skuTbody.appendChild(tr);
  refreshSkuOptions();
}
function addProdRow(data = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" name="species" placeholder="e.g. Salmon" value="${data.species||''}"></td>
    <td><input type="text" name="prodName" placeholder="e.g. Portions 4x125g" value="${data.prodName||''}"></td>
    <td><input type="text" inputmode="decimal" name="producedKg" value="${data.producedKg||''}"></td>
    <td><input type="text" inputmode="decimal" name="sellPrice" value="${data.sellPrice||''}"></td>
    <td>
      <select name="pkgSku">
        <option value="">— select SKU —</option>
      </select>
    </td>
    <td><button type="button" class="btn remove">✕</button></td>
  `;
  prodTbody.appendChild(tr);
  refreshSkuOptions();
  if (data.pkgSku) tr.querySelector('select[name="pkgSku"]').value = data.pkgSku;
}

$('#addRaw')?.addEventListener('click', () => addRawRow({}));
$('#addSku')?.addEventListener('click', () => addSkuRow({}));
$('#addProd')?.addEventListener('click', () => addProdRow({}));

rawTbody.addEventListener('click', (e) => { if (e.target.closest('.remove')) e.target.closest('tr').remove(); });
skuTbody.addEventListener('click', (e) => { if (e.target.closest('.remove')) { e.target.closest('tr').remove(); refreshSkuOptions(); }});
prodTbody.addEventListener('click', (e) => { if (e.target.closest('.remove')) e.target.closest('tr').remove(); });

// Populate some starter rows
addRawRow({ species:'Salmon', rawName:'Atlantic salmon HOG', usedKg:'1200', costPerKg:'7,90' });
addSkuRow({ skuName:'Vacuum pouch 150µ', skuCostPerKg:'0,40' });
addSkuRow({ skuName:'Retail carton', skuCostPerKg:'0,20' });
addProdRow({ species:'Salmon', prodName:'Portions 4x125g', producedKg:'1000', sellPrice:'14,50', pkgSku:'Vacuum pouch 150µ' });

function getSkuMap() {
  const map = new Map();
  [...skuTbody.querySelectorAll('tr')].forEach(tr => {
    const name = tr.querySelector('input[name="skuName"]')?.value?.trim();
    const cost = parseNum(tr.querySelector('input[name="skuCostPerKg"]')?.value);
    if (name && Number.isFinite(cost)) map.set(name, cost);
  });
  return map;
}

function refreshSkuOptions() {
  const names = [...getSkuMap().keys()];
  [...prodTbody.querySelectorAll('select[name="pkgSku"]')].forEach(sel => {
    const current = sel.value;
    sel.innerHTML = `<option value="">— select SKU —</option>` + names.map(n => `<option value="${n}">${n}</option>`).join('');
    if (names.includes(current)) sel.value = current;
  });
}

function calculateAdvanced() {
  const currency = currencySel.value;

  // Overheads shared
  const f = (name) => parseNum(formA.querySelector(`[name="${name}"]`).value || 0);
  const staffCount         = f('staffCount');
  const staffCostPerPerson = f('staffCostPerPerson');
  const supCount           = f('supCount');
  const supCostPerPerson   = f('supCostPerPerson');
  const housingCost        = f('housingCost');
  const adminCost          = f('adminCost');
  const maintenanceCost    = f('maintenanceCost');
  const deprCost           = f('deprCost');
  const elecKwh            = f('elecKwh');
  const elecCostPerKwh     = f('elecCostPerKwh');
  const waterM3            = f('waterM3');
  const waterCostPerM3     = f('waterCostPerM3');
  const freightPerKg       = f('freightPerKg');
  const otherCost          = f('otherCost');

  // Raw materials
  const raws = [...rawTbody.querySelectorAll('tr')].map(tr => ({
    species:  tr.querySelector('input[name="species"]')?.value?.trim() || '',
    rawName:  tr.querySelector('input[name="rawName"]')?.value?.trim() || '',
    usedKg:   parseNum(tr.querySelector('input[name="usedKg"]')?.value),
    costPerKg:parseNum(tr.querySelector('input[name="costPerKg"]')?.value)
  })).filter(r => r.species && Number.isFinite(r.usedKg) && Number.isFinite(r.costPerKg));

  // SKUs
  const skuMap = getSkuMap();

  // Products
  const prods = [...prodTbody.querySelectorAll('tr')].map(tr => ({
    species:    tr.querySelector('input[name="species"]')?.value?.trim() || '',
    prodName:   tr.querySelector('input[name="prodName"]')?.value?.trim() || '',
    producedKg: parseNum(tr.querySelector('input[name="producedKg"]')?.value),
    sellPrice:  parseNum(tr.querySelector('input[name="sellPrice"]')?.value),
    pkgSku:     tr.querySelector('select[name="pkgSku"]')?.value || ''
  })).filter(p => p.species && Number.isFinite(p.producedKg) && Number.isFinite(p.sellPrice));

  // Totals
  const totalProduced = prods.reduce((s,p)=>s+p.producedKg,0);
  const totalRawUsed  = raws.reduce((s,r)=>s+r.usedKg,0);

  // Costs
  const rawCost  = raws.reduce((s,r)=>s + r.usedKg * r.costPerKg, 0);
  const packCost = prods.reduce((s,p)=> s + p.producedKg * (skuMap.get(p.pkgSku) || 0), 0);
  const freight  = totalProduced * freightPerKg;
  const utilElec = elecKwh * elecCostPerKwh;
  const utilWater= waterM3 * waterCostPerM3;
  const utilities= utilElec + utilWater;
  const laborFloor = staffCount * staffCostPerPerson;
  const laborSup   = supCount   * supCostPerPerson;

  const revenue = prods.reduce((s,p)=> s + p.producedKg * p.sellPrice, 0);
  const totalCost = rawCost + packCost + freight + utilities + housingCost + adminCost + maintenanceCost + deprCost + laborFloor + laborSup + otherCost;
  const profit = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const costPerKg = totalProduced > 0 ? totalCost / totalProduced : 0;
  const yieldPct  = totalRawUsed > 0 ? (totalProduced / totalRawUsed) * 100 : 0;

  // Per-species summary
  const bySpecies = new Map();
  // init from raws
  raws.forEach(r => {
    if (!bySpecies.has(r.species)) bySpecies.set(r.species, { rawUsed:0, rawCost:0, produced:0, revenue:0, packCost:0, freight:0 });
    const o = bySpecies.get(r.species);
    o.rawUsed += r.usedKg;
    o.rawCost += r.usedKg * r.costPerKg;
  });
  // add prods
  prods.forEach(p => {
    if (!bySpecies.has(p.species)) bySpecies.set(p.species, { rawUsed:0, rawCost:0, produced:0, revenue:0, packCost:0, freight:0 });
    const o = bySpecies.get(p.species);
    o.produced += p.producedKg;
    o.revenue  += p.producedKg * p.sellPrice;
    o.packCost += p.producedKg * (skuMap.get(p.pkgSku) || 0);
    o.freight  += p.producedKg * freightPerKg;
  });

  // Write overall outputs
  $('#a_yieldPct').textContent  = fmtNumber(yieldPct, 1) + ' %';
  $('#a_revenue').textContent   = fmtCurrency(revenue, currency);
  $('#a_totalCost').textContent = fmtCurrency(totalCost, currency);
  $('#a_profit').textContent    = fmtCurrency(profit, currency);
  $('#a_marginPct').textContent = fmtNumber(marginPct, 1) + ' %';
  $('#a_costPerKg').textContent = fmtCurrency(costPerKg, currency) + ' /kg';

  $('#a_laborFloor').textContent = fmtCurrency(laborFloor, currency);
  $('#a_laborSup').textContent   = fmtCurrency(laborSup, currency);
  $('#a_rawCost').textContent    = fmtCurrency(rawCost, currency);
  $('#a_packCost').textContent   = fmtCurrency(packCost, currency);
  $('#a_freightCost').textContent= fmtCurrency(freight, currency);
  $('#a_utilities').textContent  = fmtCurrency(utilities, currency);
  $('#a_housing').textContent    = fmtCurrency(housingCost, currency);
  $('#a_admin').textContent      = fmtCurrency(adminCost, currency);
  $('#a_maint').textContent      = fmtCurrency(maintenanceCost, currency);
  $('#a_depr').textContent       = fmtCurrency(deprCost, currency);
  $('#a_other').textContent      = fmtCurrency(otherCost, currency);

  // Species cards
  speciesSummary.innerHTML = '';
  for (const [sp, o] of bySpecies.entries()) {
    const spYield = o.rawUsed > 0 ? (o.produced / o.rawUsed) * 100 : 0;
    const spDirect = o.rawCost + o.packCost + o.freight; // direct (no shared OH / labor split)
    const spGross  = o.revenue - spDirect;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${sp || '—'}</h4>
      <p><strong>Yield:</strong> ${fmtNumber(spYield,1)} %</p>
      <p><strong>Revenue:</strong> ${fmtCurrency(o.revenue, currency)}</p>
      <p><strong>Raw:</strong> ${fmtCurrency(o.rawCost, currency)}</p>
      <p><strong>Packaging:</strong> ${fmtCurrency(o.packCost, currency)}</p>
      <p><strong>Freight:</strong> ${fmtCurrency(o.freight, currency)}</p>
      <p><strong>Gross (before OH):</strong> ${fmtCurrency(spGross, currency)}</p>
    `;
    speciesSummary.appendChild(card);
  }

  resA.hidden = false;
}

formA?.addEventListener('submit', (e) => {
  e.preventDefault();
  try { calculateAdvanced(); } catch (err) { alert(err.message || String(err)); }
});
formA?.addEventListener('reset', () => {
  setTimeout(() => {
    resA.hidden = true;
    ['#a_yieldPct','#a_revenue','#a_totalCost','#a_profit','#a_marginPct','#a_costPerKg',
     '#a_laborFloor','#a_laborSup','#a_rawCost','#a_packCost','#a_freightCost','#a_utilities',
     '#a_housing','#a_admin','#a_maint','#a_depr','#a_other'
    ].forEach(id => $(id).textContent = '–');
    speciesSummary.innerHTML = '';
    rawTbody.innerHTML = ''; skuTbody.innerHTML = ''; prodTbody.innerHTML = '';
    addRawRow({ species:'Salmon', rawName:'Atlantic salmon HOG', usedKg:'1200', costPerKg:'7,90' });
    addSkuRow({ skuName:'Vacuum pouch 150µ', skuCostPerKg:'0,40' });
    addSkuRow({ skuName:'Retail carton',     skuCostPerKg:'0,20' });
    addProdRow({ species:'Salmon', prodName:'Portions 4x125g', producedKg:'1000', sellPrice:'14,50', pkgSku:'Vacuum pouch 150µ' });
  }, 0);
});

// Nav (hamburger)
const navToggle = $('#navToggle');
const siteNav = $('#siteNav');
navToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});
