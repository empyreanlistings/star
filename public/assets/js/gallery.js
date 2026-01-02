// ================================================================
// gallery.js — Unified gallery + filters + lightbox (Apple-grade)
// ================================================================
if (typeof gsap !== "undefined") {
  gsap.registerPlugin(Flip);
}

function initGallery() {
  const galleries = document.querySelectorAll(".mixed-gallery");
  if (!galleries.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  galleries.forEach(gallery => {
    const items = Array.from(gallery.querySelectorAll(".gallery-item"));
    if (!items.length) return;

    const filterContainer =
      gallery.closest(".container-glass")?.querySelector(".gallery-filters");
    if (!filterContainer) return;

    const filterButtons = filterContainer.querySelectorAll(".filter");
    let activeFilter = "all";

    // ------------------------------------------------
    // FILTER BUTTON HANDLERS
    // ------------------------------------------------
    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        if (button.classList.contains("active")) return;

        filterButtons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");

        activeFilter = button.dataset.filter || "all";
        runFlip();
      });
    });

    // ------------------------------------------------
    // CORE FLIP (CALM, PROFESSIONAL)
    // ------------------------------------------------
    function runFlip() {
      // Capture pre-change layout
      const state = Flip.getState(items, { props: "opacity" });

      // Apply filter
      items.forEach(item => {
        const category = item.dataset.category || "all";
        const shouldShow =
          activeFilter === "all" || category === activeFilter;

        item.classList.toggle("flip-hidden", !shouldShow);
        item.style.pointerEvents = shouldShow ? "auto" : "none";
      });

      // Reduced motion = instant
      if (prefersReducedMotion) {
        Flip.from(state, { duration: 0 });
        return;
      }

      // Animate layout change
      Flip.from(state, {
        duration: 0.45,
        ease: "cubic-bezier(0.22, 1, 0.36, 1)", // Apple-like easing
        absolute: false,
        scale: false,
        fade: true,
        stagger: 0,
        onEnter: elements =>
          gsap.fromTo(
            elements,
            { opacity: 0 },
            { opacity: 1, duration: 0.25, ease: "power1.out" }
          ),
        onLeave: elements =>
          gsap.to(elements, {
            opacity: 0,
            duration: 0.2,
            ease: "power1.in"
          })
      });
    }

    // ------------------------------------------------
    // LIGHTBOX (DELEGATED)
    // ------------------------------------------------
    gallery.addEventListener("click", e => {
      const item = e.target.closest(".gallery-item");
      if (!item || item.classList.contains("flip-hidden")) return;

      const img = item.querySelector("img");
      if (!img) return;

      const lightbox = document.getElementById("lightbox");
      const lightboxImg = document.getElementById("lightbox-img");
      if (!lightbox || !lightboxImg) return;

      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || "";
      lightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    });

    // Initial layout
    runFlip();
  });

  // ------------------------------------------------
  // GLOBAL LIGHTBOX CLOSE
  // ------------------------------------------------
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    lightbox.addEventListener("click", e => {
      if (
        e.target === lightbox &&
        !lightbox.classList.contains("palawan-lightbox")
      ) {
        lightbox.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  }
}

// ------------------------------------------------
// AUTO INIT
// ------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}

window.initGallery = initGallery;
