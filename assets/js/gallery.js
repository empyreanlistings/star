function initKaiAndIslaGallery() {
  console.log("🎨 [Gallery] initGallery called");
  const galleries = document.querySelectorAll(".mixed-gallery");
  if (!galleries.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Shared state for lightbox navigation
  let currentItems = [];
  let currentIndex = -1;

  galleries.forEach(gallery => {
    let activeFilter = "all";
    let isAnimating = false;
    const limit = parseInt(gallery.dataset.limit) || Infinity;

    // 1. Filter Initialization
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
    }

    // 2. Filter Logic
    function runGalleryFilter() {
      const allItems = Array.from(gallery.querySelectorAll(".gallery-item"));
      isAnimating = true;

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

      if (toHide.length) {
        gsap.to(toHide, {
          opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in",
          onComplete: () => {
            toHide.forEach(el => el.style.display = "none");
            showItems();
          }
        });
      } else showItems();

      function showItems() {
        toShow.forEach(el => {
          el.style.display = "";
          gsap.set(el, { opacity: 0, scale: 0.95, y: 15 });
        });
        if (toShow.length) {
          gsap.to(toShow, {
            opacity: 1, scale: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out",
            onComplete: () => { isAnimating = false; updateCurrentItems(); }
          });
        } else { isAnimating = false; updateCurrentItems(); }
      }
    }

    function updateCurrentItems() {
      currentItems = Array.from(gallery.querySelectorAll(".gallery-item")).filter(el => getComputedStyle(el).display !== "none");
    }

    // 3. Lightbox Logic
    if (!gallery.dataset.initialized) {
      gallery.dataset.initialized = "true";
      gallery.addEventListener("click", e => {
        const item = e.target.closest(".gallery-item");
        if (!item || getComputedStyle(item).display === "none") return;

        updateCurrentItems();
        currentIndex = currentItems.indexOf(item);
        openLightbox(item);
      });
    }

    runGalleryFilter();
  });

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
  }

  // 4. Global Lightbox Controls
  const lbItems = [document.getElementById("works-lightbox"), document.getElementById("lightbox")];
  lbItems.forEach(lightbox => {
    if (!lightbox || lightbox.dataset.initializedNav) return;
    lightbox.dataset.initializedNav = "true";

    lightbox.addEventListener("click", e => {
      if (e.target.classList.contains("lightbox-prev")) navigateLightbox(-1);
      else if (e.target.classList.contains("lightbox-next")) navigateLightbox(1);
      else if (e.target === lightbox || e.target.id.includes("-img")) {
        lightbox.classList.remove("open");
        lightbox.setAttribute("inert", "");
        document.body.style.overflow = "";
      }
    });
  });

  function navigateLightbox(dir) {
    if (currentItems.length <= 1) return;
    currentIndex = (currentIndex + dir + currentItems.length) % currentItems.length;

    const nextItem = currentItems[currentIndex];
    const lightboxImg = document.getElementById("works-lightbox-img") || document.getElementById("lightbox-img");
    const caption = document.querySelector(".lightbox-caption");

    if (window.gsap) {
      gsap.to(lightboxImg, {
        opacity: 0, duration: 0.2, onComplete: () => {
          const img = nextItem.querySelector("img");
          lightboxImg.src = img.src;
          lightboxImg.alt = img.alt || "";
          const overlay = nextItem.querySelector(".gallery-overlay");
          if (caption && overlay) caption.innerHTML = overlay.innerHTML;
          gsap.to(lightboxImg, { opacity: 1, duration: 0.2 });
        }
      });
    } else {
      const img = nextItem.querySelector("img");
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || "";
      const overlay = nextItem.querySelector(".gallery-overlay");
      if (caption && overlay) caption.innerHTML = overlay.innerHTML;
    }
  }
}

// 5. Horizontal Scroll Logic (Apple-style)
const scrollWrapper = document.querySelector(".palawan-gallery-wrapper");
const scrollContainer = document.querySelector(".palawan-gallery");
const prevBtn = document.querySelector(".scroll-arrow.scroll-prev");
const nextBtn = document.querySelector(".scroll-arrow.scroll-next");

if (scrollContainer && prevBtn && nextBtn) {
  const updateArrows = () => {
    const buffer = 10; // tolerance
    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

    // Show/Hide Prev
    if (scrollContainer.scrollLeft > buffer) {
      prevBtn.classList.add("visible");
    } else {
      prevBtn.classList.remove("visible");
    }

    // Show/Hide Next
    if (scrollContainer.scrollLeft < maxScroll - buffer) {
      nextBtn.classList.add("visible");
    } else {
      nextBtn.classList.remove("visible");
    }
  };

  const getScrollAmount = () => {
    // Read CSS variable or fallback
    const style = getComputedStyle(scrollWrapper);
    const w = parseInt(style.getPropertyValue('--card-width')) || 380;
    const g = parseInt(style.getPropertyValue('--gap')) || 24;
    return w + g;
  };

  // Scroll Handlers
  prevBtn.addEventListener("click", () => {
    scrollContainer.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
  });

  nextBtn.addEventListener("click", () => {
    scrollContainer.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
  });

  scrollContainer.addEventListener("scroll", () => {
    window.requestAnimationFrame(updateArrows);
  }, { passive: true });

  // Initial check (delay slightly to allow layout)
  setTimeout(updateArrows, 100);
  window.addEventListener("resize", updateArrows);
}
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initKaiAndIslaGallery);
else initKaiAndIslaGallery();
window.initGallery = initKaiAndIslaGallery;
