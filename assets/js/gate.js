// Access gate system
document.addEventListener('DOMContentLoaded', function () {
  const gate = document.querySelector('.gate');
  if (!gate) return;

  const correctCode = gate.dataset.code;
  const stage1 = gate.querySelector('.gate-stage-1');
  const stage2 = gate.querySelector('.gate-stage-2');
  const requestBtn = gate.querySelector('.gate__cta');
  const backBtn = gate.querySelector('.gate__back');
  const haveCodeBtn = gate.querySelector('.gate__have-code');
  const codeInput = gate.querySelector('.gate__input');
  const unlockBtn = gate.querySelector('.gate__unlock-btn');
  const errorMsg = gate.querySelector('.gate__error');
  const inputRow = gate.querySelector('.gate__input-row');
  const codeSection = gate.querySelector('.gate__code-section');
  const content = document.querySelector('.gate-content');

  // Inject email input into stage 1 before the request button
  if (requestBtn && stage1) {
    const emailRow = document.createElement('div');
    emailRow.className = 'gate__email-row';
    emailRow.innerHTML = `
      <input class="gate__input gate__email-input" type="email" placeholder="Your email address" autocomplete="email">
      <div class="gate__email-error">Please enter a valid email address.</div>
    `;
    stage1.insertBefore(emailRow, requestBtn);
  }

  if (requestBtn && stage2) {
    requestBtn.addEventListener('click', function () {
      const emailInput = stage1.querySelector('.gate__email-input');
      const emailError = stage1.querySelector('.gate__email-error');
      const email = emailInput ? emailInput.value.trim() : '';

      // Validate
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailInput) emailInput.classList.add('error');
        if (emailError) emailError.classList.add('visible');
        return;
      }

      if (emailInput) emailInput.classList.remove('error');
      if (emailError) emailError.classList.remove('visible');

      const projectName = document.querySelector('h1')
        ? document.querySelector('h1').textContent
        : document.title;

      fetch('https://formspree.io/f/xlgkbqpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, project: projectName, message: 'Access requested' })
      });

      stage1.style.display = 'none';
      stage2.style.display = 'flex';
    });
  }

  if (backBtn && stage1) {
    backBtn.addEventListener('click', function () {
      stage2.style.display = 'none';
      stage1.style.display = 'flex';
    });
  }

  if (haveCodeBtn && codeSection) {
    haveCodeBtn.addEventListener('click', function () {
      codeSection.style.display = 'flex';
      haveCodeBtn.style.display = 'none';
    });
  }

  if (unlockBtn && codeInput) {
    function attemptUnlock() {
      const entered = codeInput.value.trim().toUpperCase();
      if (entered === correctCode.toUpperCase()) {
        gate.style.display = 'none';
        if (content) content.style.display = 'block';

        // Remove lock icon from active tab
        const activeTab = document.querySelector('.tab.active .tab-lock');
        if (activeTab) activeTab.style.display = 'none';
      } else {
        codeInput.classList.add('error');
        if (errorMsg) {
          errorMsg.textContent = 'Incorrect code. Try again.';
          errorMsg.classList.add('visible');
        }
      }
    }

    unlockBtn.addEventListener('click', attemptUnlock);
    codeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attemptUnlock();
      codeInput.classList.remove('error');
      if (errorMsg) errorMsg.classList.remove('visible');
    });
  }
});

