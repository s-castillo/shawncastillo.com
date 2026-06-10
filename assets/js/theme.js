// Run before body renders — prevents flash of wrong theme
(function () {
  const saved = localStorage.getItem('sc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function initThemeToggle() {
  const toggle = document.querySelector('.mode-toggle');
  const label = document.querySelector('.mode-bar__label');

  function updateLabel() {
    const current = document.documentElement.getAttribute('data-theme');
    if (label) label.textContent = current === 'dark' ? 'Dark mode' : 'Light mode';
  }

  updateLabel();

  if (toggle) {
    toggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('sc-theme', next);
      updateLabel();
    });
  }
}

document.addEventListener('DOMContentLoaded', initThemeToggle);
