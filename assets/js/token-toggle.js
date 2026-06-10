// Token toggle — reveals DS layer on the landing hero
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.querySelector('.nav-token-toggle');
  const hero = document.querySelector('.landing-hero');
  if (!btn || !hero) return;

  btn.addEventListener('click', function () {
    const on = hero.classList.toggle('tokens-on');
    btn.classList.toggle('active', on);
    btn.textContent = on ? 'tokens on' : 'tokens';
  });
});

// Accent color cycler — landing token panel row
document.addEventListener('DOMContentLoaded', function () {
  const accentRow = document.querySelector('.token-row--accent');
  if (!accentRow) return;

  const accents = ['#00e5cc', '#00b4ff'];
  let idx = 0;

  // Sync with current theme
  function getCurrentAccent() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim();
  }

  accentRow.addEventListener('click', function () {
    idx = (idx + 1) % accents.length;
    const color = accents[idx];
    document.documentElement.style.setProperty('--color-accent', color);

    const swatch = accentRow.querySelector('.token-swatch');
    const value = accentRow.querySelector('.token-value');
    if (swatch) swatch.style.background = color;
    if (value) value.textContent = color;
  });
});
