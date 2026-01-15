function initKaiAndIslaGallery() {
  console.log("🎨 [Gallery] initGallery called");
  const galleries = document.querySelectorAll(".mixed-gallery");
  if (!galleries.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Global State for Lightbox (attached to window for cross-module access if needed)
  if (!window.KaiGalleryState) {
    window.KaiGalleryState = {
      items: [],
      index: -1
    };
  }

  galleries.forEach(gallery => {
    // Determine filter container
    const filterContainer = gallery.closest(".container-glass")?.querySelector(".gallery-filters");

    // Store active filter on the gallery element to persist across re-renders if needed
    if (!gallery.dataset.activeFilter) {
      gallery.dataset.activeFilter = "all";
    }

    // 1. Filter Initialization (Bind only once)
    if (filterContainer && !filterContainer.dataset.initialized) {
      filterContainer.dataset.initialized = "true";
      const filterButtons = filterContainer.querySelectorAll(".filter");
      filterButtons.forEach(button => {
        button.addEventListener("click", () => {
          if (button.classList.contains("active")) return;
          filterButtons.forEach(b => b.classList.remove("active"));
          button.classList.add("active");

          gallery.dataset.activeFilter = button.dataset.filter || "all";
          runGalleryFilter(gallery);
        });
      });
    }

    // 2. Lightbox Initialization (Bind only once)
    if (!gallery.dataset.initializedLightbox) {
      gallery.dataset.initializedLightbox = "true";
      gallery.addEventListener("click", e => {
        const item = e.target.closest(".gallery-item");
        if (!item || getComputedStyle(item).display === "none") return;

        // Update global state with CURRENT visible items
        const visibleItems = Array.from(gallery.querySelectorAll(".gallery-item")).filter(el => getComputedStyle(el).display !== "none");
        window.KaiGalleryState.items = visibleItems;
        window.KaiGalleryState.index = visibleItems.indexOf(item);

        openLightbox(item);
      });
    }

    // 3. Run Filter Logic (ALWAYS run this to handle new items)
    runGalleryFilter(gallery);
  });

  function runGalleryFilter(gallery) {
    const activeFilter = gallery.dataset.activeFilter || "all";
    const limit = parseInt(gallery.dataset.limit) || Infinity;
    const allItems = Array.from(gallery.querySelectorAll(".gallery-item"));

    const toHide = [];
    const toShow = [];
    let visibleCount = 0;

    allItems.forEach(item => {
      const category = item.dataset.category || "all";
      const matchesFilter = activeFilter === "all" || category === activeFilter;

      let shouldShow = false;
      if (matchesFilter) {
        if (visibleCount < limit) {
          shouldShow = true;
          visibleCount++;
        }
      }

      const isCurrentlyVisible = getComputedStyle(item).display !== "none";
      if (shouldShow && !isCurrentlyVisible) toShow.push(item);
      else if (!shouldShow && isCurrentlyVisible) toHide.push(item);
    });

    // Update Empty State
    let noResults = gallery.querySelector(".gallery-no-results");
    if (visibleCount === 0) {
      if (!noResults) {
        noResults = document.createElement("div");
        noResults.className = "gallery-no-results property-card no-results-card";
        noResults.innerHTML = `
          <div class="property-image" style="background:var(--glass-bg);display:flex;align-items:center;justify-content:center;height:240px;flex-direction:column;gap:16px;">
              <i class="fas fa-search" style="font-size:48px;color:var(--text);opacity:0.3;"></i>
              <h4 style="margin:0; opacity:0.8; padding:20px; text-align:center;">Nothing here. Try updating your filters</h4>
          </div>
        `;
        gallery.appendChild(noResults);
      }
      noResults.style.display = "block";
    } else if (noResults) {
      noResults.style.display = "none";
    }

    if (toHide.length) {
      gsap.to(toHide, {
        opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in",
        onComplete: () => {
          toHide.forEach(el => el.style.display = "none");
          showItems(toShow);
        }
      });
    } else showItems(toShow);
  }

  function showItems(items) {
    items.forEach(el => {
      el.style.display = "";
      gsap.set(el, { opacity: 0, scale: 0.95, y: 15 });
    });
    if (items.length) {
      gsap.to(items, {
        opacity: 1, scale: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out"
      });
    }
  }

  function openLightbox(item) {
    const img = item.querySelector("img");
    if (!img) return;

    const lightbox = document.getElementById("works-lightbox") || document.getElementById("lightbox");
    const lightboxImg = document.getElementById("works-lightbox-img") || document.getElementById("lightbox-img");
    const caption = lightbox?.querySelector(".lightbox-caption");

    if (!lightbox || !lightboxImg) return;

    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "";

    const overlay = item.querySelector(".gallery-overlay");
    if (caption && overlay) caption.innerHTML = overlay.innerHTML;

    lightbox.classList.add("open");
    lightbox.removeAttribute("inert");
    document.body.style.overflow = "hidden";

    // Ensure state is set if opened directly (fallback)
    if (!window.KaiGalleryState.items.length) {
      const gallery = item.closest('.mixed-gallery') || document.querySelector('.mixed-gallery');
      if (gallery) {
        const visibleItems = Array.from(gallery.querySelectorAll(".gallery-item")).filter(el => getComputedStyle(el).display !== "none");
        window.KaiGalleryState.items = visibleItems;
        window.KaiGalleryState.index = visibleItems.indexOf(item);
      }
    }
  }

  // 4. Global Lightbox Controls (Bind only once)
  const lbItems = [document.getElementById("works-lightbox"), document.getElementById("lightbox")];
  lbItems.forEach(lightbox => {
    if (!lightbox || lightbox.dataset.initializedNav) return;
    lightbox.dataset.initializedNav = "true";

    lightbox.addEventListener("click", e => {
      const prevBtn = e.target.closest(".lightbox-prev");
      const nextBtn = e.target.closest(".lightbox-next");

      if (prevBtn) navigateLightbox(-1);
      else if (nextBtn) navigateLightbox(1);
      else if (e.target === lightbox || e.target.id.includes("-img")) {
        lightbox.classList.remove("open");
        lightbox.setAttribute("inert", "");
        document.body.style.overflow = "";
      }
    });
  });

  function navigateLightbox(dir) {
    const state = window.KaiGalleryState;
    if (!state || state.items.length <= 1) return;

    state.index = (state.index + dir + state.items.length) % state.items.length;
    const nextItem = state.items[state.index];

    const lightboxImg = document.getElementById("works-lightbox-img") || document.getElementById("lightbox-img");
    const caption = document.querySelector(".lightbox-caption");

    if (window.gsap) {
      gsap.to(lightboxImg, {
        opacity: 0, duration: 0.2, onComplete: () => {
          updateLightboxContent(nextItem, lightboxImg, caption);
          gsap.to(lightboxImg, { opacity: 1, duration: 0.2 });
        }
      });
    } else {
      updateLightboxContent(nextItem, lightboxImg, caption);
    }
  }

  function updateLightboxContent(item, imgElem, captionElem) {
    const img = item.querySelector("img");
    if (img) {
      imgElem.src = img.src;
      imgElem.alt = img.alt || "";
    }
    const overlay = item.querySelector(".gallery-overlay");
    if (captionElem && overlay) captionElem.innerHTML = overlay.innerHTML;
  }
}

// 5. Horizontal Scroll Logic (Apple-style + Infinite Loop)
window.initPalawanGalleryScroll = function () {
  const scrollWrapper = document.querySelector(".palawan-gallery-wrapper");
  const scrollContainer = document.querySelector(".palawan-gallery");
  const prevBtn = document.querySelector(".scroll-arrow.scroll-prev");
  const nextBtn = document.querySelector(".scroll-arrow.scroll-next");

  if (!scrollContainer || !prevBtn || !nextBtn) return;

  const originalItems = Array.from(scrollContainer.querySelectorAll(".gallery-item:not(.is-clone)"));
  if (originalItems.length < 3) return;

  // Clone items for infinite loop
  const clonesCount = 4; // Clone 4 items on each side
  const firstClones = originalItems.slice(0, clonesCount).map(item => item.cloneNode(true));
  const lastClones = originalItems.slice(-clonesCount).map(item => item.cloneNode(true));

  // Mark clones
  firstClones.forEach(el => el.classList.add('is-clone'));
  lastClones.forEach(el => el.classList.add('is-clone'));

  // Clear and Re-append with clones
  scrollContainer.innerHTML = "";
  lastClones.forEach(clone => scrollContainer.appendChild(clone));
  originalItems.forEach(item => scrollContainer.appendChild(item));
  firstClones.forEach(clone => scrollContainer.appendChild(clone));

  const getScrollAmount = () => {
    const style = getComputedStyle(scrollWrapper || document.documentElement);
    const w = parseInt(style.getPropertyValue('--card-width')) || 380;
    const g = parseInt(style.getPropertyValue('--gap')) || 24;
    return w + g;
  };

  // Jump to actual start (past clones)
  const jumpToStart = () => {
    const amount = getScrollAmount();
    scrollContainer.scrollLeft = amount * clonesCount;
  };

  // Initial position
  requestAnimationFrame(jumpToStart);

  // Seamless Wrap Logic with Buffer
  scrollContainer.addEventListener("scroll", () => {
    const scrollLeft = scrollContainer.scrollLeft;
    const amount = getScrollAmount();
    const realWidth = amount * originalItems.length;
    const clonesWidth = amount * clonesCount;
    const buffer = amount * 0.5; // Half-card buffer to trigger jump early

    if (scrollLeft < buffer) {
      // Near clones start (left edge) -> jump to same position in real set
      scrollContainer.scrollLeft = scrollLeft + realWidth;
    } else if (scrollLeft > realWidth + clonesWidth - buffer) {
      // Near clones end (right edge) -> jump back to real set
      scrollContainer.scrollLeft = scrollLeft - realWidth;
    }
  }, { passive: true });

  // Cursor and Click Logic
  scrollContainer.addEventListener("mousemove", (e) => {
    const rect = scrollContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      scrollContainer.classList.add("cursor-prev");
      scrollContainer.classList.remove("cursor-next");
    } else {
      scrollContainer.classList.add("cursor-next");
      scrollContainer.classList.remove("cursor-prev");
    }
  });

  scrollContainer.addEventListener("mouseleave", () => {
    scrollContainer.classList.remove("cursor-prev", "cursor-next");
  });

  scrollContainer.addEventListener("click", (e) => {
    if (e.target.closest('.gallery-item')) return;
    const rect = scrollContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) prevBtn.click();
    else nextBtn.click();
  });

  prevBtn.addEventListener("click", (e) => {
    e?.stopPropagation();
    scrollContainer.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
  });

  nextBtn.addEventListener("click", (e) => {
    e?.stopPropagation();
    scrollContainer.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
  });

  // Highlight active link or update arrows (loop is always visible)
  const updateArrows = () => {
    prevBtn.classList.add("visible");
    nextBtn.classList.add("visible");
  };
  updateArrows();
};

// Start scroll logic
window.initPalawanGalleryScroll();


// Auto-init REMOVED to prevent duplicate calls
// if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initKaiAndIslaGallery);
// else initKaiAndIslaGallery();
window.initGallery = initKaiAndIslaGallery;
