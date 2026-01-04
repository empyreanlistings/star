function initKaiAndIslaGallery() {
  console.log("🎨 [Gallery] initGallery called");
  const galleries = document.querySelectorAll(".mixed-gallery");
  if (!galleries.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  galleries.forEach(gallery => {
    // 1. Re-query items every time (crucial for dynamic updates)
    const items = Array.from(gallery.querySelectorAll(".gallery-item"));
    // console.log(`   📦 Found ${items.length} items in gallery`);

    // 2. Setup filter state
    let activeFilter = "all";
    let isAnimating = false;

    // 3. Prevent duplicate button listeners
    const filterContainer = gallery.closest(".container-glass")?.querySelector(".gallery-filters");
    if (filterContainer && !filterContainer.dataset.initialized) {
      console.log("   🛠️ Initializing gallery filters...");
      filterContainer.dataset.initialized = "true";
      const filterButtons = filterContainer.querySelectorAll(".filter");

      filterButtons.forEach(button => {
        button.addEventListener("click", () => {
          console.log(`   🎯 Filter clicked: ${button.dataset.filter}`);
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
      console.log(`   🔄 Synced filter: ${activeFilter}`);
    }

    // 4. Sequential Filter Animation
    function runGalleryFilter() {
      console.log(`   🎬 Running filter for: ${activeFilter}`);
      if (typeof gsap === "undefined") {
        console.warn("   ⚠️ GSAP not found, using fallbacks");
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
      console.log("   🔦 Initializing lightbox listeners");
      gallery.dataset.initialized = "true";
      gallery.addEventListener("click", e => {
        const item = e.target.closest(".gallery-item");
        if (!item || getComputedStyle(item).display === "none") return;

        console.log("   ✨ Gallery item clicked, opening lightbox");
        const img = item.querySelector("img");
        if (!img) return;

        // Try both common IDs
        const lightbox = document.getElementById("works-lightbox") || document.getElementById("lightbox");
        const lightboxImg = document.getElementById("works-lightbox-img") || document.getElementById("lightbox-img");
        const caption = lightbox?.querySelector(".lightbox-caption");

        if (!lightbox || !lightboxImg) {
          console.error("   ❌ Lightbox elements not found");
          return;
        }

        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || "";

        // Sync caption if available
        const overlay = item.querySelector(".gallery-overlay");
        if (caption && overlay) {
          caption.innerHTML = overlay.innerHTML;
        }

        lightbox.classList.add("open");
        lightbox.removeAttribute("inert");
        lightbox.removeAttribute("aria-hidden");
        document.body.style.overflow = "hidden";
      });
    }

    // Run filter immediately to sync initial state
    runGalleryFilter();
  });

  // Global Lightbox Close (Only add once)
  const lbItems = [
    document.getElementById("works-lightbox"),
    document.getElementById("lightbox")
  ];

  lbItems.forEach(lightbox => {
    if (lightbox && !lightbox.dataset.initialized) {
      lightbox.dataset.initialized = "true";
      lightbox.addEventListener("click", e => {
        // Close if clicked overlay or the image itself (if UX prefers)
        if (e.target === lightbox || e.target.id.includes("-img")) {
          lightbox.classList.remove("open");
          lightbox.setAttribute("inert", "");
          lightbox.setAttribute("aria-hidden", "true");
          document.body.style.overflow = "";
        }
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initKaiAndIslaGallery);
} else {
  initKaiAndIslaGallery();
}

window.initGallery = initKaiAndIslaGallery;
