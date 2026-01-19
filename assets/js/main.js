// ================================================================
// CONSOLIDATED MAIN.JS – FAIL-SAFE, FULLY HARDENED
// ================================================================

// ================================================================
// GLOBAL ERROR LOGGER – NEVER FAIL SILENTLY
// ================================================================
(function () {
  const seen = new Set();

  function logError(type, err, context) {
    const message = err?.message || String(err);
    const key = `${type}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);

    console.group(
      `%c⚠️ APP ERROR [${type}]`,
      "color:#ff5555;font-weight:bold"
    );
    if (context) console.log("Context:", context);
    console.error(err);
    console.trace();
    console.groupEnd();
  }

  window.addEventListener("error", e => {
    logError("runtime", e.error || e.message, {
      file: e.filename,
      line: e.lineno,
      column: e.colno
    });
  });

  window.addEventListener("unhandledrejection", e => {
    logError("promise", e.reason);
  });

  window.__logError = logError;
})();

// ================================================================
// FAIL-SAFE INIT WRAPPER
// ================================================================
function safeInit(name, fn) {
  try {
    if (typeof fn !== "function") {
      throw new Error(`Init "${name}" is not a function`);
    }
    fn();
    console.info(`✅ ${name} initialized`);
  } catch (err) {
    window.__logError?.("init", err, name);
  }
}

/**
 * Utility to prevent background scroll jumping when modals open.
 * Uses padding compensation for browsers that don't fully support scrollbar-gutter.
 */
function toggleScrollLock(lock) {
  const isMobile = window.innerWidth <= 768;
  if (lock) {
    // Only apply padding compensation on desktop where scrollbars occupy space
    if (!isMobile) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

// ================================================================
// SAFE GSAP / FLIP HELPERS
// ================================================================
function withGSAP(cb) {
  if (!window.gsap) return;
  try {
    cb();
  } catch (err) {
    __logError("gsap", err);
  }
}

function withFlip(cb) {
  if (!window.gsap || !window.Flip) return;
  try {
    gsap.registerPlugin(Flip);
    cb();
  } catch (err) {
    __logError("flip", err);
  }
}

// Logo Halo Ripple logic removed as per user request (liquid glass cleanup)

// ================================================================
// RESPONSIVE VIDEO LOADER + CACHING
// ================================================================
async function initResponsiveVideo() {
  const video = document.getElementById('heroVideo');
  if (!video) return;

  const cacheName = 'hero-video-cache';

  const loadAndCacheVideo = async (src) => {
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(src);

      if (cachedResponse) {
        console.log(`📦 Video from cache: ${src}`);
        const blob = await cachedResponse.blob();
        video.src = URL.createObjectURL(blob);
      } else {
        console.log(`📡 Fetching and caching video: ${src}`);
        video.src = src; // Set source to fetch it
        // We don't block the UI, but we'll cache it once loaded or on next visit
        fetch(src).then(response => {
          if (response.ok) cache.put(src, response);
        });
      }
      video.load();
    } catch (e) {
      console.warn("Cache API not supported or error:", e);
      video.src = src;
      video.load();
    }
  };

  const updateVideoSource = () => {
    const isMobile = window.innerWidth <= 768;
    const videoSrc = isMobile ? 'images/mobile-video.mp4?v=3.60' : 'images/web-video.mp4?v=3.60';
    const posterSrc = isMobile ? (video.getAttribute('data-mobile-poster') || 'images/web-video.webp') : 'images/web-video.webp';
    const currentSrc = video.getAttribute('data-last-src');

    if (currentSrc !== videoSrc) {
      console.log(`📱 Switching to ${isMobile ? 'mobile' : 'desktop'} video`);
      video.setAttribute('data-last-src', videoSrc);
      video.setAttribute('poster', posterSrc);
      loadAndCacheVideo(videoSrc);
    }
  };

  updateVideoSource();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateVideoSource, 300);
  });
}

// ================================================================
// PROPERTY FILTERS + PRICE SLIDER – APPLE-GRADE ANIMATIONS
// ================================================================
function initPropertyFilters() {
  const section = document.getElementById("listings");
  if (!section) return;

  // Global listener for dynamic content updates
  if (!window.filtersEventBound) {
    window.filtersEventBound = true;
    window.addEventListener("listingsLoaded", () => {
      console.log("🔄 Listings updated, re-initializing filters...");
      initPropertyFilters();
    });
  }

  const buttons = section.querySelectorAll(".property-gallery-filters .filter");
  const cards = [...section.querySelectorAll(".property-card:not(.no-results-card)")];
  const noResults = section.querySelector("#noResults");

  const minSlider = section.querySelector("#priceMin");
  const maxSlider = section.querySelector("#priceMax");
  const priceLabel = section.querySelector("#priceRangeValue");
  const rangeEl = section.querySelector(".slider-range-inline");

  if (!buttons.length || !cards.length || !minSlider || !maxSlider) return;

  if (!window.activeListingCategory) {
    window.activeListingCategory = "all";
  }
  if (!window.activeListingStatuses) {
    window.activeListingStatuses = [];
  }
  let isAnimating = false;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const formatPrice = v => {
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}m`;
    if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}k`;
    return `₱${v}`;
  };

  const clampSliders = (e) => {
    let min = +minSlider.value;
    let max = +maxSlider.value;
    const step = 1000000;

    if (min > max - step) {
      if (e?.target === minSlider) {
        maxSlider.value = Math.min(+maxSlider.max, min + step);
      } else {
        minSlider.value = Math.max(+minSlider.min, max - step);
      }
    }

    return {
      min: +minSlider.value,
      max: +maxSlider.value
    };
  };

  const updatePriceUI = (min, max) => {
    if (min === 0 && max === +maxSlider.max) {
      priceLabel.textContent = "Any Price";
    } else {
      priceLabel.textContent = `${formatPrice(min)} – ${formatPrice(max)}`;
    }

    const sliderMin = +minSlider.min;
    const sliderMax = +maxSlider.max;
    const range = sliderMax - sliderMin;

    const percentMin = ((min - sliderMin) / (range || 1)) * 100;
    const percentMax = ((max - sliderMin) / (range || 1)) * 100;

    rangeEl.style.left = `${percentMin}%`;
    rangeEl.style.width = `${percentMax - percentMin}%`;
  };

  // Toggle Status Filter
  const statusButtons = section.querySelectorAll(".filter-toggle");
  statusButtons.forEach(btn => {
    btn.onclick = () => {
      const status = btn.dataset.status;
      if (window.activeListingStatuses.includes(status)) {
        window.activeListingStatuses = window.activeListingStatuses.filter(s => s !== status);
        btn.classList.remove("active");
      } else {
        window.activeListingStatuses.push(status);
        btn.classList.add("active");
      }
      applyFilters();
    };
  });

  function applyFilters(animate = true, e = null) {
    if (isAnimating && animate) return;
    if (animate) isAnimating = true;

    const cards = [...section.querySelectorAll(".property-card:not(.no-results-card)")];
    const { min, max } = clampSliders(e);
    updatePriceUI(min, max);

    // Separate items into hide/show groups
    const toHide = [];
    const toShow = [];

    cards.forEach(card => {
      const category = card.dataset.category || "all";
      const status = card.dataset.status || "";
      const price = +card.dataset.price || 0;

      const categoryMatch = window.activeListingCategory === "all" || category.toLowerCase() === window.activeListingCategory.toLowerCase();
      const statusMatch = window.activeListingStatuses.length === 0 || window.activeListingStatuses.includes(status.toLowerCase());
      const priceMatch = (price >= min && price <= max) || (!price && min === 0);

      const shouldShow = categoryMatch && statusMatch && priceMatch;
      const isCurrentlyVisible = card.style.display !== "none";

      if (shouldShow && !isCurrentlyVisible) {
        toShow.push(card);
      } else if (!shouldShow && isCurrentlyVisible) {
        toHide.push(card);
      }
    });

    // Update no results message
    const count = cards.filter(card => {
      const category = card.dataset.category || "all";
      const price = +card.dataset.price || 0;
      const categoryMatch = window.activeListingCategory === "all" || category.toLowerCase() === window.activeListingCategory.toLowerCase();
      const priceMatch = (price >= min && price <= max) || (!price && min === 0);
      return categoryMatch && priceMatch;
    }).length;

    if (noResults) {
      noResults.style.display = count === 0 ? "block" : "none";
    }

    if (prefersReducedMotion || !animate) {
      // Instant toggle
      toHide.forEach(card => {
        card.style.display = "none";
        card.style.opacity = 0;
        card.classList.add("filtered-out");
      });
      toShow.forEach(card => {
        card.style.display = "";
        card.style.opacity = 1;
        card.style.transform = "none";
        card.classList.remove("filtered-out");
      });
      if (!animate) isAnimating = false; // Just in case
      isAnimating = false;
      return;
    }

    // Phase 1: Fade out hidden items (fast, simultaneous)
    if (toHide.length && window.gsap) {
      gsap.to(toHide, {
        opacity: 0,
        scale: 0.96,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          toHide.forEach(card => {
            card.style.display = "none";
            card.classList.add("filtered-out");
          });
          // Phase 2: Fade in new items (staggered, elegant)
          showItems();
        }
      });
    } else {
      showItems();
    }

    function showItems() {
      if (toShow.length && window.gsap) {
        // Prepare items for animation
        toShow.forEach(card => {
          card.style.display = "";
          card.classList.remove("filtered-out");
          gsap.set(card, { opacity: 0, scale: 0.94, y: 12 });
        });

        // Staggered fade-in with elegant easing
        gsap.to(toShow, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.5,
          stagger: {
            amount: 0.15,
            from: "start",
            ease: "power1.out"
          },
          ease: "power3.out",
          onComplete: () => {
            isAnimating = false;
          }
        });
      } else {
        isAnimating = false;
      }
    }
  }

  if (!window.filtersBound) {
    window.filtersBound = true;
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("active") || isAnimating) return;
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        window.activeListingCategory = btn.dataset.filter || "all";
        applyFilters(true);
      });
    });

    minSlider.addEventListener("input", (e) => applyFilters(false, e));
    maxSlider.addEventListener("input", (e) => applyFilters(false, e));
    minSlider.addEventListener("change", (e) => applyFilters(true, e));
    maxSlider.addEventListener("change", (e) => applyFilters(true, e));
  }

  // Initial Sync
  updatePriceUI(+minSlider.value, +maxSlider.value);

  cards.forEach(card => {
    const category = card.dataset.category || "all";
    const status = card.dataset.status || "";
    const price = +card.dataset.price || 0;
    const { min, max } = clampSliders();
    const statusMatch = window.activeListingStatuses.length === 0 || window.activeListingStatuses.includes(status.toLowerCase());
    const show = (window.activeListingCategory === "all" || category.toLowerCase() === window.activeListingCategory.toLowerCase()) && statusMatch && (price >= min && price <= max);
    card.style.display = show ? "" : "none";
    card.style.opacity = show ? 1 : 0;
    card.classList.toggle("filtered-out", !show);
  });
}

// Liquid glass mouse tracking for spatial effect
document.querySelectorAll('.container-glass').forEach(container => {
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    container.style.setProperty('--mouse-x', `${x}%`);
    container.style.setProperty('--mouse-y', `${y}%`);
  });

  container.addEventListener('mouseleave', () => {
    container.style.setProperty('--mouse-x', '50%');
    container.style.setProperty('--mouse-y', '20%');
  });
});

// ================================================================
// PROPERTY MODAL
// ================================================================
function initPropertyModal() {
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("propertyModal");
  const closeBtn = document.getElementById("modalClose");

  if (!overlay || !modal) return;

  // Only attach event listeners once
  if (!overlay.dataset.modalInit) {
    overlay.dataset.modalInit = "true";

    const img = document.getElementById("modalImage");
    const locationEl = document.getElementById("modalLocation");
    const typeEl = document.getElementById("modalType");
    const priceEl = document.getElementById("modalPrice");
    const bedsEl = document.getElementById("modalBeds");
    const bathsEl = document.getElementById("modalBaths");
    const sizeEl = document.getElementById("modalSize");
    const descEl = document.getElementById("modalDescription");
    const featuresEl = document.getElementById("modalFeatures");

    const open = () => {
      overlay.classList.add("open");
      modal.classList.add("open");
      toggleScrollLock(true);

      // NUCLEAR FORCE VISIBILITY
      overlay.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483.58 !important;";
      modal.style.cssText = "display: block !important; visibility: visible !important; opacity: 1 !important;";

      const modalContent = modal.querySelector(".modal-content");
      if (modalContent) {
        modalContent.scrollTop = 0;
      }

      if (window.gsap) {
        gsap.fromTo(modal,
          { opacity: 0, scale: 0.95, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    };

    const close = () => {
      overlay.classList.remove("open");
      modal.classList.remove("open");
      toggleScrollLock(false);

      // RESET NUCLEAR STYLES
      overlay.style.cssText = "";
      modal.style.cssText = "";
    };

    const formatPrice = v => {
      if (!v || isNaN(v)) return "Price on request";
      if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}m`;
      return `₱${v.toLocaleString()}`;
    };

    // Use DOCUMENT-level delegation to catch clicks even if grid loads late
    document.addEventListener("click", async (e) => {
      const card = e.target.closest(".property-card:not(.no-results-card)");
      if (!card) return;

      // 1. Check for Grid Like Button Click
      const gridLikeBtn = e.target.closest(".grid-like-btn");
      if (gridLikeBtn) {
        e.stopPropagation();
        const pid = gridLikeBtn.dataset.id;
        const currentlyLiked = localStorage.getItem(`liked_${pid}`);
        const isUnlike = !!currentlyLiked;

        // OPTIMISTIC UI: Update immediately for smoothness
        if (isUnlike) {
          localStorage.removeItem(`liked_${pid}`);
          gridLikeBtn.classList.remove('liked');
          gridLikeBtn.querySelector('i').className = 'far fa-heart';
          card.dataset.likes = Math.max(0, parseInt(card.dataset.likes || 0) - 1);
        } else {
          localStorage.setItem(`liked_${pid}`, "true");
          gridLikeBtn.classList.add('liked');
          gridLikeBtn.querySelector('i').className = 'fas fa-heart';
          card.dataset.likes = parseInt(card.dataset.likes || 0) + 1;
        }

        if (typeof window.trackLike === 'function') {
          // Fire and forget (sync will update eventually)
          window.trackLike(pid, isUnlike);
        }
        return;
      }

      // CRITICAL: Prevent card expansion on listings.html
      if (window.location.pathname.includes('listings.html')) {
        return;
      }

      // 2. Otherwise Open Modal
      if (e.target.closest("a, .grid-like-btn")) return;

      console.log("Opening modal for card data:", card.dataset);
      const propertyId = card.dataset.id;
      modal.dataset.currentId = propertyId;

      // Track Visit Immediately (Silent DB update)
      if (typeof window.trackVisit === 'function' && propertyId) {
        window.trackVisit(propertyId);
      }

      // 3. Carousel & Lightbox Logic
      const galleryData = JSON.parse(card.dataset.gallery || "[]");
      const thumbnailInfo = card.querySelector(".property-image img")?.src || "";

      // Build Slides (Thumbnail + Gallery)
      // Filter out duplicate thumbnail if it exists in gallery to clean up
      const rawSlides = [thumbnailInfo];
      galleryData.forEach(src => {
        if (src !== thumbnailInfo) rawSlides.push(src);
      });

      // Inject Carousel HTML (Include Clones for Smooth Loop)
      const imgContainer = modal.querySelector(".modal-image-container");
      if (imgContainer) {
        // PRE-LOAD: Set thumbnail as background immediately so there is no empty screen
        imgContainer.style.background = `url("${thumbnailInfo}") center/cover no-repeat`;

        const firstClone = rawSlides[0];
        const lastClone = rawSlides[rawSlides.length - 1];

        imgContainer.innerHTML = `
          <div class="modal-image-carousel">
            <div class="modal-carousel-track" id="modalCarouselTrack">
               ${rawSlides.length > 1 ? `<div class="modal-carousel-slide"><img src="${lastClone}" draggable="false" loading="lazy"></div>` : ''}
               ${rawSlides.map((src, idx) => `
                 <div class="modal-carousel-slide">
                    <img src="${src}" 
                         alt="Property Image" 
                         draggable="false" 
                         ${(idx === 0 || rawSlides.length === 1) ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'}
                         onload="this.style.opacity='1'"
                         style="${(idx === 0 || rawSlides.length === 1) ? 'opacity:1;' : 'opacity:0;'} transition: opacity 0.3s ease;">
                 </div>
               `).join('')}
               ${rawSlides.length > 1 ? `<div class="modal-carousel-slide"><img src="${firstClone}" draggable="false" loading="lazy"></div>` : ''}
            </div>
            ${rawSlides.length > 1 ? `
              <button class="modal-carousel-nav modal-carousel-prev" id="modalPrev"><i class="fas fa-chevron-left"></i></button>
              <button class="modal-carousel-nav modal-carousel-next" id="modalNext"><i class="fas fa-chevron-right"></i></button>
            ` : ''}
          </div>
        `;

        // Carousel Logic
        let currentIndex = rawSlides.length > 1 ? 1 : 0;
        let isTransitioning = false;
        const track = document.getElementById("modalCarouselTrack");
        const prevBtn = document.getElementById("modalPrev");
        const nextBtn = document.getElementById("modalNext");

        if (track && rawSlides.length > 1) {
          track.style.transform = `translateX(-100%)`;
        }

        const updateCarousel = (withTransition = true) => {
          if (!track) return;
          if (withTransition) {
            track.style.transition = "transform 0.4s ease-out";
          } else {
            track.style.transition = "none";
          }
          track.style.transform = `translateX(-${currentIndex * 100}%)`;
        };

        const handleNext = () => {
          if (isTransitioning || rawSlides.length <= 1) return;
          isTransitioning = true;
          currentIndex++;
          updateCarousel();
        };

        const handlePrev = () => {
          if (isTransitioning || rawSlides.length <= 1) return;
          isTransitioning = true;
          currentIndex--;
          updateCarousel();
        };

        if (track) {
          track.addEventListener("transitionend", () => {
            isTransitioning = false;
            if (currentIndex === 0) {
              currentIndex = rawSlides.length;
              updateCarousel(false);
            } else if (currentIndex === rawSlides.length + 1) {
              currentIndex = 1;
              updateCarousel(false);
            }
          });
        }

        if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); handlePrev(); });
        if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); handleNext(); });

        // Swipe Logic
        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
        const handleTouchEnd = (e) => {
          touchEndX = e.changedTouches[0].screenX;
          if (touchEndX < touchStartX - 50) handleNext();
          if (touchEndX > touchStartX + 50) handlePrev();
        };

        if (track) {
          track.addEventListener('touchstart', handleTouchStart, { passive: true });
          track.addEventListener('touchend', handleTouchEnd, { passive: true });
          track.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            if (img && window.openLightbox) window.openLightbox(img.src);
          });
        }
      }

      const location = card.getAttribute("data-address") || card.querySelector(".property-location")?.textContent || "";
      if (locationEl) locationEl.textContent = location;

      // CAPTURE ACTUAL TITLE FOR CALENDLY
      const realTitle = card.querySelector(".property-info.primary .property-location")?.textContent || location;
      modal.dataset.currentTitle = realTitle;

      // Handle Featured Ribbon
      // Handle Featured Logo
      const isFeatured = card.dataset.featured === "true";
      if (isFeatured) {
        const logoDiv = document.createElement("div");
        logoDiv.className = "property-logo property-logo-modal";
        const logoImg = document.createElement("img");
        logoImg.src = "images/homebuyer_dark2.png";
        logoImg.alt = "Paradise Life Homebuyer";
        logoDiv.appendChild(logoImg);
        // Re-append to container over carousel
        if (imgContainer) imgContainer.appendChild(logoDiv);
      }

      if (typeEl) typeEl.textContent = card.dataset.type || "";

      const displayedPrice = card.querySelector(".property-price")?.textContent.trim();
      if (priceEl) priceEl.textContent = displayedPrice || formatPrice(+card.dataset.price);

      if (bedsEl) bedsEl.textContent = card.dataset.beds || "-";
      if (bathsEl) bathsEl.textContent = card.dataset.baths || "-";
      if (sizeEl) sizeEl.textContent = card.dataset.size || "-";
      if (descEl) descEl.textContent = card.dataset.description || "";

      // Engagement Display Prep
      const visitsEl = document.getElementById("modalVisits");
      const likesEl = document.getElementById("modalLikes");
      const likeBtn = document.getElementById("modalLikeBtn");

      const updateLabels = (v, l, isLoading = false) => {
        const vCount = parseInt(v || 0);
        const lCount = parseInt(l || 0);

        if (visitsEl) {
          if (isLoading) {
            visitsEl.textContent = "...";
            visitsEl.classList.add('skeleton');
          } else {
            visitsEl.textContent = vCount;
            visitsEl.classList.remove('skeleton');
          }
        }

        if (likesEl) {
          if (isLoading) {
            likesEl.textContent = "...";
            likesEl.classList.add('skeleton');
          } else {
            likesEl.textContent = lCount;
            likesEl.classList.remove('skeleton');
          }
        }


        if (!isLoading) {
          const vLabel = document.getElementById("modalVisitsLabel");
          const lLabel = document.getElementById("modalLikesLabel");
          if (vLabel) vLabel.textContent = vCount === 1 ? 'visit' : 'visits';
          if (lLabel) lLabel.textContent = lCount === 1 ? 'like' : 'likes';

          // Color heart icon pink if there are likes (user feedback)
          const heartIconSpan = likesEl?.parentElement;
          if (heartIconSpan) {
            heartIconSpan.classList.toggle('liked', lCount > 0);
          }
        }
      };

      // Show skeleton loaders immediately
      updateLabels(0, 0, true);

      // Open modal immediately (don't wait for data)
      open();

      // Fetch live data in background
      if (typeof window.getLatestEngagement === 'function' && propertyId) {
        window.getLatestEngagement(propertyId).then(data => {
          if (data) {
            card.dataset.likes = data.likes;
            card.dataset.visits = data.visits;
            updateLabels(data.visits, data.likes, false);
          } else {
            // Fallback to card data
            updateLabels(card.dataset.visits, card.dataset.likes, false);
          }
        });
      } else {
        // Fallback to card data if function not available
        updateLabels(card.dataset.visits, card.dataset.likes, false);
      }

      if (likeBtn && propertyId) {
        const syncGridBtn = (isLiked) => {
          const gBtn = card.querySelector(".grid-like-btn");
          if (gBtn) {
            if (isLiked) {
              gBtn.classList.add('liked');
              gBtn.querySelector('i').className = 'fas fa-heart';
            } else {
              gBtn.classList.remove('liked');
              gBtn.querySelector('i').className = 'far fa-heart';
            }
          }
        };

        const updateLikeUI = (isLiked) => {
          if (isLiked) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
          } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
          }
          syncGridBtn(isLiked);
        };

        updateLikeUI(localStorage.getItem(`liked_${propertyId}`));

        likeBtn.onclick = () => {
          const currentlyLiked = localStorage.getItem(`liked_${propertyId}`);
          const isUnlike = !!currentlyLiked;

          // OPTIMISTIC UI: Update immediately
          if (isUnlike) {
            localStorage.removeItem(`liked_${propertyId}`);
            card.dataset.likes = Math.max(0, parseInt(card.dataset.likes || 0) - 1);
          } else {
            localStorage.setItem(`liked_${propertyId}`, "true");
            card.dataset.likes = parseInt(card.dataset.likes || 0) + 1;
          }

          updateLikeUI(!isUnlike);
          updateLabels(card.dataset.visits, card.dataset.likes);

          if (typeof window.trackLike === 'function') {
            window.trackLike(propertyId, isUnlike);
          }
        };
      }

      if (featuresEl) {
        featuresEl.innerHTML = "";
        const features = card.dataset.features?.split("|") || [];
        features.forEach(f => {
          if (f.trim()) {
            const li = document.createElement("li");
            li.textContent = f.trim();
            featuresEl.appendChild(li);
          }
        });
      }
      open();
    });

    closeBtn?.addEventListener("click", close);

    overlay.addEventListener("click", e => {
      if (e.target === overlay) close();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });

    overlay.addEventListener("click", e => {
      const link = e.target.closest("a[href^='#']");
      if (link && overlay.classList.contains("open")) {
        close();
      }
    });
    // CLICK LISTENER FOR SCHEDULE BUTTON
    const scheduleBtn = document.getElementById("scheduleCallBtn");
    if (scheduleBtn) {
      scheduleBtn.onclick = () => {
        close();
        const title = modal.dataset.currentTitle || (locationEl ? locationEl.textContent : "Property");
        const widget = document.querySelector(".calendly-inline-widget");
        if (widget) {
          const baseUrl = "https://calendly.com/empyreanlistings?text_color=000000&primary_color=12a7b8&embed_domain=empyreanlistings.com&embed_type=Inline";
          const prefillUrl = `${baseUrl}&a1=${encodeURIComponent('Interest in: ' + title)}`;

          // Update data-url for future reloads (though Calendly script might consume it once)
          widget.setAttribute("data-url", prefillUrl);

          // Force reload the iframe
          const iframe = widget.querySelector("iframe");
          if (iframe) {
            iframe.src = prefillUrl;
          } else {
            // If iframe not yet generated, re-init might be needed, but usually it is there by now.
            // If not, the script picking up the data-url change is cleaner if we could trigger it, 
            // but modifying src is the most direct way for an existing iframe.
          }
        }
      };
    }

    // EMAIL CHOICE MODAL
    // Inject Modal HTML
    const modalHTML = `
      <div id="emailModalOverlay">
        <div class="email-modal-card">
          <button class="email-modal-close" aria-label="Close">&times;</button>
          <h3>Contact Us</h3>
          <p>Choose how you'd like to send your email.</p>
          <div class="email-options">
            <button id="btnDefaultMail" class="email-btn btn-default-mail">
              <i class="fas fa-envelope"></i> Default Mail App
            </button>
            <button id="btnGmail" class="email-btn btn-gmail">
              <i class="fab fa-google"></i> Gmail (Web)
            </button>
            <button id="btnCopyEmail" class="email-btn btn-copy">
              <i class="fas fa-copy"></i> Copy Email Address
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const emailModalEl = document.getElementById("emailModalOverlay");
    const emailCloseBtn = emailModalEl.querySelector(".email-modal-close");
    const emailDefaultBtn = document.getElementById("btnDefaultMail");
    const emailGmailBtn = document.getElementById("btnGmail");
    const emailCopyBtn = document.getElementById("btnCopyEmail");

    let currentMailto = "";

    const closeEmailModal = () => {
      emailModalEl.classList.remove("open");
      emailCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Email Address';
    };

    // Close listeners
    emailCloseBtn.onclick = closeEmailModal;
    emailModalEl.onclick = (e) => {
      if (e.target === emailModalEl) closeEmailModal();
    };

    // INTERCEPT MAILTO CLICKS
    document.addEventListener("click", (e) => {
      const mailto = e.target.closest('a[href^="mailto:"]');
      if (mailto) {
        e.preventDefault();
        e.stopPropagation();
        currentMailto = mailto.getAttribute('href');
        emailModalEl.classList.add("open");
      }
    }, true);

    // Detect Mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // ACTION HANDLERS

    // 1. Defaut Mail App
    emailDefaultBtn.onclick = () => {
      if (!currentMailto) return;

      // On mobile, a direct click on a hidden anchor is often more reliable
      const link = document.createElement('a');
      link.href = currentMailto;
      link.target = '_self';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(closeEmailModal, 800);
    };

    // 2. Gmail (Handles app vs web better)
    emailGmailBtn.onclick = () => {
      if (!currentMailto) return;

      const parts = currentMailto.split('?');
      const email = parts[0].replace("mailto:", "");
      const params = new URLSearchParams(parts[1] || "");

      const subject = params.get("subject") || "";
      const cc = params.get("cc") || "";
      const body = params.get("body") || "";

      if (isMobile) {
        // Try to trigger the app if possible, or stay with mailto but specifically for Gmail
        // Most mobile OSs will handle a standard mailto better if we don't force a URL
        // But for "Gmail" button specifically, we'll try the web approach which often redirects to app
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
      } else {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
      }
      closeEmailModal();
    };

    // 3. Copy Email
    emailCopyBtn.onclick = async () => {
      if (!currentMailto) return;
      const email = currentMailto.split('?')[0].replace("mailto:", "");

      try {
        await navigator.clipboard.writeText(email);
        emailCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(closeEmailModal, 1200);
      } catch (err) {
        console.error('Failed to copy', err);
        const input = document.createElement('input');
        input.value = email;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        emailCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(closeEmailModal, 1200);
      }
    };
  }
}

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash) {
    const hash = window.location.hash;
    const target = document.querySelector(hash);
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'auto' });
        history.replaceState(null, null, ' ');
      }, 100);
    } else {
      history.replaceState(null, null, ' ');
    }
  }
  safeInit("applySavedTheme", applySavedTheme);
  safeInit("bindThemeToggles", bindThemeToggles);
  safeInit("initScrollbarBehavior", initScrollbarBehavior);
  safeInit("Responsive Video", initResponsiveVideo);
  safeInit("initializeApp", initializeApp);
});

function initializeApp() {
  if (typeof initHeader !== 'undefined') safeInit("Header", initHeader);
  if (typeof initAnimations !== 'undefined') safeInit("Animations", initAnimations);
  // Carousel logic moved to animations.js to sync with hero sequence
  // Gallery initialization moved to gallery.js
  if (typeof window.initGallery !== 'undefined') safeInit("Gallery", window.initGallery);
  if (typeof initPropertyFilters !== 'undefined') safeInit("Property Filters", initPropertyFilters);
  if (typeof initPropertyModal !== 'undefined') safeInit("Property Modal", initPropertyModal);
  if (typeof initHowItWorks !== 'undefined') safeInit("How It Works", initHowItWorks);
  if (typeof initServices !== 'undefined') safeInit("Services", initServices);
  // Initialize Firebase Galleries (Data Sync)
  if (typeof window.initDynamicGallery !== 'undefined') safeInit("Dynamic Gallery (Firebase)", window.initDynamicGallery);
  if (typeof window.initPalawanGalleryFirebase !== 'undefined') safeInit("Palawan Gallery (Firebase)", window.initPalawanGalleryFirebase);

  // Initialize Scroll/Lightbox Logic
  if (typeof initPalawanGallery !== 'undefined') safeInit("Palawan Gallery (Scroll/Lightbox)", initPalawanGallery);
  // Lightbox handled in gallery.js
  if (typeof initCalendly !== 'undefined') safeInit("Calendly", initCalendly);
  loadComponent("#header-placeholder", "header.html", () => {
    // Unwrap the header to ensure it sits directly on the body for full width
    const placeholder = document.getElementById("header-placeholder");
    if (placeholder && placeholder.firstElementChild) {
      placeholder.replaceWith(...placeholder.childNodes);
    }
    // Re-init header logic after dynamic load
    if (typeof initHeader !== 'undefined') initHeader();
    // Sync theme UI (icons/logos) for new header elements
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    if (window.syncThemeUI) window.syncThemeUI(currentTheme);
    console.log("✅ Header Loaded & Unwrapped");
  });
  loadComponent("#homebuyer-placeholder", "homebuyerRC.html", () => {
    if (typeof initHowItWorks !== 'undefined') safeInit("How It Works", initHowItWorks);
  });
  loadComponent("#listings-placeholder", "propertylistingsRC.html", () => {
    if (typeof initPropertyFilters !== 'undefined') safeInit("Property Filters", initPropertyFilters);
    // Notify firebase-listings that the grid is ready
    window.dispatchEvent(new Event("listingsGridReady"));
  });
  loadComponent("#propertymodal-placeholder", "propertymodalRC.html", () => {
    if (typeof initPropertyModal !== 'undefined') safeInit("Property Modal", initPropertyModal);
  });
  loadComponent("#contact-row-placeholder", "contactRC.html");
  loadComponent("#footer-placeholder", "footerRC.html", () => {
    // Unwrap the footer to ensure it sits directly on the body for full width
    const placeholder = document.getElementById("footer-placeholder");
    if (placeholder && placeholder.firstElementChild) {
      placeholder.replaceWith(...placeholder.childNodes);
    }
    console.log("✅ Footer Loaded & Unwrapped");
  });
  loadComponent("#fabs-placeholder", "fabsRC.html");
  loadComponent("#gallery-modal-placeholder", "galleryModalRC.html");
}

/**
 * Helper to fetch and inject HTML components
 */
async function loadComponent(selector, url, callback) {
  const container = document.querySelector(selector);
  if (!container) return;

  try {
    const response = await fetch(`${url}?v=3.60`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    container.innerHTML = html;
    console.info(`✅ Component loaded: ${url}`);

    // Execute callback if provided
    if (typeof callback === 'function') {
      callback();
    }

    // Dispatch event to re-init scripts that might need to target new elements
    window.dispatchEvent(new Event("componentLoaded"));
  } catch (err) {
    console.error(`❌ Failed to load component: ${url}`, err);
  }
}

// ================================================================
// THEME SYSTEM
// ================================================================
function applySavedTheme() {
  const theme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
}

window.syncThemeUI = function (theme) {
  // 1. Update Icons
  document.querySelectorAll(".theme-toggle .theme-icon").forEach(icon => {
    icon.className = theme === "dark" ? "theme-icon fas fa-sun" : "theme-icon fas fa-moon";
  });

  // 2. Update Logos
  const logos = {
    light: "images/logo_light.png",
    dark: "images/logo_dark.png"
  };

  // Main nav logo
  const navLogo = document.querySelector(".logo-container img");
  if (navLogo) navLogo.src = theme === "dark" ? logos.dark : logos.light;

  // Dashboard logo
  const dashLogo = document.getElementById("dashLogo");
  if (dashLogo) dashLogo.src = theme === "dark" ? logos.dark : logos.light;

  // Login/Signup/Reset logo
  const loginLogo = document.getElementById("loginLogo");
  if (loginLogo) loginLogo.src = theme === "dark" ? logos.dark : logos.light;

  // Mobile menu logo
  const mobileLogo = document.querySelector(".mobile-menu img");
  if (mobileLogo) mobileLogo.src = theme === "dark" ? logos.dark : logos.light;
};

function bindThemeToggles() {
  if (document.documentElement.dataset.themeBound) return;
  document.documentElement.dataset.themeBound = "true";

  // Initial sync
  const initialTheme = document.documentElement.getAttribute("data-theme") || localStorage.getItem("theme") || "dark";
  window.syncThemeUI(initialTheme);

  // Use event delegation for dynamic theme toggles
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-toggle");
    if (!btn) return;

    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);

    window.syncThemeUI(next);
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  });
}

// Auto-init on script load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindThemeToggles);
} else {
  bindThemeToggles();
}

// ================================================================
// SCROLLBAR BEHAVIOR
// ================================================================
function initScrollbarBehavior() {
  if (window.innerWidth < 769 || document.documentElement.dataset.scrollbarInit) return;
  document.documentElement.dataset.scrollbarInit = "true";

  let t;
  window.addEventListener(
    "scroll",
    () => {
      document.documentElement.classList.add("scrolling");
      clearTimeout(t);
      t = setTimeout(() => {
        document.documentElement.classList.remove("scrolling");
      }, 800);
    },
    { passive: true }
  );
}

// ================================================================
// NAV + HEADER + SCROLL PROGRESS + MOBILE MENU (FIXED)

// DEPRECATED: initAnimations functionality moved to assets/js/animations.js
// Removed to prevent synchronization conflicts between Hero Video and Carousel.


// ================================================================
// PALAWAN GALLERY LIGHTBOX
// ================================================================
function initPalawanGallery() {
  const items = document.querySelectorAll(".palawan-gallery .gallery-item");
  if (!items.length) return;

  const lightbox = document.getElementById("palawan-lightbox");
  const img = document.getElementById("palawan-lightbox-img");
  const caption = lightbox?.querySelector(".lightbox-caption");
  const prevBtn = lightbox?.querySelector(".lightbox-prev");
  const nextBtn = lightbox?.querySelector(".lightbox-next");

  if (!lightbox || !img) return;

  let currentIndex = 0;

  const open = i => {
    // Loop index
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;

    currentIndex = i;
    const el = items[currentIndex];

    img.src = el.querySelector("img")?.src || "";
    img.alt = el.querySelector("img")?.alt || "Palawan gallery image";
    caption && (caption.innerHTML = el.querySelector(".gallery-overlay")?.innerHTML || "");

    // Remove inert/aria-hidden BEFORE adding open class to prevent focus issues
    lightbox.removeAttribute("inert");
    lightbox.removeAttribute("aria-hidden");
    lightbox.classList.add("open");
    document.body.classList.add("lightbox-open");
    toggleScrollLock(true);
  };

  const close = () => {
    lightbox.classList.remove("open");
    document.body.classList.remove("lightbox-open");
    toggleScrollLock(false);

    // Add inert and aria-hidden AFTER removing open class
    setTimeout(() => {
      if (!lightbox.classList.contains("open")) {
        lightbox.setAttribute("inert", "");
        lightbox.setAttribute("aria-hidden", "true");
      }
    }, 300);
  };

  const showPrev = () => {
    open(currentIndex - 1);
  };

  const showNext = () => {
    open(currentIndex + 1);
  };

  items.forEach((item, i) => {
    const imgEl = item.querySelector("img");
    if (imgEl) {
      imgEl.addEventListener("click", () => open(i));
    }
  });

  lightbox.addEventListener("click", e => {
    if (e.target === lightbox || e.target === img) close();
  });

  // Navigation buttons
  prevBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    showPrev();
  });

  nextBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    showNext();
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;

    switch (e.key) {
      case "Escape":
        close();
        break;
      case "ArrowLeft":
        showPrev();
        break;
      case "ArrowRight":
        showNext();
        break;
    }
  });

  // Prevent double-initialization
  lightbox.dataset.initialized = "true";
}


// ================================================================
// SERVICES — DATA-DRIVEN TAB SYSTEM (PERFORMANCE OPTIMIZED)
// ================================================================
const servicesData = [
  {
    title: "Real Estate Brokerage",
    subtitle: "Professional Buying, Selling & Leasing across the Philippines.",
    description: `We navigate the complexity of the Philippine real estate market with transparency and accountability. Whether you are buying, selling, or leasing, our licensed brokers ensure a seamless, results-oriented experience.`,
    image: "images/web-video.webp"
  },
  {
    title: "Project Selling",
    subtitle: "Exclusive Marketing for Premier Developments.",
    description: `Representing choice developments across the country, we provide investors and home buyers with vetted, high-quality opportunities in high-growth prime zones.`,
    image: "images/web-video.webp"
  },
  {
    title: "Property Resales",
    subtitle: "Expertly Marketing Your Pre-owned Property.",
    description: `We connect your property to an extensive global network of qualified buyers, managing the entire transaction from valuation to closing with professional excellence.`,
    image: "images/web-video.webp"
  },
  {
    title: "Leasing Solutions",
    subtitle: "End-to-End Residential & Commercial Leasing.",
    description: `From tenant vetting to contract management and collection, we maximize your property's yield while ensuring a hands-free experience for owners.`,
    image: "images/web-video.webp"
  },
  {
    title: "Home Improvements",
    subtitle: "Enhancing Your Property's Value & Comfort.",
    description: `Upgrade your living space with modern solar systems, smart-home integration, swimming pools, or structural additions that respect the local environment and increase value.`,
    image: "images/web-video.webp"
  },
  {
    title: "Project Planning",
    subtitle: "Pre-Construction Design & Documentation.",
    description: `Our engineering and design experts handle zoning, permits, and architectural planning to ensure your dream project starts on a compliant and solid foundation.`,
    image: "images/web-video.webp"
  },
  {
    title: "Construction Services",
    subtitle: "Durable, Sustainable Building Excellence.",
    description: `Specializing in professional, high-standard construction of off-grid enabled homes and commercial spaces using modern engineering techniques tailored for the tropics.`,
    image: "images/web-video.webp"
  },
  {
    title: "Renovations",
    subtitle: "Revitalize & Transform Existing Spaces.",
    description: `Transforming older properties into modern sanctuaries with high-quality finishes and structural upgrades that meet today's aesthetic and functional standards.`,
    image: "images/web-video.webp"
  }
];

