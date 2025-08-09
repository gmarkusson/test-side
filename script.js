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
