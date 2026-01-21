// ================================================================
// ANIMATIONS — GSAP FLIP, HERO CAROUSEL, ON-SCROLL
// ================================================================

/**
 * Main entrance for all site-wide animations.
 * Consolidates logic from main.js and animations.js to avoid conflicts.
 */
function initAnimations() {
  console.log("🎯 initAnimations() started");

  // 1. On-Scroll Reveal (Basic CSS-driven)
  initScrollAnimations();

  // 2. Hero Carousel & Video Sequence (Index Page Only)
  initHeroSequence();
}

/**
 * Initializes IntersectionObserver for elements with .animate-on-scroll
 */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".animate-on-scroll").forEach(el => observer.observe(el));
}

/**
 * Handles the delicate timing between Hero Video and Hero Carousel
 */
function initHeroSequence() {
  const heroCarousel = document.querySelector(".hero-carousel");
  const heroVideo = document.getElementById("heroVideo");

  if (!heroCarousel) {
    // Only warn if we're on a page that usually has one (index)
    const isIndex = window.location.pathname.includes('index.html') ||
      window.location.pathname === '/' ||
      window.location.pathname === '';
    if (isIndex) console.warn("   ⚠️ Hero carousel element not found on index page");
    return;
  }

  let carouselRevealed = false;

  const revealCarousel = (isImmediate = false) => {
    if (carouselRevealed) return;
    carouselRevealed = true;

    console.log(`🎬 Revealing carousel (${isImmediate ? 'Immediate' : 'Sequence'})`);

    // CRITICAL: Ensure video is stopped and hidden immediately when carousel reveals (Only if immediate)
    if (heroVideo && isImmediate) {
      heroVideo.pause();
      heroVideo.style.display = "none";
      heroVideo.style.opacity = "0";
    }

    if (window.gsap) {
      // Ensure it's hidden before starting animation to avoid jumps
      gsap.set(heroCarousel, { opacity: 0 });

      gsap.to(heroCarousel, {
        opacity: 1,
        duration: isImmediate ? 0.8 : 1.0,
        ease: "sine.out",
        onComplete: () => {
          heroCarousel.classList.add("is-visible");
        }
      });
    } else {
      heroCarousel.style.opacity = "1";
      heroCarousel.style.transform = "none";
      heroCarousel.classList.add("is-visible");
    }
  };

  // 1. Force state sync if returning to tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (carouselRevealed && heroVideo) {
        console.log("🔄 Tab focused: Enforcing carousel state, hiding video");
        heroVideo.pause();
        heroVideo.style.display = "none";
        heroVideo.style.opacity = "0";
      }
    }
  });

  // If there's no video, reveal immediately
  if (!heroVideo) {
    revealCarousel(true);
  } else {
    // 3. Matrix Loader Initial Logic
    const matrixLoader = document.getElementById("matrixLoader");

    // Function to hide matrix loader safely
    const hideMatrixLoader = () => {
      if (!matrixLoader || matrixLoader.style.display === "none") return;
      if (window.gsap) {
        gsap.to(matrixLoader, {
          opacity: 0,
          duration: 1,
          ease: "power2.inOut",
          onComplete: () => {
            matrixLoader.style.display = "none";
          }
        });
      } else {
        matrixLoader.style.opacity = "0";
        setTimeout(() => matrixLoader.style.display = "none", 1000);
      }
    };

    // Show matrix loader triggered by video play
    heroVideo.addEventListener('play', () => {
      if (matrixLoader) {
        matrixLoader.style.opacity = "1";
        matrixLoader.style.display = "flex";

        // Hide after exactly 3 seconds
        setTimeout(hideMatrixLoader, 3000);
      }
    });

    // We no longer reassign revealCarousel as it's a const.
    // Instead, we ensure hideMatrixLoader() is called inside the original revealCarousel.
    // However, since hideMatrixLoader is defined here, let's move the call to where it matters.
    // We can also just monitor carouselRevealed.
    const matrixCheckInterval = setInterval(() => {
      if (carouselRevealed) {
        hideMatrixLoader();
        clearInterval(matrixCheckInterval);
      }
    }, 100);

    // Video exists: wait for it to end or trigger early fade-in
    let transitionStarted = false;

    const transitionToCarousel = () => {
      if (transitionStarted) return;
      transitionStarted = true;
      console.log('🎬 Starting Hero Video -> Carousel transition');

      // Fade out video and reveal carousel simultaneously
      if (window.gsap) {
        gsap.to(heroVideo, {
          opacity: 0,
          duration: 1.5,
          ease: "power2.inOut",
          onComplete: () => {
            heroVideo.style.display = "none";
          }
        });
      } else {
        heroVideo.style.opacity = "0";
        heroVideo.style.display = "none";
      }

      revealCarousel();
    };

    // Trigger transition 1.5 seconds before end
    heroVideo.addEventListener('timeupdate', () => {
      if (heroVideo.duration && (heroVideo.duration - heroVideo.currentTime < 1.5)) {
        transitionToCarousel();
      }
    });

    heroVideo.addEventListener('ended', () => {
      console.log('🎬 Hero Video ended');
      transitionToCarousel();
    });

    heroVideo.addEventListener('error', () => {
      console.warn('⚠️ Hero Video error, skipping to carousel');
      revealCarousel(true);
    });

    // Safety timeout: if video doesn't play/load in 10s, show carousel
    setTimeout(() => {
      if (!carouselRevealed) {
        console.log('⏱️ Hero Video timeout, revealing carousel');
        revealCarousel(true);
      }
    }, 10000);
  }

  // Handle Carousel Inner Logic (Slides, Swipe, Timer)
  initCarouselLogic(heroCarousel, revealCarousel);
}

