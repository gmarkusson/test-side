// -------- Helpers & formatting --------
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

function fmtCurrency(val, currency='EUR') {
  const cfg = CURRENCY_MAP[currency] || CURRENCY_MAP.EUR;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    minimumFractionDigits: cfg.minFraction,
    maximumFractionDigits: cfg.maxFraction
  }).format(val);
}

function fmtNumber(val, digits = 1) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(val);
}

// -------- Iceland working days (weekends + public holidays) --------

// Easter Sunday (Anonymous Gregorian algorithm)
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function addDays(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function firstThursdayAfterApril18(year) {
  // First Day of Summer (Sumardagurinn fyrsti) = first Thursday after April 18
  const start = new Date(Date.UTC(year, 3, 19)); // Apr 19
  for (let i = 0; i < 10; i++) {
    const d = addDays(start, i);
    if (d.getUTCDay() === 4) return d; // 4 = Thursday
  }
  return addDays(start, 7);
}
function firstMondayInAugust(year) {
  const d = new Date(Date.UTC(year, 7, 1)); // Aug 1
  const day = d.getUTCDay();
  const offset = (8 - day) % 7; // to Monday
  return addDays(d, offset === 0 ? 0 : offset);
}
function icelandPublicHolidays(year) {
  const easter = easterSunday(year);
  return [
    new Date(Date.UTC(year, 0, 1)),                       // New Year's Day
    addDays(easter, -3),                                  // Maundy Thursday
    addDays(easter, -2),                                  // Good Friday
    addDays(easter, 1),                                   // Easter Monday
    firstThursdayAfterApril18(year),                      // First Day of Summer
    new Date(Date.UTC(year, 4, 1)),                       // Labour Day (May 1)
    addDays(easter, 39),                                  // Ascension Day
    addDays(easter, 50),                                  // Whit Monday (Pentecost Mon)
    firstMondayInAugust(year),                            // Commerce Day
    new Date(Date.UTC(year, 5, 17)),                      // National Day (June 17)
    new Date(Date.UTC(year, 11, 25)),                     // Christmas Day
    new Date(Date.UTC(year, 11, 26)),                     // Second Day of Christmas
    // Note: We do not count half-days (Dec 24 & Dec 31 afternoon).
  ];
}
function isSameDateUTC(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
         a.getUTCMonth() === b.getUTCMonth() &&
         a.getUTCDate() === b.getUTCDate();
}
function workingDaysInMonth(year, monthIndex /*0-11*/) {
  const holidays = icelandPublicHolidays(year);
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  let count = 0;
  for (let d = new Date(first); d <= last; d = addDays(d, 1)) {
    const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
    if (dow === 0 || dow === 6) continue; // weekends
    if (holidays.some(h => isSameDateUTC(h, d))) continue; // public holiday
    count++;
  }
  return count;
}

// -------- Shared currency control --------
const currencySel = $('#currencySelect');

// ================= Calculator 1: Key Numbers =================
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
  const currency = currencySel.value || 'EUR';

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
  return { currency, netKg, revenue, totalCost, profit, marginPct, profitPerKg };
}

// optional webhook
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

form1?.addEventListener('submit', async (e) => { e.preventDefault(); try { const r = calculateKPI(); await postWebhook(r); } catch (err) { alert(err.message || String(err)); }});
form1?.addEventListener('reset', () => { setTimeout(() => { res1.hidden = true; postStatus.textContent = ''; Object.values(out1).forEach(el => el.textContent='–'); }, 0); });

// Currency change re-runs visible calcs
currencySel?.addEventListener('change', () => {
  if (!res1.hidden) try { calculateKPI(); } catch {}
  if (!$('#dayResults').hidden) try { calculateDay(); } catch {}
  if (!$('#netResults').hidden) try { calculateNetwork(); } catch {}
});

// ================= Calculator 2: Factory Day (simple) =================
const form2 = $('#dayForm');
const res2 = $('#dayResults');

function eurPerDayFromIskMonthly(isk, rate, workDays) {
  if (!(rate > 0 && workDays > 0)) return 0;
  return (isk * rate) / workDays;
}
function laborCost(people, dayH, dayRate, otH, otRate) {
  const d = people * dayH * dayRate;
  const o = people * otH * otRate;
  return { day: d, ot: o, total: d + o };
}

function initMonthAuto(inputId, outputId) {
  const m = $(inputId);
  const o = $(outputId);
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
  m.value = ym;
  const update = () => {
    const [yy, mm] = (m.value || ym).split('-').map(Number);
    o.value = workingDaysInMonth(yy, mm - 1);
  };
  m.addEventListener('change', update);
  update();
}
initMonthAuto('#dayMonth', '#dayWorkDays');

