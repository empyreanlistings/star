// ================================================================
// ANIMATIONS — GSAP FLIP, HERO CAROUSEL, ON-SCROLL
// ================================================================
function initAnimations() {

  // ================================================================
  // ON-SCROLL ANIMATIONS (CSS-DRIVEN)
  // ================================================================
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add("in-view");
      });
    },
    { threshold: 0.1 }
  );

  document
    .querySelectorAll(".animate-on-scroll")
    .forEach(el => observer.observe(el));

  // ================================================================
  // HERO CAROUSEL — ENTRANCE ANIMATION (NON-BLOCKING, ONCE)
  // ================================================================
  const heroCarousel = document.querySelector(".hero-carousel");

  if (heroCarousel && typeof gsap !== "undefined") {
    let hasAnimated = false;

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated) return;

        hasAnimated = true;
        heroObserver.disconnect();

        gsap.to(heroCarousel, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.1,
          ease: "power3.out",
          delay: 0.25,
          overwrite: "auto"
        });

        heroCarousel.classList.add("is-visible");
      },
      { threshold: 0.35 }
    );

    heroObserver.observe(heroCarousel);
  }

  // ================================================================
  // GSAP FLIP — MIXED GALLERIES
  // ================================================================
  if (typeof gsap !== "undefined") gsap.registerPlugin(Flip);

  document.querySelectorAll(".mixed-gallery").forEach(gallery => {
    const items = Array.from(gallery.querySelectorAll(".gallery-item"));
    const filterButtons =
      gallery.previousElementSibling?.querySelectorAll(".filter") || [];

    const lockHeight = () =>
      (gallery.style.height = gallery.offsetHeight + "px");
    const unlockHeight = () => (gallery.style.height = "");

    filterButtons.forEach(button => {
      button.addEventListener("click", e => {
        e.preventDefault();

        filterButtons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");

        const filter = button.dataset.filter;

        lockHeight();
        const state = Flip.getState(items);

        items.forEach(item => {
          const match =
            filter === "all" || item.dataset.category === filter;
          item.classList.toggle("is-hidden", !match);
          item.style.position = match ? "relative" : "absolute";
          item.style.pointerEvents = match ? "auto" : "none";
        });

        Flip.from(state, {
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.05,
          absolute: true,
          onEnter: els =>
            gsap.fromTo(
              els,
              { opacity: 0, scale: 0.96 },
              { opacity: 1, scale: 1, duration: 0.35 }
            ),
          onLeave: els =>
            gsap.to(els, {
              opacity: 0,
              scale: 0.96,
              duration: 0.25
            }),
          onComplete: unlockHeight
        });
      });
    });

    gallery
      .previousElementSibling
      ?.querySelector(".filter.active")
      ?.click();
  });

  // ================================================================
  // HERO CAROUSEL — AUTO + SWIPE (UNCHANGED LOGIC)
  // ================================================================
  const slides = heroCarousel?.querySelectorAll(".hero-slide") || [];
  let currentSlide = 0;
  const SLIDE_INTERVAL = 6000;
  let autoSlideTimer = null;

  slides.forEach((s, i) => s.classList.toggle("active", i === 0));

  function nextSlide() {
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  function prevSlide() {
    slides[currentSlide].classList.remove("active");
    currentSlide =
      (currentSlide - 1 + slides.length) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  function startAutoSlide() {
    if (!autoSlideTimer && slides.length > 1)
      autoSlideTimer = setInterval(nextSlide, SLIDE_INTERVAL);
  }

  function stopAutoSlide() {
    clearInterval(autoSlideTimer);
    autoSlideTimer = null;
  }

  let isSwiping = false;
  let startX = 0;
  let currentTranslate = 0;

  function handleTouchStart(e) {
    startX = e.touches ? e.touches[0].clientX : e.pageX;
    isSwiping = true;
    stopAutoSlide();
    slides.forEach(s => (s.style.transition = "none"));
  }

  function handleTouchMove(e) {
    if (!isSwiping) return;
    const x = e.touches ? e.touches[0].clientX : e.pageX;
    currentTranslate = x - startX;
    slides.forEach(
      s =>
        (s.style.transform = `translateX(${(currentTranslate /
          heroCarousel.offsetWidth) *
          100}%)`)
    );
  }

  function handleTouchEnd() {
    if (!isSwiping) return;
    isSwiping = false;

    if (Math.abs(currentTranslate) > 50) {
      currentTranslate < 0 ? nextSlide() : prevSlide();
    }

    slides.forEach(s => {
      s.style.transition = "";
      s.style.transform = "";
    });

    currentTranslate = 0;
    setTimeout(startAutoSlide, 1000);
  }

  if (heroCarousel && slides.length > 1) {
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
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stopAutoSlide() : startAutoSlide()
    );
  }
}

// ================================================================
// EXPOSE
// ================================================================
window.initAnimations = initAnimations;
