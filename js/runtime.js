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
          setupTimeline();
          setupParallax();
        } else {
          setupFullbleedQuoteA11y();
          setupStickyStepsA11y();
          setupRevealCrossfadeA11y();
          setupTimelineA11y();
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

    // ── State ──────────────────────────────────────────────────────
    // hse-nav--story : user has scrolled past the cover
    // hse-nav--dim   : auto-hide fired; strip + links fade out
    //
    // Reveal triggers: scroll-up OR cursor within 80px of top.
    // Auto-hide fires 2.5s after the last reveal trigger.

    var hideTimer;
    var inStory  = false;
    var lastScrollY = window.scrollY;

    function dim() {
      nav.classList.add("hse-nav--dim");
    }
    function undim(delay) {
      clearTimeout(hideTimer);
      nav.classList.remove("hse-nav--dim");
      hideTimer = setTimeout(dim, delay || 2500);
    }

    // Cover exit / entry
    var cover = document.getElementById("hse-cover");
    if (cover) {
      ScrollTrigger.create({
        trigger: cover,
        start: "35% top",   // 35% through the cover
        onEnter: function () {
          inStory = true;
          nav.classList.add("hse-nav--story");
          undim(2500); // generous first appearance
        },
        onLeaveBack: function () {
          inStory = false;
          clearTimeout(hideTimer);
          nav.classList.remove("hse-nav--story", "hse-nav--dim");
        },
      });
    }

    // Scroll-up reveals the strip (quicker re-hide)
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (inStory && y < lastScrollY) undim(1500);
      lastScrollY = y;
    }, { passive: true });

    // Cursor near top reveals the strip (desktop)
    document.addEventListener("mousemove", function (e) {
      if (!inStory) return;
      if (e.clientY < 80) undim(1500);
    });

    // Tap near top reveals the strip (mobile)
    document.addEventListener("touchstart", function (e) {
      if (!inStory) return;
      if (e.touches[0].clientY < 80) undim(1500);
    }, { passive: true });
    nav.addEventListener("mouseenter", function () { if (inStory) undim(1500); });
    nav.addEventListener("mouseleave", function () {
      if (inStory) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(dim, 1500);
      }
    });

    // ── Hamburger: mobile menu ─────────────────────────────────────
    var hamburger = document.getElementById("hse-nav-hamburger");
    var menu      = document.getElementById("hse-nav-mobile-menu");
    var closeBtn  = document.getElementById("hse-nav-mobile-close");
    if (hamburger && menu) {
      var focusableSelectors = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

      function openMenu() {
        menu.classList.add("is-open");
        menu.setAttribute("aria-hidden", "false");
        hamburger.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        // Move focus into the menu and trap it there
        var first = menu.querySelector(focusableSelectors);
        if (first) first.focus();
      }

      function closeMenu() {
        menu.classList.remove("is-open");
        menu.setAttribute("aria-hidden", "true");
        hamburger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        hamburger.focus();
      }

      // Focus trap: keep Tab / Shift+Tab inside the open menu
      menu.addEventListener("keydown", function (e) {
        if (!menu.classList.contains("is-open")) return;
        if (e.key === "Escape") { closeMenu(); return; }
        if (e.key !== "Tab") return;
        var focusable = Array.prototype.slice.call(menu.querySelectorAll(focusableSelectors));
        if (!focusable.length) return;
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      });

      hamburger.addEventListener("click", openMenu);
      if (closeBtn) closeBtn.addEventListener("click", closeMenu);
      menu.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", closeMenu);
      });
    }

    // ── Active nav link on scroll ──────────────────────────────────
    var navLinks = nav.querySelectorAll(".hse-nav__links a");
    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      var el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: "top 50%",
        end: "bottom 50%",
        onEnter:     function () { setActiveNav(navLinks, id); },
        onEnterBack: function () { setActiveNav(navLinks, id); },
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
        var bg       = section.querySelector(".hse-fbq__bg");
        var bgScroll = section.dataset.bgScroll || "parallax";

        if (bg && bgScroll === "parallax") {
          // True parallax: bg translates upward at ~40% of scroll speed.
          // Scale up so the translated edges never show through overflow:hidden.
          gsap.set(bg, { scale: 1.5 });
          gsap.fromTo(bg,
            { yPercent: -20 },
            {
              yPercent: 20,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            }
          );
        }
        // fixed: background-attachment:fixed + overflow:clip handles it in CSS
        // scroll: image moves with the page — no JS needed

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
  // Supports N images with fade or scroll-scrubbed wipe transitions.
  // Fade: opacity class toggle (instant on scroll position).
  // Wipe: GSAP scrub animates clip-path with scroll — only the incoming
  // image moves; outgoing images stay put underneath (z-index stacking).

  var WIPE_CLIPS = {
    "wipe-left":  { from: "inset(0 100% 0 0)",   to: "inset(0 0% 0 0)" },
    "wipe-right": { from: "inset(0 0 0 100%)",    to: "inset(0 0 0 0%)" },
    "wipe-down":  { from: "inset(0 0 100% 0)",    to: "inset(0 0 0% 0)" },
    "wipe-up":    { from: "inset(100% 0 0 0)",    to: "inset(0% 0 0 0)" },
  };

  function getWipeClips(transition, sectionEl) {
    if (transition === "circle") {
      var origin = sectionEl.dataset.wipeOrigin || "50% 50%";
      return {
        from: "circle(0% at " + origin + ")",
        to:   "circle(150% at " + origin + ")",
      };
    }
    return WIPE_CLIPS[transition] || null;
  }

  function setupRevealCrossfade() {
    gsap.utils
      .toArray(".hse-section--reveal-crossfade")
      .forEach(function (section) {
        var phases     = section.querySelectorAll(".hse-cf__phase");
        var images     = Array.from(section.querySelectorAll(".hse-cf__image"));
        var transition = section.dataset.transition || "fade";
        var wipeClips  = getWipeClips(transition, section);

        if (wipeClips) {
          // ── Wipe mode ──────────────────────────────────────────────
          // Image 0 sits at the bottom of the stack, fully visible.
          // Each subsequent image starts clipped and is revealed by
          // a GSAP scrub that ties the wipe directly to scroll position.
          images.forEach(function (img, i) {
            img.style.zIndex = i; // higher index = on top
            // opacity must be 1 for all — clip-path controls visibility in wipe mode
            if (i === 0) {
              gsap.set(img, { opacity: 1, clipPath: wipeClips.to });
            } else {
              gsap.set(img, { opacity: 1, clipPath: wipeClips.from });
            }
          });

          images.forEach(function (img, i) {
            if (i === 0) return; // first image is already visible
            var phase = phases[i];
            if (!phase) return;

            // Wipe the image in as this phase scrolls into the viewport
            gsap.to(img, {
              clipPath: wipeClips.to,
              ease: "none",
              scrollTrigger: {
                trigger: phase,
                start: "top 70%",    // wait until previous image has settled into full view
                end: "top 15%",      // phase nearly at top
                scrub: 0.4,          // small lag for smoothness
                onEnter: function () {
                  phase.classList.add("is-visible");
                },
                onLeaveBack: function () {
                  if (i === 0) phase.classList.remove("is-visible");
                },
              },
            });
          });

          // Phase text visibility (same as fade mode)
          phases.forEach(function (phase, i) {
            ScrollTrigger.create({
              trigger: phase,
              start: "top 65%",
              onEnter: function () { phase.classList.add("is-visible"); },
              onLeaveBack: function () {
                if (i === 0) phase.classList.remove("is-visible");
              },
            });
          });

        } else {
          // ── Fade mode (default) ────────────────────────────────────
          function showImage(index) {
            images.forEach(function (img, i) {
              img.classList.toggle("is-active", i === index);
            });
            section.classList.toggle("is-revealed", index > 0);
          }

          phases.forEach(function (phase, i) {
            var imageIndex = parseInt(phase.dataset.image || i, 10);
            ScrollTrigger.create({
              trigger: phase,
              start: "top 65%",
              onEnter: function () {
                phase.classList.add("is-visible");
                showImage(imageIndex);
              },
              onLeaveBack: function () {
                var prevIndex = i > 0
                  ? parseInt(phases[i - 1].dataset.image || (i - 1), 10)
                  : 0;
                showImage(prevIndex);
                if (i === 0) phase.classList.remove("is-visible");
              },
            });
          });
        }
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
  // ── 9. Timeline ────────────────────────────────────────────────────

  function setupTimeline() {
    gsap.utils.toArray(".hse-section--timeline").forEach(function (section) {
      var entries = Array.from(section.querySelectorAll(".hse-tl__entry"));
      var layers  = Array.from(section.querySelectorAll(".hse-tl__layer"));

      if (!entries.length) return;

      // Activate a media layer (fade in image, play/pause videos)
      function activateLayer(index) {
        layers.forEach(function (layer, i) {
          var active = i === index;
          layer.classList.toggle("is-active", active);
          var video = layer.querySelector("video[data-tl-video]");
          if (video) {
            if (active) {
              video.play().catch(function () {});
            } else {
              video.pause();
              video.currentTime = 0;
            }
          }
        });
      }

      // Ensure only the first video plays on load
      layers.forEach(function (layer, i) {
        var video = layer.querySelector("video[data-tl-video]");
        if (!video) return;
        if (i === 0) { video.play().catch(function () {}); }
        else { video.pause(); }
      });

      var desktop = window.matchMedia("(min-width: 769px)");
      var NAV = 90; // clearance for the fixed header

      // Too tall for the screen? Widen the panel and set its text in two
      // columns (.is-wide) so the whole entry can be read without moving.
      // `room(entry)` gives the height available to that entry's panel.
      // `wider` allows a third column across the full screen width when two
      // still aren't enough (horizontal, where the line can't move).
      function fitEntries(room, wider) {
        entries.forEach(function (entry) { entry.classList.remove("is-wide", "is-wider"); });
        if (!desktop.matches) return;
        entries.forEach(function (entry) {
          var inner = entry.querySelector(".hse-tl__entry-inner");
          if (!inner || inner.offsetHeight <= room(entry)) return;
          entry.classList.add("is-wide");
          if (wider && inner.offsetHeight > room(entry)) entry.classList.add("is-wider");
        });
      }

      function onResize(fn) {
        var timer;
        function handler() { clearTimeout(timer); timer = setTimeout(fn, 200); }
        window.addEventListener("resize", handler);
        return function () { clearTimeout(timer); window.removeEventListener("resize", handler); };
      }

      function setupVertical() {
        // Alternate panels are half the page wide: no room for two columns
        if (section.dataset.align !== "alternate" && !section.dataset.direction) {
          var refit = function () { fitEntries(function () { return window.innerHeight - 160; }); };
          refit();
          onResize(function () { refit(); ScrollTrigger.refresh(); });
        }
        entries.forEach(function (entry, i) {
          // Fade entry text in when it approaches the viewport centre
          ScrollTrigger.create({
            trigger: entry,
            start: "top 65%",
            end: "bottom 20%",
            onEnter:     function () { entry.classList.add("is-visible"); },
            onLeaveBack: function () { entry.classList.remove("is-visible"); },
          });

          // Switch media layer when this entry crosses the viewport midpoint
          ScrollTrigger.create({
            trigger: entry,
            start: "top 55%",
            end: "bottom 55%",
            onEnter:     function () { activateLayer(i); },
            onEnterBack: function () { activateLayer(i); },
          });
        });
      }

      // Pinned directions (horizontal, stepped) share one pattern: build a
      // paused timeline that rests on each entry (`hold`) and moves to the
      // next (`move`), size the section to it (1px of scroll per unit) and
      // scrub it. The background changes half way through each move, as the
      // old entry leaves and the new one arrives; an entry fades in as it
      // starts to arrive.
      function pinned(build, teardown) {
        var tl, st, current;
        function start() {
          var plan = build(); // { tl, arrive: [time each entry is reached], moves: [move duration into each] }
          tl = plan.tl;
          section.style.height = (tl.duration() + window.innerHeight) + "px";
          current = -1;
          st = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            animation: tl,
            onUpdate: function () {
              var t = tl.time();
              var index = 0;
              plan.arrive.forEach(function (time, i) {
                if (t >= time - plan.moves[i] / 2) index = i;
              });
              if (index !== current) { current = index; activateLayer(index); }
              entries.forEach(function (entry, i) {
                entry.classList.toggle("is-visible", t >= plan.arrive[i] - plan.moves[i] * 0.85);
              });
            },
          });
          entries[0].classList.add("is-visible");
          activateLayer(0);
        }
        function stop() {
          if (st) { st.kill(); st = null; }
          if (tl) { tl.kill(); tl = null; }
          section.style.height = "";
          teardown();
        }
        start();
        ScrollTrigger.refresh();
        var off = onResize(function () { stop(); start(); ScrollTrigger.refresh(); });
        return function () { off(); stop(); };
      }

      // Horizontal: each entry has a whole screen width to itself, so only
      // one is in view at a time; the track slides one screen per entry.
      function setupHorizontal() {
        var viewport = section.querySelector(".hse-tl__viewport");
        var track    = section.querySelector(".hse-tl__phases");
        var align    = section.dataset.align;
        var lineY    = align === "right" ? 0.76 : align === "alternate" ? 0.5 : 0.24;

        return pinned(function () {
          var W = viewport.clientWidth, H = window.innerHeight;
          section.style.setProperty("--tl-col-w", W + "px");
          fitEntries(function (entry) {
            var below = entry.dataset.side === "left";
            return below ? H * (1 - lineY) - 32 - 40 : H * lineY - 32 - NAV;
          }, true);
          var hold = H * 0.35, move = H * 0.9;
          var tl = gsap.timeline({ paused: true });
          var arrive = [], moves = [];
          tl.set(track, { x: 0 }, 0);
          entries.forEach(function (entry, i) {
            if (i) tl.to(track, { x: -i * W, duration: move, ease: "power1.inOut" });
            arrive.push(tl.duration());
            moves.push(i ? move : 0);
            tl.to({}, { duration: hold });
          });
          return { tl: tl, arrive: arrive, moves: moves };
        }, function () {
          gsap.set(track, { clearProps: "transform" });
          section.style.removeProperty("--tl-col-w");
          entries.forEach(function (entry) { entry.classList.remove("is-wide", "is-wider"); });
        });
      }

      // Stepped: entries sit along a path that turns across, down or up
      // after each one. Measure the panels, place them, draw the path as SVG
      // and move the view along it. Each run lasts long enough that the last
      // entry has left the screen before the next arrives, so one entry is
      // in view at a time and the path turns only between entries.
      function setupStepped() {
        var world = section.querySelector(".hse-tl__phases");
        var NS = "http://www.w3.org/2000/svg";
        var svg;

        return pinned(function () {
          section.classList.add("is-stepped");
          var W = window.innerWidth, H = window.innerHeight;
          var gap  = parseFloat(getComputedStyle(section).getPropertyValue("--tl-gap")) || 32;
          var room = 64;
          var ax = W * 0.3;

          // Runs. Up straight after down, or down after up, would double
          // back, so it goes across. An across run reached by climbing hangs
          // its panel above the line, and the view sits low to show it.
          // Diagonals (rise ↗, fall ↘) slope at SLOPE; their panel sits off
          // the line's corner, below-right of a rise and above-right of a fall.
          var SLOPE = Math.tan(30 * Math.PI / 180);
          var runs = [], prevVertical = null;
          entries.forEach(function (entry, i) {
            var run = entry.dataset.run || (i % 2 ? "down" : "across");
            if ((run === "up" && prevVertical === "down") || (run === "down" && prevVertical === "up")) run = "across";
            prevVertical = run === "up" || run === "down" ? run : null;
            runs.push(run);
            entry.setAttribute("data-run", run);
            if (run === "across" && runs[i - 1] === "up") entry.setAttribute("data-hang", "above");
            else entry.removeAttribute("data-hang");
          });
          // Panels that sit above their line
          var above = runs.map(function (run, i) { return run === "fall" || !!entries[i].dataset.hang; });
          var anchorY = above.map(function (a) { return H * (a ? 0.72 : 0.3); });

          fitEntries(function (entry) {
            var i = entries.indexOf(entry);
            if (runs[i] === "up" || runs[i] === "down") return H - anchorY[i] - 40;
            return above[i] ? anchorY[i] - gap - NAV : H - anchorY[i] - gap - 40;
          });

          // Each panel's box relative to its node (the point on the line)
          var boxes = entries.map(function (entry, i) {
            var marker = entry.querySelector(".hse-tl__marker");
            var h = entry.querySelector(".hse-tl__entry-inner").offsetHeight;
            var w = entry.offsetWidth;
            if (runs[i] === "rise") return { dx: gap, dy: gap, w: w, h: h };
            if (runs[i] === "fall") return { dx: gap, dy: -(gap + h), w: w, h: h };
            if (runs[i] === "across") {
              var mx = marker ? marker.offsetLeft : 16;
              return { dx: -mx, dy: entry.dataset.hang ? -(gap + h) : gap, w: w, h: h };
            }
            var my = marker ? marker.offsetTop : 9;
            return { dx: gap, dy: -my, w: w, h: h };
          });

          // A panel still too tall for its usual spot moves the line up (or,
          // hanging above it, down) as far as it needs to fit on screen
          anchorY = anchorY.map(function (ay, i) {
            var b = boxes[i];
            if (above[i]) return Math.min(H - 40, Math.max(ay, NAV - b.dy));
            return Math.max(NAV - Math.min(0, b.dy), Math.min(ay, H - 40 - b.dy - b.h));
          });

          // Distance to the next node: far enough that the panels never
          // overlap, the next panel is off screen while resting on this one,
          // and this one is off screen once resting on the next.
          var nodes = [], x = 0, y = 0;
          entries.forEach(function (entry, i) {
            var b = boxes[i], nb = boxes[i + 1], ay = anchorY[i], nay = anchorY[i + 1];
            nodes.push({ x: x, y: y, run: runs[i] });
            entry.style.left = (x + b.dx) + "px";
            entry.style.top  = (y + b.dy) + "px";
            if (!nb) return;
            if (runs[i] === "across" || runs[i] === "rise" || runs[i] === "fall") {
              var step = Math.max(b.dx + b.w + room - nb.dx, W - ax - nb.dx + room, ax + b.dx + b.w + room);
              x += step;
              if (runs[i] === "rise") y -= step * SLOPE;
              if (runs[i] === "fall") y += step * SLOPE;
            } else if (runs[i] === "down") {
              y += Math.max(b.dy + b.h + room - nb.dy, H - ay - nb.dy + room, nay + b.dy + b.h + room);
            } else {
              y -= Math.max(nb.dy + nb.h + room - b.dy, ay + nb.dy + nb.h + room, H - nay - b.dy + room);
            }
          });
          var last = nodes[nodes.length - 1];
          var flat = last.run === "across" || last.run === "rise" || last.run === "fall";
          var tail = {
            x: last.x + (flat ? 120 : 0),
            y: last.y + (last.run === "down" ? 120 : last.run === "up" ? -120 : last.run === "rise" ? -120 * SLOPE : last.run === "fall" ? 120 * SLOPE : 0),
          };

          // Path: a faint track, and a copy drawn on as the reader goes
          var d = nodes.concat([tail]).map(function (p, i) { return (i ? "L" : "M") + p.x + " " + p.y; }).join(" ");
          if (svg) svg.remove();
          svg = document.createElementNS(NS, "svg");
          svg.setAttribute("class", "hse-tl__path");
          svg.setAttribute("aria-hidden", "true");
          svg.setAttribute("width", "1");
          svg.setAttribute("height", "1");
          ["hse-tl__path-track", "hse-tl__path-drawn"].forEach(function (cls) {
            var path = document.createElementNS(NS, "path");
            path.setAttribute("class", cls);
            path.setAttribute("d", d);
            svg.appendChild(path);
          });
          world.insertBefore(svg, world.firstChild);
          var drawn = svg.querySelector(".hse-tl__path-drawn");
          var total = drawn.getTotalLength();
          drawn.style.strokeDasharray = total + " " + total;

          var hold = H * 0.35;
          var tl = gsap.timeline({ paused: true });
          var arrive = [], moves = [], drawnLen = 0;
          tl.set(world, { x: ax - nodes[0].x, y: anchorY[0] - nodes[0].y }, 0);
          tl.set(drawn, { strokeDashoffset: total }, 0);
          nodes.forEach(function (p, i) {
            if (i) {
              var prev = nodes[i - 1];
              var len = Math.hypot(p.x - prev.x, p.y - prev.y);
              drawnLen += len;
              tl.to(world, { x: ax - p.x, y: anchorY[i] - p.y, duration: len, ease: "power1.inOut" });
              tl.to(drawn, { strokeDashoffset: total - drawnLen, duration: len, ease: "power1.inOut" }, "<");
              moves.push(len);
            } else {
              moves.push(0);
            }
            arrive.push(tl.duration());
            tl.to({}, { duration: hold });
          });
          tl.to(drawn, { strokeDashoffset: 0, duration: 120, ease: "none" });
          return { tl: tl, arrive: arrive, moves: moves };
        }, function () {
          if (svg) { svg.remove(); svg = null; }
          gsap.set(world, { clearProps: "transform" });
          entries.forEach(function (e) {
            e.style.left = ""; e.style.top = "";
            e.removeAttribute("data-hang");
            e.classList.remove("is-wide");
          });
          section.classList.remove("is-stepped");
        });
      }

      var direction = section.querySelector(".hse-tl__viewport") ? section.dataset.direction : null;
      if (direction === "stepped" || direction === "horizontal") {
        // Phones get the stacked vertical layout (css/layouts/timeline.css)
        var mm = gsap.matchMedia();
        mm.add("(min-width: 769px)", direction === "stepped" ? setupStepped : setupHorizontal);
        mm.add("(max-width: 768px)", setupVertical);
      } else {
        setupVertical();
      }
    });
  }

  function setupTimelineA11y() {
    // Reduced-motion: show all entries and the last media layer
    document.querySelectorAll(".hse-section--timeline").forEach(function (section) {
      // Horizontal: no pinning; the track scrolls sideways by hand
      if (section.dataset.direction === "horizontal") section.classList.add("is-static");
      section.querySelectorAll(".hse-tl__entry").forEach(function (e) {
        e.classList.add("is-visible");
      });
      var layers = Array.from(section.querySelectorAll(".hse-tl__layer"));
      if (layers.length) {
        layers.forEach(function (l) { l.classList.remove("is-active"); });
        layers[layers.length - 1].classList.add("is-active");
      }
    });
  }

  // ── 10. Parallax ────────────────────────────────────────────────────

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
        // Activate on hover, deactivate on mouse leave
        embed.addEventListener("mouseenter", function () {
          embed.classList.add("is-active");
        });
        embed.addEventListener("mouseleave", function () {
          embed.classList.remove("is-active");
        });

        // Touch: activate on tap, deactivate on next page scroll
        embed.addEventListener("touchstart", function () {
          embed.classList.add("is-active");
        }, { passive: true });

        window.addEventListener("scroll", function () {
          embed.classList.remove("is-active");
        }, { passive: true });
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
    setupPanoramicScroll();
  }
  // ── Panoramic scroll ──────────────────────────────────────────────
  // Full-viewport image track pans horizontally as the user scrolls.
  // GSAP scrub drives the translation; text overlays crossfade per panel.

  function setupPanoramicScroll() {
    document.querySelectorAll(".hse-section--panoramic-scroll").forEach(function (section) {
      var textItems = Array.from(section.querySelectorAll(".hse-pan__text-item"));
      var dots      = Array.from(section.querySelectorAll(".hse-pan__dot"));
      var mode      = section.dataset.panMode; // "single" or "multi"
      var count     = textItems.length || 1;
      var isMobile  = window.matchMedia("(max-width: 768px)").matches;

      var currentIndex = 0;

      function setActivePanel(index) {
        if (index === currentIndex) return;
        currentIndex = index;
        textItems.forEach(function (item, i) {
          item.classList.toggle("is-active", i === index);
        });
        dots.forEach(function (dot, i) {
          dot.classList.toggle("is-active", i === index);
        });
      }

      // Mobile: snap softly to each panel stop after the user lifts their finger
      var snapConfig = (isMobile && count > 1) ? {
        snap: {
          snapTo: 1 / (count - 1),
          duration: { min: 0.2, max: 0.5 },
          ease: "power2.inOut",
        }
      } : {};

      var scrollTriggerConfig = Object.assign({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: isMobile ? 0.8 : 1.2,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var index = Math.round(self.progress * (count - 1));
          setActivePanel(index);
        },
      }, snapConfig);

      if (mode === "single") {
        // ── Single-image: animate backgroundPositionX on sticky ──────
        var sticky = section.querySelector(".hse-pan__sticky--single");
        if (!sticky) return;
        // Mobile: subtle pan within portrait crop (40% travel), desktop: full sweep
        var fromPos = isMobile ? "30% 50%" : "0% 50%";
        var toPos   = isMobile ? "70% 50%" : "100% 50%";
        gsap.fromTo(sticky,
          { backgroundPosition: fromPos },
          {
            backgroundPosition: toPos,
            ease: "none",
            scrollTrigger: scrollTriggerConfig,
          }
        );
      } else {
        // ── Multi-image: translate the track ─────────────────────────
        var track  = section.querySelector(".hse-pan__track");
        var panels = Array.from(section.querySelectorAll(".hse-pan__panel"));
        if (!track || panels.length < 2) return;
        gsap.to(track, {
          x: function () { return -(panels.length - 1) * window.innerWidth; },
          ease: "none",
          scrollTrigger: scrollTriggerConfig,
        });
      }
    });
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

  // ── Cinema reveal ─────────────────────────────────────────────────
  // Video card starts contained (65vw, rounded corners) and expands to
  // fill the viewport as the user scrolls. MP4 videos autoplay when fully
  // expanded; YouTube/Vimeo iframes remain click-to-play.

  function setupCinemaReveal() {
    document.querySelectorAll('.hse-section--cinema-reveal').forEach(function (section) {
      var sticky = section.querySelector('.hse-cr__sticky');
      var card   = section.querySelector('.hse-cr__card');
      var header = section.querySelector('.hse-cr__header');

      if (!card) return;

      var tl = gsap.timeline()
        .to(card,   { width: '100vw', borderRadius: 0, ease: 'none' }, 0)
        .to(header, { opacity: 0, y: -24, ease: 'power2.in', duration: 0.35 }, 0);

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=150%',
        pin: sticky,
        scrub: 1.5,
        animation: tl,
        onLeave: function () {
          var video = section.querySelector('.hse-cr__video');
          if (video) { video.muted = true; video.play().catch(function () {}); }
          var iframe = section.querySelector('.hse-cr__iframe');
          if (iframe && iframe.src.indexOf('autoplay') === -1) {
            iframe.src += (iframe.src.indexOf('?') !== -1 ? '&' : '?') + 'autoplay=1&mute=1';
          }
        },
      });
    });
  }

  if (!prefersReducedMotion) {
    setupCinemaReveal();
  }

  // ── Frame Scrubber ────────────────────────────────────────────────
  // Pre-loads a JPEG sequence and draws frames to a canvas as the user
  // scrolls. Text overlays activate when scroll enters their frame range.

  function setupFrameScrubber() {
    document.querySelectorAll(".hse-section--frame-scrubber").forEach(function (section) {
      var canvas    = section.querySelector(".hse-fs__canvas");
      var textItems = Array.from(section.querySelectorAll(".hse-fs__text-item"));
      var bar       = section.querySelector(".hse-fs__progress-bar span");
      if (!canvas) return;

      var ctx        = canvas.getContext("2d");
      var baseUrl    = section.dataset.baseUrl    || "";
      var frameCount = parseInt(section.dataset.frameCount)  || 1;
      var prefix     = section.dataset.framePrefix || "frame-";
      var digits     = parseInt(section.dataset.frameDigits) || 3;
      var frames     = new Array(frameCount);
      var loaded     = 0;
      var currentIdx = -1;

      // Size canvas to device pixels for sharpness
      function resize() {
        var dpr = window.devicePixelRatio || 1;
        canvas.width  = window.innerWidth  * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width  = window.innerWidth  + "px";
        canvas.style.height = window.innerHeight + "px";
        ctx.scale(dpr, dpr);
        if (currentIdx >= 0) drawFrame(currentIdx);
      }
      window.addEventListener("resize", function () { resize(); });
      resize();

      // Cover-fit draw
      function drawFrame(idx) {
        var img = frames[idx];
        if (!img || !img.complete || !img.naturalWidth) return;
        var vw = window.innerWidth, vh = window.innerHeight;
        var iw = img.naturalWidth,  ih = img.naturalHeight;
        var scale = Math.max(vw / iw, vh / ih);
        var w = iw * scale, h = ih * scale;
        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(img, (vw - w) / 2, (vh - h) / 2, w, h);
        currentIdx = idx;
      }

      // Loading indicator
      function drawLoading(n) {
        var vw = window.innerWidth, vh = window.innerHeight;
        ctx.fillStyle = "#0a1428";
        ctx.fillRect(0, 0, vw, vh);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Loading " + Math.round(n / frameCount * 100) + "%", vw / 2, vh / 2);
      }

      // Text overlay activation by frame range
      function updateText(idx) {
        textItems.forEach(function (item) {
          var start = parseInt(item.dataset.frameStart) || 0;
          var end   = parseInt(item.dataset.frameEnd)   || frameCount;
          item.classList.toggle("is-active", idx >= start && idx <= end);
        });
      }

      // Zero-pad frame index (1-based)
      function pad(i) {
        return String(i + 1).padStart(digits, "0");
      }

      // Show poster (or blank) until frames arrive
      var posterUrl = section.dataset.poster || "";
      if (posterUrl) {
        var posterImg = new Image();
        posterImg.onload = function () { drawFrame_raw(posterImg); };
        posterImg.src = posterUrl;
      } else {
        drawLoading(0);
      }

      function drawFrame_raw(img) {
        var vw = window.innerWidth, vh = window.innerHeight;
        var iw = img.naturalWidth,  ih = img.naturalHeight;
        var scale = Math.max(vw / iw, vh / ih);
        var w = iw * scale, h = ih * scale;
        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(img, (vw - w) / 2, (vh - h) / 2, w, h);
      }

      function startPreload() {
        if (frames[0]) return; // already started
        if (!posterUrl) drawLoading(0);
        for (var i = 0; i < frameCount; i++) {
          (function (idx) {
            var img = new Image();
            frames[idx] = img;
            img.onload = function () {
              loaded++;
              if (loaded < frameCount) {
                if (!posterUrl) drawLoading(loaded);
              } else {
                drawFrame(0);
                updateText(0);
              }
            };
            img.onerror = function () { loaded++; };
            img.src = baseUrl + prefix + pad(idx) + ".jpg";
          })(i);
        }
      }

      // Begin loading when the section is ~1.5 viewports away
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          startPreload();
        }
      }, { rootMargin: "150% 0px" });
      observer.observe(section);

      // ScrollTrigger scrub
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: function (self) {
          var idx = Math.min(Math.round(self.progress * (frameCount - 1)), frameCount - 1);
          if (bar) bar.style.width = (self.progress * 100) + "%";
          if (idx === currentIdx) return;
          drawFrame(idx);
          updateText(idx);
        },
      });
    });
  }

  setupFrameScrubber();

  // ── Split Reveal ──────────────────────────────────────────────────
  // Full-bleed image shrinks left (100vw → 50vw) over the first 28% of
  // scroll; text panel fades in from the right (18–36%); inner copy
  // then scrolls up through the remaining 64%. Mobile (<768px) is a
  // static stacked layout — no animation needed.

  function setupSplitReveal() {
    document.querySelectorAll('.hse-section--split-reveal').forEach(function (section) {
      var media     = section.querySelector('.hse-sr__media');
      var copy      = section.querySelector('.hse-sr__copy');
      var copyInner = section.querySelector('.hse-sr__copy-inner');

      if (!media || !copy || !copyInner) return;

      function isMobile() { return window.innerWidth <= 768; }

      function reset() {
        media.style.width     = '';
        copy.style.opacity    = '';
        copy.style.transform  = '';
        copyInner.style.transform = '';
        section.querySelectorAll('.hse-sr__image-card').forEach(function (c) {
          c.classList.add('is-visible');
        });
      }

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: function (self) {
          if (isMobile()) { reset(); return; }

          var p = self.progress;

          // Image shrinks from 100vw → 50vw over first 28% of scroll
          var shrink = Math.min(1, p / 0.28);
          media.style.width = (100 - 50 * shrink) + 'vw';

          // Copy panel fades + slides in from 18% → 36%
          var copyP = Math.max(0, Math.min(1, (p - 0.18) / 0.18));
          copy.style.opacity   = copyP;
          copy.style.transform = 'translateX(' + (60 * (1 - copyP)) + 'px)';

          // Inner copy scrolls up from 36% → 100%
          var textP     = Math.max(0, Math.min(1, (p - 0.36) / 0.64));
          var scrollDist = Math.max(0, copyInner.offsetHeight - window.innerHeight);
          copyInner.style.transform = 'translateY(' + (-scrollDist * textP) + 'px)';
        },
      });

      // Image cards slide in when they enter the (virtual) viewport
      section.querySelectorAll('.hse-sr__image-card').forEach(function (card) {
        ScrollTrigger.create({
          trigger: card,
          start: 'top 78%',
          once: true,
          onEnter: function () { card.classList.add('is-visible'); },
        });
      });
    });
  }

  if (!prefersReducedMotion) {
    setupSplitReveal();
  }

  // ── Editor ↔ preview scroll sync ──────────────────────────────────

  // Scroll to a section when the editor requests it
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'hse-scroll-to') return;
    var el = document.getElementById(e.data.id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Audio player ───────────────────────────────────────────────────
  (function () {
    var trigger  = document.getElementById('hse-audio-trigger');
    var player   = document.getElementById('hse-audio-player');
    var audio    = document.getElementById('hse-audio');
    if (!trigger || !player || !audio) return;

    var playBtn   = document.getElementById('hse-audio-play');
    var scrub     = document.getElementById('hse-audio-scrub');
    var timeEl    = document.getElementById('hse-audio-time');
    var durEl     = document.getElementById('hse-audio-duration');
    var closeBtn  = document.getElementById('hse-audio-close');
    var speedBtns = player.querySelectorAll('.hse-audio__speed');
    var nav       = document.getElementById('hse-nav');

    // Keep --hse-nav-h in sync so the panel slides from the right place
    function syncNavHeight() {
      if (nav) document.documentElement.style.setProperty('--hse-nav-h', nav.offsetHeight + 'px');
    }
    syncNavHeight();
    window.addEventListener('resize', syncNavHeight);
    // Re-sync after nav transitions (logo shrinks on scroll)
    nav && nav.addEventListener('transitionend', syncNavHeight);

    function fmt(s) {
      if (!isFinite(s)) return '–:––';
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    var playSvg  = '<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    var pauseSvg = '<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    function updatePlayBtn() {
      var playing = !audio.paused;
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      playBtn.innerHTML = playing ? pauseSvg : playSvg;
    }

    function openPlayer() {
      syncNavHeight();
      player.hidden = false;
      // Allow hidden→visible transition to paint before animating
      requestAnimationFrame(function () {
        player.classList.add('is-open');
      });
      trigger.setAttribute('aria-expanded', 'true');
    }

    function closePlayer() {
      player.classList.remove('is-open');
      audio.pause();
      updatePlayBtn();
      trigger.setAttribute('aria-expanded', 'false');
      player.addEventListener('transitionend', function hide() {
        player.hidden = true;
        player.removeEventListener('transitionend', hide);
      });
    }

    trigger.addEventListener('click', function () {
      if (player.hidden || !player.classList.contains('is-open')) {
        openPlayer();
        if (audio.readyState >= 2) audio.play();
      } else {
        closePlayer();
      }
    });

    playBtn.addEventListener('click', function () {
      if (audio.paused) { audio.play(); } else { audio.pause(); }
    });

    audio.addEventListener('play',  updatePlayBtn);
    audio.addEventListener('pause', updatePlayBtn);
    audio.addEventListener('ended', function () {
      audio.currentTime = 0;
      updatePlayBtn();
    });

    audio.addEventListener('loadedmetadata', function () {
      scrub.max = audio.duration;
      durEl.textContent = fmt(audio.duration);
    });

    audio.addEventListener('timeupdate', function () {
      if (!scrub._dragging) {
        scrub.value = audio.currentTime;
        timeEl.textContent = fmt(audio.currentTime);
      }
    });

    scrub.addEventListener('mousedown',  function () { scrub._dragging = true; });
    scrub.addEventListener('touchstart', function () { scrub._dragging = true; }, { passive: true });
    scrub.addEventListener('input',      function () { timeEl.textContent = fmt(+scrub.value); });
    scrub.addEventListener('change',     function () {
      audio.currentTime = +scrub.value;
      scrub._dragging = false;
    });

    speedBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        audio.playbackRate = parseFloat(btn.dataset.speed);
        speedBtns.forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });

    closeBtn.addEventListener('click', closePlayer);

    // ── Analytics ────────────────────────────────────────────────────
    // Safe wrapper — no-ops if Plausible isn't loaded (preview, editor)
    function track(event, props) {
      if (typeof window.plausible === 'function') {
        window.plausible(event, props ? { props: props } : undefined);
      }
    }

    // Fire once on first play
    var played = false;
    audio.addEventListener('play', function () {
      if (!played) { track('Audio Play'); played = true; }
    });

    // 50% and completion milestones
    var tracked50 = false, trackedComplete = false;
    audio.addEventListener('timeupdate', function () {
      if (!audio.duration) return;
      var pct = audio.currentTime / audio.duration;
      if (!tracked50 && pct >= 0.5) {
        track('Audio 50%');
        tracked50 = true;
      }
    });
    audio.addEventListener('ended', function () {
      if (!trackedComplete) { track('Audio Complete'); trackedComplete = true; }
      audio.currentTime = 0;
      updatePlayBtn();
    });
  })();

  // ── PDF download tracking ──────────────────────────────────────────
  (function () {
    var pdfLink = document.querySelector('.hse-nav__pdf-link');
    if (!pdfLink) return;
    pdfLink.addEventListener('click', function () {
      if (typeof window.plausible === 'function') {
        window.plausible('PDF Download');
      }
    });
  })();

  // Report which section is nearest the top as the user scrolls
  (function() {
    var sections = Array.from(document.querySelectorAll('.hse-section[id]'));
    if (!sections.length || window.self === window.top) return;

    var lastReported = null;

    function reportVisible() {
      var midY = window.scrollY + window.innerHeight * 0.35;
      var current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top + window.scrollY <= midY) {
          current = sections[i];
        }
      }
      if (current && current.id !== lastReported) {
        lastReported = current.id;
        window.parent.postMessage({ type: 'hse-section-in-view', id: current.id }, '*');
      }
    }

    window.addEventListener('scroll', reportVisible, { passive: true });
    reportVisible();
  })();

  // ── Interaction analytics ──────────────────────────────────────────
  // Reports which sections readers reach and which interactive elements
  // they use, for story reports on reports.har.pn. Listen-only: it adds
  // no markup, styles or behaviour, and runs last, inside its own
  // try/catch, so a failure here can't affect anything above.
  //
  // Event names and props are a contract with the reports (like the
  // audio/PDF events above): change them only with a note in the
  // reports repo. Every event carries `section` (section id) and
  // `layout`. Each element counts once per page view. Only producer-
  // written labels are sent; nothing a reader types ever is.
  //
  // No-ops unless the Plausible script loaded (editor preview has none).
  (function () {
    try {
      if (typeof window.plausible !== "function") return;

      var sent = {};
      function send(event, el, extra, key) {
        try {
          var sec = el && el.closest ? el.closest(".hse-section[id]") : null;
          var props = {
            section: sec ? sec.id : "none",
            layout: (sec && sec.getAttribute("data-layout")) || "none",
          };
          for (var k in extra) props[k] = extra[k];
          var once = event + "|" + props.section + "|" + (key || "");
          if (sent[once]) return;
          sent[once] = true;
          window.plausible(event, { props: props });
        } catch (e) {}
      }
      function label(el) {
        return ((el && el.textContent) || "").replace(/\s+/g, " ").trim().slice(0, 100);
      }

      // Section Reached / Story Finished — a section counts once its top
      // has passed the middle of the screen. Checked against positions
      // (not visibility) so fast scrolling can't skip a section, and
      // reaching the bottom of the page counts every section, so a short
      // last section still registers.
      var sections = Array.prototype.slice.call(document.querySelectorAll(".hse-section[id]"));
      var reached = 0;
      var ticking = false;
      function checkSections() {
        ticking = false;
        var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        var line = window.innerHeight * 0.5;
        while (reached < sections.length &&
               (atBottom || sections[reached].getBoundingClientRect().top <= line)) {
          var s = sections[reached];
          reached++;
          send("Section Reached", s, { position: String(reached) });
          if (reached === sections.length) {
            send("Story Finished", s, {});
            window.removeEventListener("scroll", onScroll);
          }
        }
      }
      function onScroll() {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(checkSections);
        }
      }
      if (sections.length) {
        window.addEventListener("scroll", onScroll, { passive: true });
        checkSections();
      }

      // Clicks: one delegated listener in the capture phase, so it sees
      // every click before the elements' own handlers run (and even if
      // one of them stops the click from bubbling).
      document.addEventListener("click", function (e) {
        try {
          var t = e.target;
          if (!t || !t.closest) return;

          var navLink = t.closest("#hse-nav a[href^='#'], #hse-nav-mobile-menu a[href^='#']");
          if (navLink) {
            var target = navLink.getAttribute("href").slice(1) || "top";
            send("Nav Used", document.getElementById(target), { target: target }, target);
            return;
          }

          var toggleBtn = t.closest(".hse-toggle__btn");
          if (toggleBtn) {
            var option = label(toggleBtn);
            send("Toggle Switched", toggleBtn, { option: option }, option);
            return;
          }

          var trigger = t.closest(".hse-accordion__trigger");
          if (trigger) {
            // Capture runs before the accordion's handler: "true" now means this click closes it
            if (trigger.getAttribute("aria-expanded") === "true") return;
            var item = label(trigger);
            send("Accordion Opened", trigger, { item: item }, item);
            return;
          }

          var arrow = t.closest(".hse-sc__prev, .hse-sc__next");
          if (arrow) {
            // Capture runs before the carousel moves, so work out the card
            // this click is heading to from the one showing now
            var sc = arrow.closest(".hse-section--scroll-carousel");
            var cards = sc ? Array.prototype.slice.call(sc.querySelectorAll(".hse-sc__card")) : [];
            var now = Math.max(0, cards.indexOf(sc ? sc.querySelector(".hse-sc__card.is-active") : null));
            var step = arrow.classList.contains("hse-sc__next") ? 1 : -1;
            var card = String(Math.min(cards.length, Math.max(1, now + 1 + step)));
            send("Carousel Moved", arrow, { card: card }, card);
            return;
          }

          var chip = t.closest(".hse-be__chip, .hse-be__send");
          if (chip) {
            var kind = chip.classList.contains("hse-be__chip") ? "chip" : "typed";
            send("Briefing Question", chip, { kind: kind }, kind + "|" + label(chip));
            return;
          }

          var link = t.closest("a[href]");
          if (link && /^https?:$/.test(link.protocol) && link.hostname !== location.hostname) {
            var url = (link.hostname + link.pathname).replace(/\/$/, "").slice(0, 200);
            send("Link Clicked", link, { url: url }, url);
          }
        } catch (err) {}
      }, true);

      // Embeds: clicks inside an iframe never reach the page, but the
      // page loses focus to it — that counts as using the embed.
      var embeds = Array.prototype.slice.call(document.querySelectorAll(".hse-embed, .hse-cr__iframe"));
      function embedName(el) {
        var frame = el.matches && el.matches("iframe") ? el : el.querySelector && el.querySelector("iframe");
        return (frame && frame.getAttribute("title")) || "embed " + (embeds.indexOf(el) + 1);
      }
      embeds.forEach(function (el) {
        el.addEventListener("pointerdown", function () {
          send("Embed Used", el, { embed: embedName(el) }, embedName(el));
        }, { passive: true });
      });
      window.addEventListener("blur", function () {
        setTimeout(function () {
          var a = document.activeElement;
          if (!a || a.tagName !== "IFRAME") return;
          for (var i = 0; i < embeds.length; i++) {
            if (embeds[i] === a || embeds[i].contains(a)) {
              send("Embed Used", embeds[i], { embed: embedName(embeds[i]) }, embedName(embeds[i]));
              return;
            }
          }
        }, 0);
      });
    } catch (e) {}
  })();

})();