function initServices() {
  const nav = document.getElementById('services-nav');
  const display = document.getElementById('services-display');

  if (!nav || !display || !servicesData.length) return;

  const btns = nav.querySelectorAll('.nav-btn');
  let currentIndex = 1; // Start at 1 because of clone
  let autoplayTimer = null;
  let isTransitioning = false;

  // Build Carousel Structure (Clone Last -> Start, First -> End)
  const firstClone = servicesData[0];
  const lastClone = servicesData[servicesData.length - 1];
  const renderSlide = (data, idx, isClone = false) => `
    <div class="carousel-slide" ${isClone ? 'aria-hidden="true"' : ''}>
      <img class="card-image" src="${data.image}" alt="${data.title}" loading="lazy">
      <div class="card-content">
        <h2 class="expanded-title">${data.title}</h2>
        <p>${data.subtitle}</p>
        <p>${data.description}</p>
        <span class="card-cta">Find out more</span>
      </div>
    </div>
  `;

  display.innerHTML = `
    <button class="card-nav card-nav-left" aria-label="Previous service"></button>
    <div class="carousel-container">
      <div class="carousel-track">
        ${renderSlide(lastClone, -1, true)}
        ${servicesData.map((d, i) => renderSlide(d, i)).join('')}
        ${renderSlide(firstClone, servicesData.length, true)}
      </div>
    </div>
    <button class="card-nav card-nav-right" aria-label="Next service"></button>
  `;

  const track = display.querySelector('.carousel-track');
  const slides = display.querySelectorAll('.carousel-slide');
  const cardContent = display.querySelectorAll('.card-content');

  // Set initial position (showing real slide 1)
  track.style.transform = `translateX(-100%)`;

  function updateNav(realIndex) {
    btns.forEach(b => b.classList.remove('active'));
    // realIndex is 0-based index of data
    const activeBtn = Array.from(btns).find(b => parseInt(b.dataset.index) === realIndex);
    if (activeBtn) {
      activeBtn.classList.add('active');
      if (window.innerWidth <= 768) {
        activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      }
    }
  }

  function goToSlide(index) {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex = index;

    track.style.transition = 'transform 0.5s ease-in-out';
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Calculate "Real" index for Nav
    let realIndex = currentIndex - 1;
    if (realIndex < 0) realIndex = servicesData.length - 1;
    if (realIndex >= servicesData.length) realIndex = 0;
    updateNav(realIndex);
  }

  // Handle Infinite Loop Reset
  track.addEventListener('transitionend', () => {
    isTransitioning = false;
    if (currentIndex === 0) {
      track.style.transition = 'none';
      currentIndex = servicesData.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }
    if (currentIndex === servicesData.length + 1) {
      track.style.transition = 'none';
      currentIndex = 1;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }
  });

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 5000);
  }

  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
  }

  // Events
  display.querySelector('.card-nav-left').onclick = () => {
    if (isTransitioning) return;
    goToSlide(currentIndex - 1);
    startAutoplay();
  };
  display.querySelector('.card-nav-right').onclick = () => {
    if (isTransitioning) return;
    goToSlide(currentIndex + 1);
    startAutoplay();
  };

  btns.forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index); // 0-based
      if (!isNaN(idx)) {
        goToSlide(idx + 1); // +1 because of clone
        startAutoplay();
      }
    };
  });

  // Pause on hover
  cardContent.forEach(content => {
    content.onmouseenter = stopAutoplay;
    content.onmouseleave = startAutoplay;
  });

  // Initial State is already set by HTML structure + initial transform
  startAutoplay();
}