function calculateDay() {
  const currency = 'EUR';

  // Month / FX / workdays
  const [yy, mm] = ($('#dayMonth').value).split('-').map(Number);
  const workDays = parseNum($('#dayWorkDays').value);
  const rate     = parseNum(form2.elements.iskToEur.value);

  // Labor
  const sc = parseNum(form2.elements.staffCount.value);
  const sDH= parseNum(form2.elements.staffDayHours.value);
  const sDR= parseNum(form2.elements.staffDayRate.value);
  const sOH= parseNum(form2.elements.staffOtHours.value);
  const sOR= parseNum(form2.elements.staffOtRate.value);
  const staffLab = laborCost(sc, sDH, sDR, sOH, sOR);

  const uc = parseNum(form2.elements.supCount.value);
  const uDH= parseNum(form2.elements.supDayHours.value);
  const uDR= parseNum(form2.elements.supDayRate.value);
  const uOH= parseNum(form2.elements.supOtHours.value);
  const uOR= parseNum(form2.elements.supOtRate.value);
  const supLab = laborCost(uc, uDH, uDR, uOH, uOR);

  // Materials & output
  const rawKg   = parseNum(form2.elements.rawUsedKg.value);
  const rawCost = parseNum(form2.elements.rawCostPerKg.value);
  const packKg  = parseNum(form2.elements.packCostPerKg.value);
  const prodKg  = parseNum(form2.elements.producedKg.value);
  const sell    = parseNum(form2.elements.sellPriceDay.value);

  const freightPerKg = parseNum(form2.elements.freightPerKg.value || 0);
  const utilitiesDay = parseNum(form2.elements.utilitiesDay.value || 0);
  const maint        = parseNum(form2.elements.maintenanceCost.value || 0);
  const depr         = parseNum(form2.elements.deprCost.value || 0);
  const other        = parseNum(form2.elements.otherCost.value || 0);

  // Fixed ISK/month -> EUR/day
  const housingDayEur = eurPerDayFromIskMonthly(parseNum(form2.elements.housingIsk.value), rate, workDays);
  const equipDayEur   = eurPerDayFromIskMonthly(parseNum(form2.elements.equipIsk.value),   rate, workDays);
  const adminDayEur   = eurPerDayFromIskMonthly(parseNum(form2.elements.adminIsk.value),   rate, workDays);

  // Validate some required nums
  const req = [workDays, rate, sc, sDH, sDR, rawKg, rawCost, packKg, prodKg, sell];
  if (req.some(v => !Number.isFinite(v))) throw new Error('Please fill required numeric fields (month, FX, staff, raw, produced, price…).');

  // Calculations
  const laborStaff = staffLab.total;
  const laborSup   = supLab.total;

  const rawCostTot = rawKg * rawCost;
  const packCost   = prodKg * packKg;
  const freight    = prodKg * freightPerKg;

  const revenue    = prodKg * sell;
  const yieldPct   = rawKg > 0 ? (prodKg / rawKg) * 100 : 0;

  const totalCost  = laborStaff + laborSup + rawCostTot + packCost + freight + utilitiesDay
                   + housingDayEur + equipDayEur + adminDayEur + maint + depr + other;

  const profit     = revenue - totalCost;
  const marginPct  = revenue > 0 ? (profit / revenue) * 100 : 0;
  const costPerKg  = prodKg > 0 ? totalCost / prodKg : 0;

  // Output
  $('#d_yieldPct').textContent  = fmtNumber(yieldPct) + ' %';
  $('#d_revenue').textContent   = fmtCurrency(revenue, currency);
  $('#d_totalCost').textContent = fmtCurrency(totalCost, currency);
  $('#d_profit').textContent    = fmtCurrency(profit, currency);
  $('#d_marginPct').textContent = fmtNumber(marginPct) + ' %';
  $('#d_costPerKg').textContent = fmtCurrency(costPerKg, currency) + ' /kg';

  $('#d_laborStaff').textContent = fmtCurrency(laborStaff, currency);
  $('#d_laborSup').textContent   = fmtCurrency(laborSup, currency);
  $('#d_rawCost').textContent    = fmtCurrency(rawCostTot, currency);
  $('#d_packCost').textContent   = fmtCurrency(packCost, currency);
  $('#d_freightCost').textContent= fmtCurrency(freight, currency);
  $('#d_utilities').textContent  = fmtCurrency(utilitiesDay, currency);

  $('#d_housing').textContent    = fmtCurrency(housingDayEur, currency);
  $('#d_equip').textContent      = fmtCurrency(equipDayEur, currency);
  $('#d_admin').textContent      = fmtCurrency(adminDayEur, currency);

  $('#d_maint').textContent      = fmtCurrency(maint, currency);
  $('#d_depr').textContent       = fmtCurrency(depr, currency);
  $('#d_other').textContent      = fmtCurrency(other, currency);

  res2.hidden = false;
}

