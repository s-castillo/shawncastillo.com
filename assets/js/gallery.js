(function () {
  'use strict';

  // ── Filter ──────────────────────────────────────────────────────────────
  const filterTags  = document.querySelectorAll('.filter-tag');
  const gallery     = document.querySelector('.photo-gallery');
  const allItems    = gallery ? Array.from(gallery.querySelectorAll('.photo-item')) : [];
  const editorials  = gallery ? Array.from(gallery.querySelectorAll('.photo-editorial')) : [];

  function applyFilter(cat) {
    allItems.forEach(item => {
      const match = cat === 'all' || item.dataset.category === cat;
      item.style.display = match ? 'block' : 'none';
    });
    editorials.forEach(card => {
      // Only show editorial cards when a specific category is active
      const match = cat !== 'all' && card.dataset.category === cat;
      card.style.display = match ? 'block' : 'none';
    });
  }

  filterTags.forEach(tag => {
    tag.addEventListener('click', () => {
      filterTags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      applyFilter(tag.dataset.category);
      currentIndex = -1;
    });
  });

  // Show all + show editorial cards on load
  applyFilter('all');

  // ── Shuffle ──────────────────────────────────────────────────────────────
  const shuffleBtn = document.getElementById('gallery-shuffle');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      shuffleBtn.style.animation = 'none';
      void shuffleBtn.offsetWidth;
      shuffleBtn.style.animation = 'shuffle-spin 0.4s var(--ease-out) forwards';

      const visibleItems = allItems.filter(i => i.style.display !== 'none');
      for (let i = visibleItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const parent = visibleItems[i].parentNode;
        const sibling = visibleItems[i].nextSibling;
        parent.insertBefore(visibleItems[i], visibleItems[j]);
        parent.insertBefore(visibleItems[j], sibling);
      }
    });
  }

  // ── Lightbox ─────────────────────────────────────────────────────────────
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightbox-img');
  const lbLocation  = document.getElementById('lightbox-location');
  const lbDesc      = document.getElementById('lightbox-desc');
  const lbClose     = document.getElementById('lightbox-close');
  const lbBackdrop  = document.getElementById('lightbox-backdrop');
  const lbPrev      = document.getElementById('lightbox-prev');
  const lbNext      = document.getElementById('lightbox-next');

  let currentIndex = -1;

  function visibleItems() {
    return allItems.filter(i => i.style.display !== 'none');
  }

  function openLightbox(index) {
    const items = visibleItems();
    if (!items.length) return;
    currentIndex = ((index % items.length) + items.length) % items.length;
    const item = items[currentIndex];
    const img = item.querySelector('img');
    const loc = item.querySelector('.photo-location');
    const desc = item.querySelector('.photo-desc');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbLocation.textContent = loc ? loc.textContent : '';
    lbDesc.textContent = desc ? desc.textContent : '';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lbPrev.style.display = items.length > 1 ? '' : 'none';
    lbNext.style.display = items.length > 1 ? '' : 'none';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lbImg.src = '';
    currentIndex = -1;
  }

  allItems.forEach((item, _) => {
    item.addEventListener('click', () => {
      const items = visibleItems();
      const idx = items.indexOf(item);
      if (idx !== -1) openLightbox(idx);
    });
  });

  if (lbClose)    lbClose.addEventListener('click', closeLightbox);
  if (lbBackdrop) lbBackdrop.addEventListener('click', closeLightbox);
  if (lbPrev)     lbPrev.addEventListener('click', () => openLightbox(currentIndex - 1));
  if (lbNext)     lbNext.addEventListener('click', () => openLightbox(currentIndex + 1));

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   openLightbox(currentIndex - 1);
    if (e.key === 'ArrowRight')  openLightbox(currentIndex + 1);
  });

  // ── Mobile nav ───────────────────────────────────────────────────────────
  const hamburger = document.querySelector('.nav-hamburger');
  const drawer    = document.querySelector('.nav-drawer');
  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => drawer.classList.toggle('open'));
  }

})();