/**
 * Handles slides, auto-play, and mobile swipe for the hero carousel
 */
function initCarouselLogic(heroCarousel, revealCarouselFn) {
  const slides = heroCarousel.querySelectorAll(".hero-slide");
  if (!slides.length) return;

  let currentSlide = 0;
  const SLIDE_INTERVAL = 6000;
  let autoSlideTimer = null;
  let hasStarted = false;

  // Set initial state
  slides.forEach((s, i) => s.classList.toggle("active", i === 0));

  function nextSlide() {
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  function prevSlide() {
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  function startAutoSlide() {
    if (!autoSlideTimer && slides.length > 1 && hasStarted) {
      autoSlideTimer = setInterval(nextSlide, SLIDE_INTERVAL);
    }
  }

  function stopAutoSlide() {
    clearInterval(autoSlideTimer);
    autoSlideTimer = null;
  }

  // Hook into the reveal sequence
  const originalReveal = window.revealHeroCarousel; // Not used but good pattern

  // We'll use an observer or just check is-visible class
  const checkVisibility = setInterval(() => {
    if (heroCarousel.classList.contains('is-visible')) {
      clearInterval(checkVisibility);
      console.log("🚀 Hero Carousel is visible, starting auto-play");
      hasStarted = true;
      startAutoSlide();
    }
  }, 500);

  // --- Mobile Swipe ---
  let isSwiping = false;
  let startX = 0;
  let currentTranslate = 0;

  function handleTouchStart(e) {
    startX = e.touches ? e.touches[0].clientX : e.pageX;
    isSwiping = true;
    stopAutoSlide();
  }

  function handleTouchMove(e) {
    if (!isSwiping) return;
    const x = e.touches ? e.touches[0].clientX : e.pageX;
    currentTranslate = x - startX;

    // Subtly move the slider container for haptic feel
    const offset = (currentTranslate / heroCarousel.offsetWidth) * 100;
    slides[currentSlide].style.transform = `translateX(${offset}%)`;
  }

  function handleTouchEnd() {
    if (!isSwiping) return;
    isSwiping = false;

    if (Math.abs(currentTranslate) > 50) {
      if (currentTranslate < 0) nextSlide();
      else prevSlide();
    }

    slides.forEach(s => s.style.transform = "");
    currentTranslate = 0;
    setTimeout(startAutoSlide, 1000);
  }

  if (slides.length > 1) {
    startAutoSlide();
    heroCarousel.addEventListener("mouseenter", stopAutoSlide);
    heroCarousel.addEventListener("mouseleave", startAutoSlide);
    heroCarousel.addEventListener("touchstart", handleTouchStart, { passive: true });
    heroCarousel.addEventListener("touchmove", handleTouchMove, { passive: true });
    heroCarousel.addEventListener("touchend", handleTouchEnd);
    heroCarousel.addEventListener("mousedown", handleTouchStart);
    heroCarousel.addEventListener("mousemove", handleTouchMove);
    heroCarousel.addEventListener("mouseup", handleTouchEnd);
    heroCarousel.addEventListener("mouseleave", handleTouchEnd);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoSlide();
      else startAutoSlide();
    });
  }
}

// Global Expose
window.initAnimations = initAnimations;
