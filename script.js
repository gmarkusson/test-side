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
<section id="kpis" class="kpis">
  <h2>Key Numbers</h2>
  <form id="kpiForm" class="kpi-form" autocomplete="off">
    <div class="grid">
      <label>Volume (kg)
        <input type="text" inputmode="decimal" name="volumeKg" required placeholder="e.g. 1200">
      </label>
      <label>Sell price / kg
        <input type="text" inputmode="decimal" name="sellPrice" required placeholder="e.g. 14,50">
      </label>
      <label>Raw cost / kg
        <input type="text" inputmode="decimal" name="rawCost" required placeholder="e.g. 9,20">
      </label>
      <label>Processing + pack / kg
        <input type="text" inputmode="decimal" name="procCost" required placeholder="e.g. 1,30">
      </label>
      <label>Freight / kg
        <input type="text" inputmode="decimal" name="freight" value="0" required placeholder="0">
      </label>
      <label>Yield loss (%)
        <input type="text" inputmode="decimal" name="wastePct" value="0" required placeholder="0 = no loss">
      </label>
    </div>

    <details class="webhook-details">
      <summary>Optional: post results to a webhook</summary>
      <label>Webhook URL (POST)
        <input type="url" name="webhookUrl" placeholder="https://your-endpoint.example/receive">
      </label>
    </details>

    <div class="cta-row">
      <button class="btn primary" type="submit">Calculate</button>
      <button class="btn" type="reset">Reset</button>
    </div>
  </form>

  <div id="kpiResults" class="kpi-results" hidden>
    <h3>Results</h3>
    <ul class="cards">
      <li class="card"><h4>Net saleable kg</h4><p id="r_netKg">–</p></li>
      <li class="card"><h4>Revenue</h4><p id="r_revenue">–</p></li>
      <li class="card"><h4>Total cost</h4><p id="r_totalCost">–</p></li>
      <li class="card"><h4>Profit</h4><p id="r_profit">–</p></li>
      <li class="card"><h4>Gross margin %</h4><p id="r_marginPct">–</p></li>
      <li class="card"><h4>Profit / kg</h4><p id="r_profitPerKg">–</p></li>
    </ul>
    <p id="postStatus" class="hint"></p>
  </div>
</section>
