function initGallery() {
  const galleries = document.querySelectorAll(".mixed-gallery");
  if (!galleries.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  galleries.forEach(gallery => {
    // 1. Re-query items every time (crucial for dynamic updates)
    const items = Array.from(gallery.querySelectorAll(".gallery-item"));
    if (!items.length) return;

    // 2. Setup filter state
    let activeFilter = "all";
    let isAnimating = false;

    // 3. Prevent duplicate button listeners
    const filterContainer = gallery.closest(".container-glass")?.querySelector(".gallery-filters");
    if (filterContainer && !filterContainer.dataset.initialized) {
      filterContainer.dataset.initialized = "true";
      const filterButtons = filterContainer.querySelectorAll(".filter");

      filterButtons.forEach(button => {
        button.addEventListener("click", () => {
          if (button.classList.contains("active") || isAnimating) return;
          filterButtons.forEach(b => b.classList.remove("active"));
          button.classList.add("active");
          activeFilter = button.dataset.filter || "all";
          runGalleryFilter();
        });
      });
    } else if (filterContainer) {
      // If already initialized, sync activeFilter with current active button
      activeFilter = filterContainer.querySelector(".filter.active")?.dataset.filter || "all";
    }

    // 4. Sequential Filter Animation
    function runGalleryFilter() {
      if (typeof gsap === "undefined") {
        items.forEach(item => {
          const category = item.dataset.category || "all";
          const shouldShow = activeFilter === "all" || category === activeFilter;
          item.style.display = shouldShow ? "" : "none";
        });
        return;
      }

      isAnimating = true;
      const toHide = [];
      const toShow = [];

      items.forEach(item => {
        const category = item.dataset.category || "all";
        const shouldShow = activeFilter === "all" || category === activeFilter;
        const isCurrentlyVisible = getComputedStyle(item).display !== "none";

        if (shouldShow && !isCurrentlyVisible) {
          toShow.push(item);
        } else if (!shouldShow && isCurrentlyVisible) {
          toHide.push(item);
        }
      });

      if (prefersReducedMotion) {
        toHide.forEach(el => el.style.display = "none");
        toShow.forEach(el => el.style.display = "");
        isAnimating = false;
        return;
      }

      if (toHide.length) {
        gsap.to(toHide, {
          opacity: 0,
          scale: 0.95,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            toHide.forEach(el => el.style.display = "none");
            showItems();
          }
        });
      } else {
        showItems();
      }

      function showItems() {
        toShow.forEach(el => {
          el.style.display = "";
          gsap.set(el, { opacity: 0, scale: 0.95, y: 15 });
        });

        if (toShow.length) {
          gsap.to(toShow, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.08,
            ease: "power2.out",
            onComplete: () => {
              isAnimating = false;
            }
          });
        } else {
          isAnimating = false;
        }
      }
    }

    // 5. Lightbox (Delegated - Only add once)
    if (!gallery.dataset.initialized) {
      gallery.dataset.initialized = "true";
      gallery.addEventListener("click", e => {
        const item = e.target.closest(".gallery-item");
        if (!item || getComputedStyle(item).display === "none") return;

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
    }

    // Run filter immediately for new items
    runGalleryFilter();
  });

  // Global Lightbox Close (Only add once)
  const lightbox = document.getElementById("lightbox");
  if (lightbox && !lightbox.dataset.initialized) {
    lightbox.dataset.initialized = "true";
    lightbox.addEventListener("click", e => {
      if (e.target === lightbox && !lightbox.classList.contains("palawan-lightbox")) {
        lightbox.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}

window.initGallery = initGallery;
