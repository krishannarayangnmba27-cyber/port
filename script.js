(() => {
  'use strict';

  // Active Navigation Link Highlighting on Scroll
  function initNavHighlight() {
    const navLinks = document.querySelectorAll('.sub-nav-links a');
    const sections = [];

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          sections.push({ id: href, link, element: target });
        }
      }
    });

    if (sections.length === 0) return;

    function onScroll() {
      const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      let currentSection = sections[0].id;

      for (let i = 0; i < sections.length; i++) {
        const rect = sections[i].element.getBoundingClientRect();
        const top = rect.top + scrollPos;
        if (scrollPos >= top - windowHeight * 0.35) {
          currentSection = sections[i].id;
        }
      }

      navLinks.forEach(link => {
        if (link.getAttribute('href') === currentSection) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Smooth Scroll on Anchor Click
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '#home') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const subNav = document.querySelector('.sub-nav-bar');
          const navOffset = subNav ? subNav.offsetHeight + 30 : 80;
          const targetPos = target.getBoundingClientRect().top + window.pageYOffset - navOffset;
          window.scrollTo({ top: targetPos, behavior: 'smooth' });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initNavHighlight();
      initSmoothScroll();
    });
  } else {
    initNavHighlight();
    initSmoothScroll();
  }
})();