// ================================================================
// ================================================================
// HOW IT WORKS — DATA-DRIVEN TAB SYSTEM
// ================================================================
const howItWorksData = [
  {
    title: "Verified Titles",
    subtitle: "Legal & Secure Property Ownership in Paradise.",
    description: `We provide complete transparency with fully verified titles and ownership documentation. Our team handles the legal heavy lifting to ensure your investment is safe, compliant, and permanent.`,
    image: "images/web-video.webp"
  },
  {
    title: "Prime Locations",
    subtitle: "Scouting High-Growth, Scenic Real Estate.",
    description: `Specializing in prime Palawan areas like El Nido, we site our developments in high-growth zones with stunning beach access and limestone views, ensuring long-term value appreciation.`,
    image: "images/web-video.webp"
  },
  {
    title: "Solar-Ready Living",
    subtitle: "Eco-Friendly Homes with Off-Grid Capacity.",
    description: `Our homes are designed for modern sustainability, featuring robust off-grid solar systems that provide reliable, clean energy so you never have to worry about power outages or utility bills.`,
    image: "images/web-video.webp"
  },
  {
    title: "Progress Payments",
    subtitle: "Safe, Milestone-Based Financial Transparency.",
    description: `Pay with confidence through our verified milestone payment system. Installments are tied directly to construction progress, with clear digital tracking and compliance receipts.`,
    image: "images/web-video.webp"
  },
  {
    title: "Turn-Key Finish",
    subtitle: "All-Inclusive Homes, Ready for Your Arrival.",
    description: `Your home comes fully equipped with premium appliances and high-quality tropical furnishings. From landscaping to fine interior details, everything is handled so you can just turn the key.`,
    image: "images/web-video.webp"
  },
  {
    title: "Secure Land Leases",
    subtitle: "Reliable Solutions for International Buyers.",
    description: `We facilitate secure Long-Term Land Leases for non-nationals, providing a legal and reliable path to enjoying your own piece of paradise with full protection and peace of mind.`,
    image: "images/web-video.webp"
  },
  {
    title: "Brokerage Access",
    subtitle: "Direct Connection to Global Sales & Leasing.",
    description: `As a licensed brokerage, we provide direct access to an established network of buyers and tenants, ensuring your property is professionally marketed and easily liquid if needed.`,
    image: "images/web-video.webp"
  },
  {
    title: "Property Management",
    subtitle: "Professional Care while you are away.",
    description: `Our dedicated team handles maintenance, inspections, landscaping, and holiday rental operations so your property is always pristine and yielding potential returns.`,
    image: "images/web-video.webp"
  }
];

