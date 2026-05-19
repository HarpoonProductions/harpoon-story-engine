/**
 * Harpoon Story Engine — Runtime
 * runtime.js
 *
 * All scroll-driven and interactive behaviour.
 * Depends on: GSAP + ScrollTrigger (loaded before this file).
 *
 * Sections:
 *  1. Bootstrap
 *  2. Progress bar
 *  3. Navigation
 *  4. Cover entrance
 *  5. Scroll reveal
 *  6. Fullbleed quote
 *  7. Sticky steps
 *  8. Reveal crossfade
 *  9. Parallax
 * 10. Toggle panels
 * 11. Accordion
 * 12. Odometer
 */

(function () {
  'use strict';

  // ── 1. Bootstrap ───────────────────────────────────────────────────
  // Wait for DOM + fonts before initialising ScrollTrigger.
  // Using DOMContentLoaded + a short rAF ensures layout is stable.

  function init() {
    gsap.registerPlugin(ScrollTrigger);

    // Give the browser one paint cycle to lay out before measuring
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setupProgress();
        setupNav();
        setupCoverEntrance();
        setupScrollReveal();
        setupFullbleedQuote();
        setupStickySteps();
        setupRevealCrossfade();
        setupParallax();
        setupTogglePanels();
        setupAccordion();
        setupOdometer();
        ScrollTrigger.refresh();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }


  // ── 2. Progress bar ────────────────────────────────────────────────

  function setupProgress() {
    var bar = document.getElementById('hse-progress');
    if (!bar) return;

    gsap.to(bar, {
      width: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.3,
      }
    });
  }


  // ── 3. Navigation ──────────────────────────────────────────────────

  function setupNav() {
    var nav = document.getElementById('hse-nav');
    if (!nav) return;

    // Solidify nav on scroll
    ScrollTrigger.create({
      start: '80px top',
      onEnter:     function () { nav.classList.add('hse-nav--solid'); },
      onLeaveBack: function () { nav.classList.remove('hse-nav--solid'); },
    });

    // Active nav link tracking
    var navLinks = nav.querySelectorAll('.hse-nav__links a');

    navLinks.forEach(function (link) {
      var id = link.getAttribute('href').replace('#', '');
      var el = document.getElementById(id);
      if (!el) return;

      ScrollTrigger.create({
        trigger: el,
        start: 'top 50%',
        end: 'bottom 50%',
        onEnter:      function () { setActiveNav(navLinks, id); },
        onEnterBack:  function () { setActiveNav(navLinks, id); },
      });
    });
  }

  function setActiveNav(links, activeId) {
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + activeId);
    });
  }


  // ── 4. Cover entrance ──────────────────────────────────────────────

  function setupCoverEntrance() {
    var cover = document.getElementById('hse-cover');
    if (!cover) return;

    var tl = gsap.timeline({ delay: 0.3 });
    tl
      .to('.hse-cover__kicker',    { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.4)
      .to('.hse-cover__headline',  { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.65)
      .to('.hse-cover__body',      { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.85)
      .to('.hse-cover__ctas',      { opacity: 1,        duration: 0.8, ease: 'power2.out' }, 1.1)
      .to('.hse-cover__colophon',  { opacity: 1,        duration: 0.8, ease: 'power2.out' }, 1.2)
      .to('.hse-cover__scroll-cue',{ opacity: 1,        duration: 0.8, ease: 'power2.out' }, 1.5);
  }


  // ── 5. Scroll reveal ───────────────────────────────────────────────
  // Elements with .hse-reveal start at opacity:0 / translateY(24px)
  // and animate in when they enter the viewport.

  function setupScrollReveal() {
    gsap.utils.toArray('.hse-reveal').forEach(function (el) {
      // Skip cover elements — handled by cover entrance timeline
      if (el.closest('#hse-cover')) return;

      gsap.fromTo(el,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          }
        }
      );
    });
  }


  // ── 6. Fullbleed quote ─────────────────────────────────────────────

  function setupFullbleedQuote() {
    gsap.utils.toArray('.hse-section--fullbleed-quote').forEach(function (section) {
      // Slow Ken Burns on the background
      var bg = section.querySelector('.hse-fbq__bg');
      if (bg) {
        gsap.to(bg, {
          scale: 1.06,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          }
        });
      }

      // Quote entrance
      ScrollTrigger.create({
        trigger: section,
        start: 'top 75%',
        once: true,
        onEnter: function () { section.classList.add('is-visible'); },
      });
    });
  }


  // ── 7. Sticky steps ────────────────────────────────────────────────

  function setupStickySteps() {
    gsap.utils.toArray('.hse-section--sticky-steps').forEach(function (section) {
      var steps = section.querySelectorAll('.hse-ss__step');
      var imgs  = section.querySelectorAll('.hse-ss__visual-img');
      var pips  = section.querySelectorAll('.hse-ss__progress-pip');

      function activateStep(index) {
        steps.forEach(function (s, i) { s.classList.toggle('is-active', i === index); });
        imgs.forEach(function (img, i) { img.classList.toggle('is-active', i === index); });
        pips.forEach(function (pip, i) { pip.classList.toggle('is-active', i === index); });
      }

      // Activate first step immediately
      activateStep(0);

      steps.forEach(function (step, i) {
        ScrollTrigger.create({
          trigger: step,
          start: 'top 55%',
          end: 'bottom 55%',
          onEnter:     function () { activateStep(i); },
          onEnterBack: function () { activateStep(i); },
        });
      });
    });
  }


  // ── 8. Reveal crossfade ────────────────────────────────────────────

  function setupRevealCrossfade() {
    gsap.utils.toArray('.hse-section--reveal-crossfade').forEach(function (section) {
      var phases = section.querySelectorAll('.hse-cf__phase');

      phases.forEach(function (phase, i) {
        ScrollTrigger.create({
          trigger: phase,
          start: 'top 65%',
          once: true,
          onEnter: function () {
            phase.classList.add('is-visible');
            if (i === 1) section.classList.add('is-revealed');
          },
        });
      });
    });
  }


  // ── 9. Parallax ────────────────────────────────────────────────────

  function setupParallax() {
    gsap.utils.toArray('.hse-parallax__img').forEach(function (img) {
      var speed = parseFloat(img.dataset.parallaxSpeed || '0.4');
      gsap.to(img, {
        yPercent: 20 * speed * 10,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.hse-parallax__window'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });
    });
  }


  // ── 10. Toggle panels ──────────────────────────────────────────────

  function setupTogglePanels() {
    document.querySelectorAll('.hse-toggle').forEach(function (toggle) {
      var buttons = toggle.querySelectorAll('.hse-toggle__btn');
      var panels  = toggle.querySelectorAll('.hse-toggle__panel');

      buttons.forEach(function (btn, i) {
        btn.addEventListener('click', function () {
          // Deactivate all
          buttons.forEach(function (b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-selected', 'false');
          });
          panels.forEach(function (p) {
            p.classList.remove('is-active');
            p.hidden = true;
          });

          // Activate chosen
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');

          var panelId = 'panel-' + btn.dataset.panel;
          var panel   = document.getElementById(panelId);
          if (panel) {
            panel.classList.add('is-active');
            panel.hidden = false;
          }
        });
      });

      // Initialise: show first panel
      if (panels.length > 0) {
        panels[0].hidden = false;
        panels[0].classList.add('is-active');
        if (buttons[0]) {
          buttons[0].classList.add('is-active');
          buttons[0].setAttribute('aria-selected', 'true');
        }
        // Hide others
        for (var j = 1; j < panels.length; j++) {
          panels[j].hidden = true;
          panels[j].classList.remove('is-active');
        }
      }
    });
  }


  // ── 11. Accordion ──────────────────────────────────────────────────

  function setupAccordion() {
    document.querySelectorAll('.hse-accordion').forEach(function (accordion) {
      var items = accordion.querySelectorAll('.hse-accordion__item');

      items.forEach(function (item) {
        var trigger = item.querySelector('.hse-accordion__trigger');
        var body    = item.querySelector('.hse-accordion__body');
        if (!trigger || !body) return;

        trigger.addEventListener('click', function () {
          var isOpen = item.classList.contains('is-open');

          if (isOpen) {
            // Close this item
            item.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            body.hidden = true;
          } else {
            // Close all siblings first
            items.forEach(function (sibling) {
              sibling.classList.remove('is-open');
              var sib_trigger = sibling.querySelector('.hse-accordion__trigger');
              var sib_body    = sibling.querySelector('.hse-accordion__body');
              if (sib_trigger) sib_trigger.setAttribute('aria-expanded', 'false');
              if (sib_body)    sib_body.hidden = true;
            });

            // Open this item
            item.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            body.hidden = false;

            // Smooth scroll to bring it into view
            setTimeout(function () {
              trigger.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
          }

          // Refresh ScrollTrigger so layout changes don't break scroll positions
          ScrollTrigger.refresh();
        });
      });

      // Initialise: open first item
      if (items.length > 0) {
        var first        = items[0];
        var firstTrigger = first.querySelector('.hse-accordion__trigger');
        var firstBody    = first.querySelector('.hse-accordion__body');
        first.classList.add('is-open');
        if (firstTrigger) firstTrigger.setAttribute('aria-expanded', 'true');
        if (firstBody)    firstBody.hidden = false;

        // Close rest
        for (var k = 1; k < items.length; k++) {
          var t = items[k].querySelector('.hse-accordion__trigger');
          var b = items[k].querySelector('.hse-accordion__body');
          items[k].classList.remove('is-open');
          if (t) t.setAttribute('aria-expanded', 'false');
          if (b) b.hidden = true;
        }
      }
    });
  }


  // ── 12. Odometer ───────────────────────────────────────────────────
  // Stat blocks with data-odometer="true" count up from 0 on scroll entry.
  // Handles integers, floats, percentages and values with prefixes (£, +).

  function setupOdometer() {
    document.querySelectorAll('.hse-stat[data-odometer="true"]').forEach(function (stat) {
      var valueEl = stat.querySelector('.hse-stat__value');
      if (!valueEl) return;

      var raw     = valueEl.textContent.trim();
      var prefix  = '';
      var suffix  = '';
      var number  = '';

      // Extract prefix (£, +, etc.)
      var prefixMatch = raw.match(/^([^0-9]*)/);
      if (prefixMatch) prefix = prefixMatch[1];

      // Extract suffix (%, m, k, etc.)
      var suffixMatch = raw.match(/([^0-9,\.]+)$/);
      if (suffixMatch && suffixMatch[1] !== prefix) suffix = suffixMatch[1];

      // Extract numeric portion (strip commas)
      number = raw.replace(prefix, '').replace(suffix, '').replace(/,/g, '');
      var isFloat   = number.indexOf('.') !== -1;
      var decimals  = isFloat ? (number.split('.')[1] || '').length : 0;
      var target    = parseFloat(number);

      if (isNaN(target)) return;

      var hasCommas = raw.indexOf(',') !== -1;

      function formatNumber(val) {
        var rounded = isFloat
          ? val.toFixed(decimals)
          : Math.round(val).toString();

        if (hasCommas) {
          var parts = rounded.toString().split('.');
          parts[0]  = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          rounded   = parts.join('.');
        }
        return prefix + rounded + suffix;
      }

      // Start at 0
      valueEl.textContent = formatNumber(0);

      ScrollTrigger.create({
        trigger: stat,
        start: 'top 85%',
        once: true,
        onEnter: function () {
          gsap.to({ val: 0 }, {
            val: target,
            duration: 2,
            ease: 'power2.out',
            onUpdate: function () {
              valueEl.textContent = formatNumber(this.targets()[0].val);
            }
          });
        }
      });
    });
  }

})();