form2?.addEventListener('submit', (e) => { e.preventDefault(); try { calculateDay(); } catch (err) { alert(err.message || String(err)); }});
form2?.addEventListener('reset', () => { setTimeout(() => { res2.hidden = true; ['#d_yieldPct','#d_revenue','#d_totalCost','#d_profit','#d_marginPct','#d_costPerKg','#d_laborStaff','#d_laborSup','#d_rawCost','#d_packCost','#d_freightCost','#d_utilities','#d_housing','#d_equip','#d_admin','#d_maint','#d_depr','#d_other'].forEach(id=>$(id).textContent='–'); },0); });

// ================= Calculator 3: Factory Network =================
const netForm = $('#netForm');
const netRes  = $('#netResults');

function initMonthAutoNet() {
  const m = $('#netMonth');
  const o = $('#netWorkDays');
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
  m.value = ym;
  const update = () => {
    const [yy, mm] = (m.value || ym).split('-').map(Number);
    o.value = workingDaysInMonth(yy, mm - 1);
  };
  m.addEventListener('change', update);
  update();
}
initMonthAutoNet();

function prodLabor(prefix) {
  const p = n => parseNum(netForm.elements[`${prefix}_${n}`].value);
  const staff = laborCost(p('staffCount'), p('staffDayHours'), p('staffDayRate'), p('staffOtHours'), p('staffOtRate'));
  const sup   = laborCost(p('supCount'),   p('supDayHours'),   p('supDayRate'),   p('supOtHours'),   p('supOtRate'));
  return { staff: staff.total, sup: sup.total, total: staff.total + sup.total };
}
function prodNumbers(prefix) {
  const p = n => parseNum(netForm.elements[`${prefix}_${n}`].value);
  return {
    rawKg:  p('rawKg'), rawCost: p('rawCost'),
    prodKg: p('prodKg'), sell: p('sell'),
    pack:   p('pack'), freight: p('freight'),
    utils:  p('utils')
  };
}