function initHowItWorks() {
  const nav = document.getElementById('how-it-works-nav');
  const display = document.getElementById('how-it-works-display');

  if (!nav || !display || !howItWorksData.length) return;

  const btns = nav.querySelectorAll('.nav-btn');
  let currentIndex = 1; // Start at 1
  let autoplayTimer = null;
  let isTransitioning = false;

  // Build Carousel Structure (Clone Last -> Start, First -> End)
  const firstClone = howItWorksData[0];
  const lastClone = howItWorksData[howItWorksData.length - 1];
  const renderSlide = (data, idx, isClone = false) => `
    <div class="carousel-slide" ${isClone ? 'aria-hidden="true"' : ''}>
      <img class="card-image" src="${data.image}" alt="${data.title}" loading="lazy">
      <div class="card-content">
        <h2 class="expanded-title">${data.title}</h2>
        <p>${data.subtitle}</p>
        <p>${data.description}</p>
        <span class="card-cta">Find out more</span>
      </div>
    </div>
  `;

  display.innerHTML = `
    <button class="card-nav card-nav-left" aria-label="Previous step"></button>
    <div class="carousel-container">
      <div class="carousel-track">
        ${renderSlide(lastClone, -1, true)}
        ${howItWorksData.map((d, i) => renderSlide(d, i)).join('')}
        ${renderSlide(firstClone, howItWorksData.length, true)}
      </div>
    </div>
    <button class="card-nav card-nav-right" aria-label="Next step"></button>
  `;

  const track = display.querySelector('.carousel-track');
  const slides = display.querySelectorAll('.carousel-slide');
  const cardContent = display.querySelectorAll('.card-content');

  // Set initial position
  track.style.transform = `translateX(-100%)`;

  function updateNav(realIndex) {
    btns.forEach(b => b.classList.remove('active'));
    // realIndex is 0-based index of data
    const activeBtn = Array.from(btns).find(b => parseInt(b.dataset.index) === realIndex);
    if (activeBtn) {
      activeBtn.classList.add('active');
      if (window.innerWidth <= 768) {
        activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      }
    }
  }

  function goToSlide(index) {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex = index;

    track.style.transition = 'transform 0.5s ease-in-out';
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Calculate "Real" index for Nav
    let realIndex = currentIndex - 1;
    if (realIndex < 0) realIndex = howItWorksData.length - 1;
    if (realIndex >= howItWorksData.length) realIndex = 0;
    updateNav(realIndex);
  }

  // Handle Infinite Loop Reset
  track.addEventListener('transitionend', () => {
    isTransitioning = false;
    if (currentIndex === 0) {
      track.style.transition = 'none';
      currentIndex = howItWorksData.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }
    if (currentIndex === howItWorksData.length + 1) {
      track.style.transition = 'none';
      currentIndex = 1;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }
  });

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 5000);
  }

  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
  }

  // Events
  display.querySelector('.card-nav-left').onclick = () => {
    if (isTransitioning) return;
    goToSlide(currentIndex - 1);
    startAutoplay();
  };
  display.querySelector('.card-nav-right').onclick = () => {
    if (isTransitioning) return;
    goToSlide(currentIndex + 1);
    startAutoplay();
  };

  btns.forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index); // 0-based
      if (!isNaN(idx)) {
        goToSlide(idx + 1); // +1 because of clone
        startAutoplay();
      }
    };
  });

  // Pause on hover
  cardContent.forEach(content => {
    content.onmouseenter = stopAutoplay;
    content.onmouseleave = startAutoplay;
  });

  // Initial State
  startAutoplay();
}