// Lightbox
document.addEventListener('DOMContentLoaded', function () {
  var lightbox     = document.getElementById('lightbox');
  if (!lightbox) return;

  var lbImg        = document.getElementById('lightbox-img');
  var lbLocation   = document.getElementById('lightbox-location');
  var lbDesc       = document.getElementById('lightbox-desc');
  var lbClose      = document.getElementById('lightbox-close');
  var lbBackdrop   = document.getElementById('lightbox-backdrop');
  var lbPrev       = document.getElementById('lightbox-prev');
  var lbNext       = document.getElementById('lightbox-next');

  var currentIndex = 0;
  var visibleItems = [];

  function getVisibleItems() {
    return Array.from(document.querySelectorAll('.photo-item')).filter(function (el) {
      return el.style.display !== 'none';
    });
  }

  function openLightbox(index) {
    visibleItems = getVisibleItems();
    currentIndex = index;
    loadItem(currentIndex);
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function loadItem(index) {
    var item = visibleItems[index];
    if (!item) return;
    var img      = item.querySelector('img');
    var location = item.querySelector('.photo-location');
    var desc     = item.querySelector('.photo-desc');
    lbImg.src        = img ? img.src : '';
    lbImg.alt        = img ? img.alt : '';
    lbLocation.textContent = location ? location.textContent : '';
    lbDesc.textContent     = desc     ? desc.textContent     : '';
    lbPrev.style.opacity   = index === 0 ? '0.25' : '1';
    lbNext.style.opacity   = index === visibleItems.length - 1 ? '0.25' : '1';
  }

  // Open on photo click
  document.querySelector('.photo-gallery') && document.querySelector('.photo-gallery').addEventListener('click', function (e) {
    var item = e.target.closest('.photo-item');
    if (!item) return;
    visibleItems = getVisibleItems();
    var index = visibleItems.indexOf(item);
    if (index !== -1) openLightbox(index);
  });

  lbClose.addEventListener('click', closeLightbox);
  lbBackdrop.addEventListener('click', closeLightbox);

  // Close when clicking outside the image (on the stage padding area)
  lightbox.addEventListener('click', function (e) {
    if (!e.target.closest('.lightbox__img-wrap') &&
        !e.target.closest('.lightbox__nav') &&
        !e.target.closest('.lightbox__close')) {
      closeLightbox();
    }
  });

  lbPrev.addEventListener('click', function () {
    if (currentIndex > 0) { currentIndex--; loadItem(currentIndex); }
  });

  lbNext.addEventListener('click', function () {
    if (currentIndex < visibleItems.length - 1) { currentIndex++; loadItem(currentIndex); }
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft'  && currentIndex > 0)                        { currentIndex--; loadItem(currentIndex); }
    if (e.key === 'ArrowRight' && currentIndex < visibleItems.length - 1)  { currentIndex++; loadItem(currentIndex); }
  });
});

// Tab system
document.addEventListener('DOMContentLoaded', function () {
  const tabs = document.querySelectorAll('.tab');
  if (!tabs.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const target = tab.dataset.tab;

      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(function (panel) {
        panel.classList.toggle('active', panel.dataset.panel === target);
      });
    });
  });
});

// Mobile nav hamburger
document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.querySelector('.nav-hamburger');
  const drawer = document.querySelector('.nav-drawer');
  if (!hamburger || !drawer) return;

  hamburger.addEventListener('click', function () {
    drawer.classList.toggle('open');
  });
});

// Gallery size pattern — applied to visible photos only
var GRID_PATTERN = [
  'normal', 'tall', 'normal', 'wide',
  'normal', 'normal', 'large', 'normal',
  'wide', 'normal', 'tall', 'normal',
  'normal', 'wide', 'normal', 'normal',
  'tall', 'normal', 'normal', 'wide'
];

// Weighted pool for random pattern generation
var PATTERN_POOL = [
  'wide', 'wide', 'wide', 'wide',
  'tall', 'tall', 'tall',
  'large',
  'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal'
];

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function randomizePattern() {
  // Build a 20-item pattern from shuffled pool, always start with normal to avoid layout jump
  var shuffled = shuffleArray(PATTERN_POOL);
  GRID_PATTERN = ['normal'].concat(shuffled).slice(0, 20);
}

function applyGridPattern() {
  var visible = Array.from(document.querySelectorAll('.photo-item')).filter(function(el) {
    return el.style.display !== 'none';
  });
  visible.forEach(function(item, i) {
    item.classList.remove('photo-item--wide', 'photo-item--tall', 'photo-item--large');
    var type = GRID_PATTERN[i % GRID_PATTERN.length];
    if (type === 'wide')   item.classList.add('photo-item--wide');
    if (type === 'tall')   item.classList.add('photo-item--tall');
    if (type === 'large')  item.classList.add('photo-item--large');
  });
}

// Photography filter
document.addEventListener('DOMContentLoaded', function () {
  const filterTags = document.querySelectorAll('.filter-tag');
  if (!filterTags.length) return;

  const photos = document.querySelectorAll('.photo-item');
  const editorials = document.querySelectorAll('.photo-editorial');

  // Apply pattern on initial load
  applyGridPattern();

  filterTags.forEach(function (tag) {
    tag.addEventListener('click', function () {
      filterTags.forEach(function (t) { t.classList.remove('active'); });
      tag.classList.add('active');

      const category = tag.dataset.category;

      if (category === 'all') {
        photos.forEach(function (item) { item.style.display = ''; });
        editorials.forEach(function (card) { card.style.display = 'none'; });
      } else {
        photos.forEach(function (item) {
          item.style.display = item.dataset.category === category ? '' : 'none';
        });
        editorials.forEach(function (card) {
          card.style.display = card.dataset.category === category ? '' : 'none';
        });
      }

      // Re-apply pattern to newly visible set
      applyGridPattern();
    });
  });

  // Shuffle button
  var shuffleBtn = document.getElementById('gallery-shuffle');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', function () {
      randomizePattern();
      applyGridPattern();
      // Spin animation
      shuffleBtn.classList.remove('spinning');
      void shuffleBtn.offsetWidth; // force reflow
      shuffleBtn.classList.add('spinning');
      shuffleBtn.addEventListener('animationend', function () {
        shuffleBtn.classList.remove('spinning');
      }, { once: true });
    });
  }
});