function calculateNetwork() {
  const currency='EUR';
  const [yy, mm] = ($('#netMonth').value).split('-').map(Number);
  const workDays = parseNum($('#netWorkDays').value);
  const rate     = parseNum(netForm.elements.iskToEur.value);

  // Fixed ISK/month -> EUR/day
  const faHousing = (parseNum(netForm.elements.faHousingIsk.value) || 0) * rate / workDays;
  const faEquip   = (parseNum(netForm.elements.faEquipIsk.value)   || 0) * rate / workDays;
  const fbRent    = (parseNum(netForm.elements.fbRentIsk.value)    || 0) * rate / workDays;
  const adminDay  = (parseNum(netForm.elements.adminIsk.value)     || 0) * rate / workDays;

  // Salmon
  const salLab = prodLabor('sal');
  const salNum = prodNumbers('sal');
  const salRawCost = salNum.rawKg * salNum.rawCost;
  const salPack    = salNum.prodKg * salNum.pack;
  const salFreight = salNum.prodKg * salNum.freight;
  const salRevenue = salNum.prodKg * salNum.sell;

  // Whitefish
  const whLab = prodLabor('wh');
  const whNum = prodNumbers('wh');
  const whRawCost = whNum.rawKg * whNum.rawCost;
  const whPack    = whNum.prodKg * whNum.pack;
  const whFreight = whNum.prodKg * whNum.freight;
  const whRevenue = whNum.prodKg * whNum.sell;

  // Smokehouse
  const smLab = prodLabor('sm');
  const smNum = prodNumbers('sm');
  const smRawCost = smNum.rawKg * smNum.rawCost;
  const smPack    = smNum.prodKg * smNum.pack;
  const smFreight = smNum.prodKg * smNum.freight;
  const smRevenue = smNum.prodKg * smNum.sell;

  // Allocation bases (produced kg)
  const kgFA = Math.max(0, salNum.prodKg) + Math.max(0, whNum.prodKg); // Factory A productions
  const kgAll = Math.max(0, salNum.prodKg) + Math.max(0, whNum.prodKg) + Math.max(0, smNum.prodKg);

  const allocFA_sal = kgFA > 0 ? salNum.prodKg / kgFA : 0;
  const allocFA_wh  = kgFA > 0 ? whNum.prodKg  / kgFA : 0;

  const allocAdmin_sal = kgAll > 0 ? salNum.prodKg / kgAll : 0;
  const allocAdmin_wh  = kgAll > 0 ? whNum.prodKg  / kgAll : 0;
  const allocAdmin_sm  = kgAll > 0 ? smNum.prodKg  / kgAll : 0;

  const salFixed = faHousing * allocFA_sal + faEquip * allocFA_sal + adminDay * allocAdmin_sal;
  const whFixed  = faHousing * allocFA_wh  + faEquip * allocFA_wh  + adminDay * allocAdmin_wh;
  const smFixed  = fbRent + (adminDay * allocAdmin_sm);

  // Totals per production
  function tot(lab, num, rawCost, pack, freight, fixed) {
    const rev   = num.prodKg * num.sell;
    const cost  = lab.total + rawCost + pack + freight + (num.utils || 0) + fixed;
    const prof  = rev - cost;
    const mar   = rev > 0 ? (prof / rev) * 100 : 0;
    const cpk   = num.prodKg > 0 ? cost / num.prodKg : 0;
    const yld   = num.rawKg > 0 ? (num.prodKg / num.rawKg) * 100 : 0;
    return { rev, cost, prof, mar, cpk, yld };
  }
  const sal = tot(salLab, salNum, salRawCost, salPack, salFreight, salFixed);
  const wh  = tot(whLab,  whNum,  whRawCost,  whPack,  whFreight,  whFixed);
  const sm  = tot(smLab,  smNum,  smRawCost,  smPack,  smFreight,  smFixed);

  // Network totals
  const totalRev  = sal.rev + wh.rev + sm.rev;
  const totalCost = sal.cost + wh.cost + sm.cost;
  const totalProf = totalRev - totalCost;
  const totalMar  = totalRev > 0 ? (totalProf / totalRev) * 100 : 0;
  const totalKg   = salNum.prodKg + whNum.prodKg + smNum.prodKg;
  const totalCpk  = totalKg > 0 ? totalCost / totalKg : 0;

  // Output
  $('#n_revenue').textContent   = fmtCurrency(totalRev, currency);
  $('#n_totalCost').textContent = fmtCurrency(totalCost, currency);
  $('#n_profit').textContent    = fmtCurrency(totalProf, currency);
  $('#n_marginPct').textContent = fmtNumber(totalMar) + ' %';
  $('#n_costPerKg').textContent = fmtCurrency(totalCpk, currency) + ' /kg';

  $('#n_salmon').textContent    =
    `Yield ${fmtNumber(sal.yld)}%, Rev ${fmtCurrency(sal.rev)}, Cost ${fmtCurrency(sal.cost)}, Profit ${fmtCurrency(sal.prof)}, Margin ${fmtNumber(sal.mar)}%`;
  $('#n_whitefish').textContent =
    `Yield ${fmtNumber(wh.yld)}%, Rev ${fmtCurrency(wh.rev)}, Cost ${fmtCurrency(wh.cost)}, Profit ${fmtCurrency(wh.prof)}, Margin ${fmtNumber(wh.mar)}%`;
  $('#n_smoke').textContent     =
    `Yield ${fmtNumber(sm.yld)}%, Rev ${fmtCurrency(sm.rev)}, Cost ${fmtCurrency(sm.cost)}, Profit ${fmtCurrency(sm.prof)}, Margin ${fmtNumber(sm.mar)}%`;

  $('#n_fa_housing').textContent = fmtCurrency(faHousing, currency);
  $('#n_fa_equip').textContent   = fmtCurrency(faEquip, currency);
  $('#n_fb_rent').textContent    = fmtCurrency(fbRent, currency);
  $('#n_admin').textContent      = fmtCurrency(adminDay, currency);

  netRes.hidden = false;
}

netForm?.addEventListener('submit', (e) => { e.preventDefault(); try { calculateNetwork(); } catch (err) { alert(err.message || String(err)); }});
netForm?.addEventListener('reset', () => {
  setTimeout(() => {
    netRes.hidden = true;
    ['#n_revenue','#n_totalCost','#n_profit','#n_marginPct','#n_costPerKg','#n_salmon','#n_whitefish','#n_smoke','#n_fa_housing','#n_fa_equip','#n_fb_rent','#n_admin'].forEach(id=>$(id).textContent='–');
  }, 0);
});

// -------- Nav (hamburger) --------
const navToggle = $('#navToggle');
const siteNav = $('#siteNav');
navToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});