// ================================================================
// CALENDLY
// ================================================================
function initCalendly() {
  const widget = document.querySelector(".calendly-inline-widget");
  if (!widget) return;

  const wait = setInterval(() => {
    if (window.Calendly?.initInlineWidgets) {
      window.Calendly.initInlineWidgets();
      clearInterval(wait);
    }
  }, 100);
}

// ================================================================
// EXPOSE FOR DEBUGGING
// ================================================================
window.safeInit = safeInit;
window.withGSAP = withGSAP;
window.withFlip = withFlip;
// ================================================================
// LIGHTBOX
// ================================================================
function initLb() {
  if (document.getElementById("lightboxOverlay")) return;

  const lb = document.createElement("div");
  lb.id = "lightboxOverlay";
  lb.className = "lightbox-overlay";
  lb.innerHTML = `
    <button class="closeModalDefault" id="lbClose"><i class="fas fa-times"></i></button>
    <img class="lightbox-image" id="lbImage" src="" alt="Full Screen View">
  `;
  document.body.appendChild(lb);

  const closeBtn = document.getElementById("lbClose");
  const img = document.getElementById("lbImage");

  window.openLightbox = (src) => {
    if (!src) return;
    img.src = src;
    lb.classList.add("open");
    // Ensure body scroll lock works with previous logic
    if (window.lockScroll) window.lockScroll();
    else document.body.style.overflow = "hidden";
  };

  const closeLb = () => {
    lb.classList.remove("open");
    setTimeout(() => {
      if (!lb.classList.contains("open")) {
        img.src = "";
        document.body.style.overflow = ""; // Unlock scroll
      }
    }, 300);
  };

  closeBtn.addEventListener("click", closeLb);
  lb.addEventListener("click", (e) => {
    if (e.target === lb) closeLb();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lb.classList.contains("open")) {
      closeLb();
    }
  });
}

// Init Lightbox
initLb();
