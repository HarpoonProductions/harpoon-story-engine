/**
 * Harpoon Story Engine — Runtime
 * runtime.js
 *
 * All scroll-driven and interactive behaviour.
 * Depends on: GSAP + ScrollTrigger (loaded before this file).
 *
 * WCAG 2.1 AA compliance:
 *  - prefers-reduced-motion respected throughout
 *  - Keyboard navigation for accordion and toggle panels
 *  - aria-expanded, aria-controls, aria-selected, aria-live
 *  - Cover video pause control (WCAG 2.2.2)
 *  - Focus management on interactive components
 *  - Odometer announces final value to screen readers
 *  - aria-current on active nav links
 */

(function () {
  "use strict";

  // ── 1. Bootstrap + motion preference ──────────────────────────────

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function init() {
    gsap.registerPlugin(ScrollTrigger);

    // If reduced motion: make all .hse-reveal elements immediately visible
    if (prefersReducedMotion) {
      document.querySelectorAll(".hse-reveal").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setupProgress();
        setupNav();
        setupCoverEntrance();

        if (!prefersReducedMotion) {
          setupScrollReveal();
          setupFullbleedQuote();
          setupStickySteps();
          setupRevealCrossfade();
          setupParallax();
        } else {
          setupFullbleedQuoteA11y();
          setupStickyStepsA11y();
          setupRevealCrossfadeA11y();
        }

        setupTogglePanels();
        setupAccordion();
        setupOdometer();
        ScrollTrigger.refresh();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── 2. Progress bar ────────────────────────────────────────────────

  function setupProgress() {
    var bar = document.getElementById("hse-progress");
    if (!bar) return;

    bar.setAttribute("aria-hidden", "true");
    bar.setAttribute("role", "presentation");

    if (prefersReducedMotion) return;

    gsap.to(bar, {
      width: "100%",
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      },
    });
  }

  // ── 3. Navigation ──────────────────────────────────────────────────

  function setupNav() {
    var nav = document.getElementById("hse-nav");
    if (!nav) return;

    ScrollTrigger.create({
      start: "80px top",
      onEnter: function () {
        nav.classList.add("hse-nav--solid");
      },
      onLeaveBack: function () {
        nav.classList.remove("hse-nav--solid");
      },
    });

    var navLinks = nav.querySelectorAll(".hse-nav__links a");

    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      var el = document.getElementById(id);
      if (!el) return;

      ScrollTrigger.create({
        trigger: el,
        start: "top 50%",
        end: "bottom 50%",
        onEnter: function () {
          setActiveNav(navLinks, id);
        },
        onEnterBack: function () {
          setActiveNav(navLinks, id);
        },
      });
    });
  }

  function setActiveNav(links, activeId) {
    links.forEach(function (a) {
      var isActive = a.getAttribute("href") === "#" + activeId;
      a.classList.toggle("is-active", isActive);
      if (isActive) {
        a.setAttribute("aria-current", "location");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  // ── 4. Cover entrance + video pause ───────────────────────────────

  function setupCoverEntrance() {
    var cover = document.getElementById("hse-cover");
    if (!cover) return;

    // WCAG 2.2.2: Auto-playing video must have a pause mechanism
    var video = cover.querySelector("video");
    if (video) {
      var pauseBtn = document.createElement("button");
      pauseBtn.className = "hse-cover__pause-btn";
      pauseBtn.setAttribute("type", "button");
      pauseBtn.setAttribute("aria-label", "Pause background video");
      pauseBtn.innerHTML = '<span aria-hidden="true">⏸</span>';

      pauseBtn.addEventListener("click", function () {
        if (video.paused) {
          video.play();
          pauseBtn.setAttribute("aria-label", "Pause background video");
          pauseBtn.innerHTML = '<span aria-hidden="true">⏸</span>';
        } else {
          video.pause();
          pauseBtn.setAttribute("aria-label", "Play background video");
          pauseBtn.innerHTML = '<span aria-hidden="true">▶</span>';
        }
      });

      if (prefersReducedMotion) {
        video.pause();
        pauseBtn.setAttribute("aria-label", "Play background video");
        pauseBtn.innerHTML = '<span aria-hidden="true">▶</span>';
      }

      cover.appendChild(pauseBtn);
    }

    if (prefersReducedMotion) {
      [
        ".hse-cover__kicker",
        ".hse-cover__headline",
        ".hse-cover__body",
        ".hse-cover__ctas",
        ".hse-cover__colophon",
        ".hse-cover__scroll-cue",
      ].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      });
      return;
    }

    var tl = gsap.timeline({ delay: 0.3 });
    tl.to(
      ".hse-cover__kicker",
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
      0.4,
    )
      .to(
        ".hse-cover__headline",
        { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" },
        0.65,
      )
      .to(
        ".hse-cover__body",
        { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" },
        0.85,
      )
      .to(
        ".hse-cover__ctas",
        { opacity: 1, duration: 0.8, ease: "power2.out" },
        1.1,
      )
      .to(
        ".hse-cover__colophon",
        { opacity: 1, duration: 0.8, ease: "power2.out" },
        1.2,
      )
      .to(
        ".hse-cover__scroll-cue",
        { opacity: 1, duration: 0.8, ease: "power2.out" },
        1.5,
      );
  }

  // ── 5. Scroll reveal ───────────────────────────────────────────────

  function setupScrollReveal() {
    gsap.utils.toArray(".hse-reveal").forEach(function (el) {
      if (el.closest("#hse-cover")) return;
      gsap.fromTo(
        el,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        },
      );
    });
  }

  // ── 6. Fullbleed quote ─────────────────────────────────────────────

  function setupFullbleedQuote() {
    gsap.utils
      .toArray(".hse-section--fullbleed-quote")
      .forEach(function (section) {
        var bg = section.querySelector(".hse-fbq__bg");
        if (bg) {
          gsap.to(bg, {
            scale: 1.06,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          });
        }
        ScrollTrigger.create({
          trigger: section,
          start: "top 75%",
          once: true,
          onEnter: function () {
            section.classList.add("is-visible");
          },
        });
      });
  }

  function setupFullbleedQuoteA11y() {
    document
      .querySelectorAll(".hse-section--fullbleed-quote")
      .forEach(function (s) {
        s.classList.add("is-visible");
      });
  }

  // ── 7. Sticky steps ────────────────────────────────────────────────

  function setupStickySteps() {
    gsap.utils
      .toArray(".hse-section--sticky-steps")
      .forEach(function (section) {
        var steps = section.querySelectorAll(".hse-ss__step");
        var imgs = section.querySelectorAll(".hse-ss__visual-img");
        var pips = section.querySelectorAll(".hse-ss__progress-pip");

        function activateStep(index) {
          steps.forEach(function (s, i) {
            s.classList.toggle("is-active", i === index);
          });
          imgs.forEach(function (img, i) {
            img.classList.toggle("is-active", i === index);
          });
          pips.forEach(function (pip, i) {
            pip.classList.toggle("is-active", i === index);
          });
        }

        activateStep(0);

        steps.forEach(function (step, i) {
          ScrollTrigger.create({
            trigger: step,
            start: "top 55%",
            end: "bottom 55%",
            onEnter: function () {
              activateStep(i);
            },
            onEnterBack: function () {
              activateStep(i);
            },
          });
        });
      });
  }

  function setupStickyStepsA11y() {
    document.querySelectorAll(".hse-ss__step").forEach(function (s) {
      s.classList.add("is-active");
    });
    var firstImgs = document.querySelectorAll(
      ".hse-ss__visual-img:first-child",
    );
    firstImgs.forEach(function (img) {
      img.classList.add("is-active");
    });
  }

  // ── 8. Reveal crossfade ────────────────────────────────────────────
  // ── 8. Reveal crossfade ────────────────────────────────────────────
  // Supports N images — each phase triggers a crossfade to its image.
  // Uses opacity transitions between absolutely-positioned image layers.

  function setupRevealCrossfade() {
    gsap.utils
      .toArray(".hse-section--reveal-crossfade")
      .forEach(function (section) {
        var phases = section.querySelectorAll(".hse-cf__phase");
        var images = section.querySelectorAll(".hse-cf__image");

        // Transition to a specific image index
        function showImage(index) {
          images.forEach(function (img, i) {
            if (i === index) {
              img.classList.add("is-active");
            } else {
              img.classList.remove("is-active");
            }
          });
          // Keep legacy is-revealed class for CSS compatibility
          if (index > 0) {
            section.classList.add("is-revealed");
          } else {
            section.classList.remove("is-revealed");
          }
        }

        phases.forEach(function (phase, i) {
          var imageIndex = parseInt(phase.dataset.image || i, 10);

          ScrollTrigger.create({
            trigger: phase,
            start: "top 65%",
            once: true,
            onEnter: function () {
              phase.classList.add("is-visible");
              showImage(imageIndex);
            },
          });
        });
      });
  }

  function setupRevealCrossfadeA11y() {
    document.querySelectorAll(".hse-cf__phase").forEach(function (p) {
      p.classList.add("is-visible");
    });
    // Show the last image for reduced motion users
    document
      .querySelectorAll(".hse-section--reveal-crossfade")
      .forEach(function (s) {
        s.classList.add("is-revealed");
        var images = s.querySelectorAll(".hse-cf__image");
        images.forEach(function (img) {
          img.classList.remove("is-active");
        });
        if (images.length > 0) {
          images[images.length - 1].classList.add("is-active");
        }
      });
  }
  // ── 9. Parallax ────────────────────────────────────────────────────

  function setupParallax() {
    gsap.utils.toArray(".hse-parallax__img").forEach(function (img) {
      var speed = parseFloat(img.dataset.parallaxSpeed || "0.4");
      gsap.to(img, {
        yPercent: 20 * speed * 10,
        ease: "none",
        scrollTrigger: {
          trigger: img.closest(".hse-parallax__window"),
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    });
  }

  // ── 10. Toggle panels ──────────────────────────────────────────────
  // WCAG 4.1.2: tablist / tab / tabpanel pattern with full keyboard support.
  // Arrow keys navigate between tabs; Enter/Space activate.

  function setupTogglePanels() {
    document.querySelectorAll(".hse-toggle").forEach(function (toggle) {
      var buttons = toggle.querySelectorAll(".hse-toggle__btn");
      var panels = toggle.querySelectorAll(".hse-toggle__panel");

      toggle.setAttribute("role", "tablist");

      buttons.forEach(function (btn, i) {
        btn.setAttribute("role", "tab");
        btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
        var panelId = "panel-" + btn.dataset.panel;
        btn.setAttribute("aria-controls", panelId);
      });

      panels.forEach(function (panel) {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("tabindex", "0");
      });

      function activateTab(index) {
        buttons.forEach(function (b, i) {
          var active = i === index;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", active ? "true" : "false");
          b.setAttribute("tabindex", active ? "0" : "-1");
        });
        panels.forEach(function (p, i) {
          var active = i === index;
          p.classList.toggle("is-active", active);
          p.hidden = !active;
        });
      }

      buttons.forEach(function (btn, i) {
        btn.addEventListener("click", function () {
          activateTab(i);
        });

        btn.addEventListener("keydown", function (e) {
          var count = buttons.length;
          var next = -1;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            next = (i + 1) % count;
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            next = (i - 1 + count) % count;
          } else if (e.key === "Home") {
            next = 0;
          } else if (e.key === "End") {
            next = count - 1;
          }
          if (next >= 0) {
            e.preventDefault();
            activateTab(next);
            buttons[next].focus();
          }
        });
      });

      activateTab(0);
    });
  }

  // ── 11. Accordion ──────────────────────────────────────────────────
  // WCAG 4.1.2: Each trigger is a <button>.
  // Arrow keys navigate between triggers (APG accordion pattern).

  function setupAccordion() {
    document.querySelectorAll(".hse-accordion").forEach(function (accordion) {
      var items = accordion.querySelectorAll(".hse-accordion__item");
      var triggers = accordion.querySelectorAll(".hse-accordion__trigger");

      items.forEach(function (item, idx) {
        var trigger = item.querySelector(".hse-accordion__trigger");
        var body = item.querySelector(".hse-accordion__body");
        if (!trigger || !body) return;

        var bodyId = "hse-acc-body-" + Math.random().toString(36).slice(2, 7);
        body.id = bodyId;
        trigger.setAttribute("aria-controls", bodyId);

        trigger.addEventListener("click", function () {
          var isOpen = item.classList.contains("is-open");

          if (isOpen) {
            item.classList.remove("is-open");
            trigger.setAttribute("aria-expanded", "false");
            body.hidden = true;
          } else {
            items.forEach(function (sib) {
              sib.classList.remove("is-open");
              var st = sib.querySelector(".hse-accordion__trigger");
              var sb = sib.querySelector(".hse-accordion__body");
              if (st) st.setAttribute("aria-expanded", "false");
              if (sb) sb.hidden = true;
            });
            item.classList.add("is-open");
            trigger.setAttribute("aria-expanded", "true");
            body.hidden = false;
            setTimeout(function () {
              trigger.scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "nearest",
              });
            }, 50);
          }

          ScrollTrigger.refresh();
        });

        trigger.addEventListener("keydown", function (e) {
          var count = triggers.length;
          var next = -1;
          if (e.key === "ArrowDown") {
            next = (idx + 1) % count;
          } else if (e.key === "ArrowUp") {
            next = (idx - 1 + count) % count;
          } else if (e.key === "Home") {
            next = 0;
          } else if (e.key === "End") {
            next = count - 1;
          }
          if (next >= 0) {
            e.preventDefault();
            triggers[next].focus();
          }
        });
      });

      // Initialise: open first item
      if (items.length > 0) {
        var ft = items[0].querySelector(".hse-accordion__trigger");
        var fb = items[0].querySelector(".hse-accordion__body");
        items[0].classList.add("is-open");
        if (ft) ft.setAttribute("aria-expanded", "true");
        if (fb) fb.hidden = false;

        for (var k = 1; k < items.length; k++) {
          var t = items[k].querySelector(".hse-accordion__trigger");
          var b = items[k].querySelector(".hse-accordion__body");
          items[k].classList.remove("is-open");
          if (t) t.setAttribute("aria-expanded", "false");
          if (b) b.hidden = true;
        }
      }
    });
  }

  // ── 12. Parallax backgrounds ─────────────────────────────────────
  // Sections with hse-bg--fixed get a gentle parallax effect via
  // ScrollTrigger moving the image vertically as the section scrolls.

  if (!prefersReducedMotion) {
    document
      .querySelectorAll(".hse-section-bg.hse-bg--fixed")
      .forEach(function (bg) {
        var img = bg.querySelector(".hse-section-bg__img");
        if (!img) return;
        gsap.to(img, {
          yPercent: 20,
          ease: "none",
          scrollTrigger: {
            trigger: bg.closest(".hse-section"),
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });
  }

  // ── 12. Odometer ───────────────────────────────────────────────────
  // WCAG 4.1.3: Final value announced to screen readers via aria-live.
  // Announcements suppressed during count-up to avoid flooding.

  function setupOdometer() {
    document
      .querySelectorAll('.hse-stat[data-odometer="true"]')
      .forEach(function (stat) {
        var valueEl = stat.querySelector(".hse-stat__value");
        if (!valueEl) return;

        var raw = valueEl.textContent.trim();
        var prefix = "";
        var suffix = "";

        var prefixMatch = raw.match(/^([^0-9]*)/);
        if (prefixMatch) prefix = prefixMatch[1];

        var suffixMatch = raw.match(/([^0-9,\.]+)$/);
        if (suffixMatch && suffixMatch[1] !== prefix) suffix = suffixMatch[1];

        var number = raw
          .replace(prefix, "")
          .replace(suffix, "")
          .replace(/,/g, "");
        var isFloat = number.indexOf(".") !== -1;
        var decimals = isFloat ? (number.split(".")[1] || "").length : 0;
        var target = parseFloat(number);
        if (isNaN(target)) return;

        var hasCommas = raw.indexOf(",") !== -1;

        function formatNumber(val) {
          var rounded = isFloat
            ? val.toFixed(decimals)
            : Math.round(val).toString();
          if (hasCommas) {
            var parts = rounded.toString().split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            rounded = parts.join(".");
          }
          return prefix + rounded + suffix;
        }

        // Reduced motion: show final value immediately with aria-live
        if (prefersReducedMotion) {
          valueEl.setAttribute("aria-live", "polite");
          valueEl.setAttribute("aria-atomic", "true");
          valueEl.textContent = formatNumber(target);
          return;
        }

        valueEl.textContent = formatNumber(0);

        ScrollTrigger.create({
          trigger: stat,
          start: "top 85%",
          once: true,
          onEnter: function () {
            gsap.to(
              { val: 0 },
              {
                val: target,
                duration: 2,
                ease: "power2.out",
                onUpdate: function () {
                  valueEl.textContent = formatNumber(this.targets()[0].val);
                },
                onComplete: function () {
                  // Announce final value once animation is done
                  valueEl.setAttribute("aria-live", "polite");
                  valueEl.setAttribute("aria-atomic", "true");
                  valueEl.textContent = formatNumber(target);
                },
              },
            );
          },
        });
      });
  }
  // ── Custom HTML embed scroll lock ────────────────────────────────
  // Embeds steal scroll by default. Scroll lock prevents this until
  // the user clicks to activate. Auto-deactivates after 5s of no
  // interaction to return scroll control to the page.

  function setupEmbedScrollLock() {
    document
      .querySelectorAll(".hse-embed--scroll-locked")
      .forEach(function (embed) {
        var timer = null;

        function activate() {
          embed.classList.add("is-active");
          clearTimeout(timer);
          // Auto-deactivate after 5s of no interaction
          timer = setTimeout(function () {
            embed.classList.remove("is-active");
          }, 5000);
        }

        function resetTimer() {
          if (!embed.classList.contains("is-active")) return;
          clearTimeout(timer);
          timer = setTimeout(function () {
            embed.classList.remove("is-active");
          }, 5000);
        }

        // Click overlay or embed to activate
        embed.addEventListener("click", activate);
        embed.addEventListener("mousemove", resetTimer);
        embed.addEventListener("touchstart", activate, { passive: true });

        // Deactivate when user scrolls the page (outside embed)
        window.addEventListener(
          "scroll",
          function () {
            if (embed.classList.contains("is-active")) {
              embed.classList.remove("is-active");
              clearTimeout(timer);
            }
          },
          { passive: true },
        );
      });
  }

  setupEmbedScrollLock();

  // ── Scroll carousel ───────────────────────────────────────────────
  // Scroll-driven horizontal card carousel with text panel.
  // Cards slide left as the user scrolls; text updates per active card.

  function setupScrollCarousel() {
    document
      .querySelectorAll(".hse-section--scroll-carousel")
      .forEach(function (section) {
        var track = section.querySelector(".hse-sc__track");
        var cards = Array.from(section.querySelectorAll(".hse-sc__card"));
        var prev = section.querySelector(".hse-sc__prev");
        var next = section.querySelector(".hse-sc__next");
        var progress = section.querySelector(".hse-sc__progress span");
        var textItem = section.querySelector(".hse-sc__text-item");

        if (!track || !cards.length || !progress || !textItem) return;

        var currentIndex = -1;
        var ticking = false;

        function clamp(val, min, max) {
          return Math.min(Math.max(val, min), max);
        }

        function getGap() {
          var style = window.getComputedStyle(track);
          return parseFloat(style.columnGap || style.gap || 0) || 0;
        }

        function getMaxOffset() {
          var cardWidth = cards[0].getBoundingClientRect().width;
          return (cards.length - 1) * (cardWidth + getGap());
        }

        function updateText(index) {
          var content = cards[index].querySelector(".hse-sc__content");
          if (!content) return;
          textItem.classList.remove("is-active");
          textItem.innerHTML = content.innerHTML;
          requestAnimationFrame(function () {
            textItem.classList.add("is-active");
          });
        }

        function setActiveCard(index) {
          var next2 = clamp(index, 0, cards.length - 1);
          if (next2 === currentIndex) return;
          currentIndex = next2;
          cards.forEach(function (card, i) {
            card.classList.toggle("is-active", i === currentIndex);
          });
          updateText(currentIndex);
          if (prev) prev.disabled = currentIndex === 0;
          if (next) next.disabled = currentIndex === cards.length - 1;
        }

        function updateFromScroll() {
          var rect = section.getBoundingClientRect();
          var scrollable = section.offsetHeight - window.innerHeight;
          var scrollProgress = clamp(-rect.top / scrollable, 0, 1);
          var offset = scrollProgress * getMaxOffset();
          track.style.transform = "translateX(-" + offset + "px)";
          progress.style.width = scrollProgress * 100 + "%";
          setActiveCard(Math.round(scrollProgress * (cards.length - 1)));
          ticking = false;
        }

        function requestUpdate() {
          if (!ticking) {
            requestAnimationFrame(updateFromScroll);
            ticking = true;
          }
        }

        function jumpToCard(index) {
          var target = clamp(index, 0, cards.length - 1);
          var scrollable = section.offsetHeight - window.innerHeight;
          var targetProgress = target / (cards.length - 1);
          var targetY =
            window.scrollY +
            section.getBoundingClientRect().top +
            scrollable * targetProgress;
          window.scrollTo({ top: targetY, behavior: "smooth" });
        }

        if (prev)
          prev.addEventListener("click", function () {
            jumpToCard(currentIndex - 1);
          });
        if (next)
          next.addEventListener("click", function () {
            jumpToCard(currentIndex + 1);
          });

        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);

        updateText(0);
        setActiveCard(0);
        updateFromScroll();
      });
  }

  if (!prefersReducedMotion) {
    setupScrollCarousel();
  }
  // ── Global heading animations ─────────────────────────────────────
  // Reads data-heading-animation from <body> and triggers entrance
  // animations on all h2/h3 elements as they scroll into view.
  // Cover headline is excluded (has its own entrance animation).

  function setupHeadingAnimations() {
    var treatment = document.body.dataset.headingAnimation;
    if (!treatment || treatment === "none") return;

    var selectors = [
      ".hse-heading",
      "h2:not(.hse-cover__headline):not(.hse-sc__title):not(.hse-fbq__quote)",
      "h3",
    ].join(", ");

    var headings = Array.from(document.querySelectorAll(selectors));

    headings.forEach(function (heading) {
      // Skip headings inside the cover
      if (heading.closest("#hse-cover")) return;

      ScrollTrigger.create({
        trigger: heading,
        start: "top 88%",
        once: true,
        onEnter: function () {
          heading.classList.add("hse-heading-visible");
        },
      });
    });
  }

  if (!prefersReducedMotion) {
    setupHeadingAnimations();
  } else {
    // Ensure all headings are visible for reduced motion users
    document.querySelectorAll(".hse-heading, h2, h3").forEach(function (el) {
      el.classList.add("hse-heading-visible");
    });
  }
})();
