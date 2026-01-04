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
    const videoSrc = isMobile ? 'images/mobile-video.mp4' : 'images/web-video.mp4';
    const currentSrc = video.getAttribute('data-last-src');

    if (currentSrc !== videoSrc) {
      console.log(`📱 Switching to ${isMobile ? 'mobile' : 'desktop'} video`);
      video.setAttribute('data-last-src', videoSrc);
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
  if (!section || section.dataset.filtersInit) return;
  section.dataset.filtersInit = "true";

  const buttons = section.querySelectorAll(".property-gallery-filters .filter");
  const cards = [...section.querySelectorAll(".property-card:not(.no-results-card)")];
  const noResults = section.querySelector("#noResults");

  const minSlider = section.querySelector("#priceMin");
  const maxSlider = section.querySelector("#priceMax");
  const priceLabel = section.querySelector("#priceRangeValue");
  const rangeEl = section.querySelector(".slider-range-inline");

  if (!buttons.length || !cards.length || !minSlider || !maxSlider) return;

  let activeCategory = "all";
  let isAnimating = false;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const formatPrice = v => {
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}m`;
    if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}k`;
    return `₱${v}`;
  };

  const clampSliders = () => {
    let min = +minSlider.value;
    let max = +maxSlider.value;

    if (min > max - 500000) minSlider.value = max - 500000;
    if (max < min + 500000) maxSlider.value = min + 500000;

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

    const percentMin = ((min - sliderMin) / range) * 100;
    const percentMax = ((max - sliderMin) / range) * 100;

    rangeEl.style.left = `${percentMin}%`;
    rangeEl.style.width = `${percentMax - percentMin}%`;
  };

  function applyFilters() {
    if (isAnimating) return;
    isAnimating = true;

    const { min, max } = clampSliders();
    updatePriceUI(min, max);

    // Separate items into hide/show groups
    const toHide = [];
    const toShow = [];

    cards.forEach(card => {
      const category = card.dataset.category;
      const price = +card.dataset.price || 0;
      const categoryMatch = activeCategory === "all" || category === activeCategory;
      const priceMatch = price >= min && price <= max;
      const shouldShow = categoryMatch && priceMatch;
      const isCurrentlyVisible = card.style.display !== "none";

      if (shouldShow && !isCurrentlyVisible) {
        toShow.push(card);
      } else if (!shouldShow && isCurrentlyVisible) {
        toHide.push(card);
      }
    });

    // Update no results message
    const visibleCount = cards.filter(c => !toHide.includes(c) && (toShow.includes(c) || c.style.display !== "none")).length;
    if (noResults) {
      noResults.style.display = visibleCount ? "none" : "block";
    }

    if (prefersReducedMotion) {
      // Instant toggle for reduced motion
      toHide.forEach(card => {
        card.style.display = "none";
        card.classList.add("filtered-out");
      });
      toShow.forEach(card => {
        card.style.display = "";
        card.classList.remove("filtered-out");
      });
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

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active") || isAnimating) return;
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      activeCategory = btn.dataset.filter || "all";
      applyFilters();
    });
  });

  ["input", "change"].forEach(evt => {
    minSlider.addEventListener(evt, applyFilters);
    maxSlider.addEventListener(evt, applyFilters);
  });

  updatePriceUI(+minSlider.value, +maxSlider.value);

  cards.forEach(card => {
    const category = card.dataset.category;
    const price = +card.dataset.price || 0;
    const show = activeCategory === "all" || category === activeCategory;
    card.style.display = show ? "" : "none";
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
      document.body.style.overflow = "hidden";

      // NUCLEAR FORCE VISIBILITY
      overlay.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important;";
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
      document.body.style.overflow = "";

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

        if (typeof window.trackLike === 'function') {
          const success = await window.trackLike(pid, isUnlike);
          if (success) {
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
          }
        }
        return;
      }

      // 2. Otherwise Open Modal
      if (e.target.closest("a, .grid-like-btn")) return;

      console.log("Opening modal for card data:", card.dataset);
      const propertyId = card.dataset.id;

      // Track Visit Immediately (Silent DB update)
      if (typeof window.trackVisit === 'function' && propertyId) {
        window.trackVisit(propertyId);
      }

      const image = card.querySelector(".property-image img")?.src || "";
      if (img) {
        img.src = image;
        img.alt = card.querySelector("img")?.alt || "Property image";
      }

      const location = card.getAttribute("data-address") || card.querySelector(".property-location")?.textContent || "";
      if (locationEl) locationEl.textContent = location;

      // CAPTURE ACTUAL TITLE FOR CALENDLY
      // The card has two .property-location elements. The first one inside .property-info.primary is the title.
      // The second one is the short description (location).
      const realTitle = card.querySelector(".property-info.primary .property-location")?.textContent || location;
      modal.dataset.currentTitle = realTitle;

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

        likeBtn.onclick = async () => {
          const currentlyLiked = localStorage.getItem(`liked_${propertyId}`);
          const isUnlike = !!currentlyLiked;
          if (typeof window.trackLike === 'function') {
            const success = await window.trackLike(propertyId, isUnlike);
            if (success) {
              if (isUnlike) {
                localStorage.removeItem(`liked_${propertyId}`);
                card.dataset.likes = Math.max(0, parseInt(card.dataset.likes || 0) - 1);
              } else {
                localStorage.setItem(`liked_${propertyId}`, "true");
                card.dataset.likes = parseInt(card.dataset.likes || 0) + 1;
              }
              updateLikeUI(!isUnlike);
              updateLabels(card.dataset.visits, card.dataset.likes);
            }
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
          const baseUrl = "https://calendly.com/kaiandisla-com/30min?text_color=000000&primary_color=12a7b8&embed_domain=kaiandisla.com&embed_type=Inline";
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

    // ACTION HANDLERS

    // 1. Defaut Mail App
    emailDefaultBtn.onclick = () => {
      if (currentMailto) {
        window.location.href = currentMailto;
        setTimeout(closeEmailModal, 500);
      }
    };

    // 2. Gmail Web (New Tab)
    emailGmailBtn.onclick = () => {
      if (!currentMailto) return;

      const parts = currentMailto.split('?');
      const email = parts[0].replace("mailto:", "");
      const params = new URLSearchParams(parts[1] || "");

      const subject = params.get("subject") || "";
      const cc = params.get("cc") || "";
      const body = params.get("body") || "";

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.open(gmailUrl, '_blank');
      closeEmailModal();
    };

    // 3. Copy Email
    emailCopyBtn.onclick = async () => {
      if (!currentMailto) return;
      // Extract just the email address (ignore subject/cc for clipboard)
      const email = currentMailto.split('?')[0].replace("mailto:", "");

      try {
        await navigator.clipboard.writeText(email);
        emailCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          closeEmailModal();
        }, 1200);
      } catch (err) {
        console.error('Failed to copy', err);
        prompt("Copy email manually:", email);
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
        target.scrollIntoView({ behavior: 'smooth' });
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
  safeInit("Header", initHeader);
  safeInit("Animations", initAnimations);
  safeInit("Carousel", initCarousel);
  safeInit("Gallery", initGallery);
  safeInit("Property Filters", initPropertyFilters);
  safeInit("Property Modal", initPropertyModal);
  safeInit("Cards", initCards);
  safeInit("Palawan Gallery", initPalawanGallery);
  safeInit("Works Gallery Lightbox", initWorksGalleryLightbox);
  safeInit("Calendly", initCalendly);
  loadComponent("#contact-row-placeholder", "contactRC.html");
}

/**
 * Helper to fetch and inject HTML components
 */
async function loadComponent(selector, url) {
  const container = document.querySelector(selector);
  if (!container) return;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    container.innerHTML = html;
    console.info(`✅ Component loaded: ${url}`);
    
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

function bindThemeToggles() {
  if (document.documentElement.dataset.themeBound) return;
  document.documentElement.dataset.themeBound = "true";

  const syncUI = (theme) => {
    // 1. Update Icons
    document.querySelectorAll(".theme-toggle .theme-icon").forEach(icon => {
      icon.className = theme === "dark" ? "theme-icon fas fa-sun" : "theme-icon fas fa-moon";
    });

    // 2. Update Logos
    const logos = {
      light: "images/logo2-light.png",
      dark: "images/logo2-dark.png"
    };

    // Main nav logo
    const navLogo = document.querySelector(".logo-container img");
    if (navLogo) navLogo.src = theme === "dark" ? logos.light : logos.dark;

    // Dashboard logo
    const dashLogo = document.getElementById("dashLogo");
    if (dashLogo) dashLogo.src = theme === "dark" ? logos.light : logos.dark;

    // Mobile menu logo
    const mobileLogo = document.querySelector(".mobile-menu img");
    if (mobileLogo) mobileLogo.src = theme === "dark" ? logos.light : logos.dark;
  };

  // Initial sync
  syncUI(document.documentElement.getAttribute("data-theme") || "dark");

  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";

      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);

      syncUI(next);
      document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    });
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
// ================================================================
const scrollState = { last: 0, ticking: false };

function initHeader() {
  const nav = document.querySelector("nav");
  const body = document.body;
  const topBar = document.querySelector(".top-bar");
  if (!nav || !topBar || nav.dataset.initialized) return;
  nav.dataset.initialized = "true";

  const navLogo = nav.querySelector(".logo-container img");
  const mobileLogo = document.querySelector(".mobile-menu img");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector(".mobile-menu");
  const menuOverlay = document.querySelector(".menu-overlay");

  const sections = [...document.querySelectorAll("section[id]")].filter(s => s.id !== "home");

  function updateScrollProgress(forceTop = false) {
    const bar = document.querySelector(".scroll-progress-bar");
    if (!bar || !sections.length) return;

    const offset = nav.offsetHeight + topBar.offsetHeight;
    const y = window.scrollY;

    if (forceTop || y < sections[0].offsetTop - offset) {
      bar.style.width = "0%";
      bar.style.opacity = "0";
      return;
    }

    let current = sections[0];
    for (let i = sections.length - 1; i >= 0; i--) {
      if (y + offset >= sections[i].offsetTop) {
        current = sections[i];
        break;
      }
    }

    const next = sections[sections.indexOf(current) + 1] || { offsetTop: document.documentElement.scrollHeight };
    const start = current.offsetTop - offset;
    const end = next.offsetTop - offset;
    const progress = Math.min(Math.max((y - start) / (end - start), 0), 1);

    bar.style.width = `${progress * 100}%`;
    bar.style.opacity = progress < 0.01 ? "0" : "1";
  }

  function syncLogos(theme) {
    const light = "images/logo2-light.png";
    const dark = "images/logo2-dark.png";

    // Nav logos
    navLogo && (navLogo.src = theme === "light" ? dark : light);
    mobileLogo && (mobileLogo.src = theme === "light" ? dark : light);

    // Team card logos
    document.querySelectorAll(".team-card .team-image img").forEach(img => {
      if (img.src.includes("logo2-")) {
        img.src = theme === "light" ? dark : light;
      }
    });
  }

  function updateTheme(theme) {
    body.style.color = theme === "light" ? "#111" : "";
    topBar.style.background = theme === "light" ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)";
  }

  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  syncLogos(theme);
  updateTheme(theme);
  document.addEventListener("themechange", e => { syncLogos(e.detail); updateTheme(e.detail); });

  function handleScroll() {
    const y = window.scrollY;
    const delta = y - scrollState.last;
    scrollState.last = y;
    scrollState.ticking = false;
    const topH = topBar.offsetHeight;

    if (y <= 5) {
      topBar.classList.remove("hidden");
      nav.style.top = `${topH}px`;
      updateScrollProgress(true);
      return;
    }

    if (delta > 0 && y > 50) {
      topBar.classList.add("hidden");
      nav.style.top = "0px";
    } else {
      topBar.classList.remove("hidden");
      nav.style.top = `${topH}px`;
    }

    updateScrollProgress();
  }

  window.addEventListener("scroll", () => {
    if (!scrollState.ticking) {
      requestAnimationFrame(handleScroll);
      scrollState.ticking = true;
    }
  });

  if (!document.querySelector(".scroll-progress-bar")) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress-bar";
    bar.style.cssText = "position:fixed;top:0;left:0;height:3px;background:var(--accent);opacity:0;z-index:9999;";
    document.body.appendChild(bar);
  }
  requestAnimationFrame(() => { window.scrollTo(0, 0); updateScrollProgress(true); });

  // ================================================================
  // MOBILE MENU - FIXED VERSION
  // ================================================================
  if (menuToggle && mobileMenu && menuOverlay) {
    const openMenu = () => {
      mobileMenu.classList.add("open");
      menuOverlay.classList.add("active");
      document.body.classList.add("menu-open");
      document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
      mobileMenu.classList.remove("open");
      menuOverlay.classList.remove("active");
      document.body.classList.remove("menu-open");
      document.body.style.overflow = "";

      // Remove focus from menu toggle button
      menuToggle.blur();

      // Remove any active/focus states
      if (document.activeElement === menuToggle) {
        document.activeElement.blur();
      }
    };

    // Toggle menu
    menuToggle.addEventListener("click", e => {
      e.preventDefault();
      mobileMenu.classList.contains("open") ? closeMenu() : openMenu();
    });

    // Close on overlay click
    menuOverlay.addEventListener("click", closeMenu);

    // Close on X button click
    mobileMenu.querySelector(".menu-close")?.addEventListener("click", closeMenu);

    // Close menu when clicking any anchor link inside it
    mobileMenu.addEventListener("click", e => {
      const link = e.target.closest("a[href^='#']");
      if (link) {
        closeMenu();
      }
    });

    // Close on Escape key
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
        closeMenu();
      }
    });

    // Close on window resize (desktop view)
    window.addEventListener("resize", () => {
      if (window.innerWidth > 992 && mobileMenu.classList.contains("open")) {
        closeMenu();
      }
    });
  }
}

function initAnimations() {
  console.log('🎯 initAnimations() started');

  const observer = new IntersectionObserver(entries =>
    entries.forEach(e => e.isIntersecting && e.target.classList.add("in-view")),
    { threshold: 0.1 }
  );
  document.querySelectorAll(".animate-on-scroll").forEach(el => observer.observe(el));

  const heroCarousel = document.querySelector(".hero-carousel");
  const heroVideo = document.getElementById("heroVideo");

  console.log('🎯 Elements found:', {
    heroCarousel: !!heroCarousel,
    heroVideo: !!heroVideo
  });

  if (!heroCarousel) {
    console.error('❌ No hero carousel found!');
    return;
  }

  let carouselRevealed = false;

  const revealCarousel = () => {
    if (carouselRevealed) {
      console.log('⚠️ Carousel already revealed');
      return;
    }
    carouselRevealed = true;

    console.log('🎬 Revealing carousel');

    if (window.gsap) {
      gsap.set(heroCarousel, { clearProps: "all" });
      gsap.set(heroCarousel, {
        opacity: 0,
        y: 24,
        scale: 0.98
      });

      gsap.to(heroCarousel, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1.8,
        ease: "power2.out",
        onStart: () => console.log('✅ GSAP carousel animation started'),
        onComplete: () => {
          console.log('✅ GSAP carousel animation complete');
          heroCarousel.classList.add("is-visible");
        }
      });
    } else {
      console.log('⚠️ GSAP not available, using CSS fallback');
      heroCarousel.style.transition = "opacity 2.5s ease, transform 2.5s ease";
      heroCarousel.style.opacity = "1";
      heroCarousel.style.transform = "none";
      setTimeout(() => {
        heroCarousel.classList.add("is-visible");
      }, 2500);
    }
  };

  if (heroVideo) {
    console.log('🎥 Setting up video listeners');

    let videoStartTime = Date.now();

    heroVideo.addEventListener('ended', () => {
      console.log('🎬 Video ended');

      if (window.gsap) {
        gsap.to(heroVideo, {
          opacity: 0,
          duration: 2,
          ease: "power2.inOut",
          onStart: () => console.log('🌑 Video fade-out started')
        });
      } else {
        heroVideo.style.transition = "opacity 2s ease";
        heroVideo.style.opacity = "0";
      }

      // Reveal carousel if not already done
      if (!carouselRevealed) {
        revealCarousel();
      }
    });

    // Start carousel fade-in at 0.8s remaining
    // heroVideo.addEventListener('timeupdate', () => { ... }); // REMOVED to avoid premature reveal


    heroVideo.addEventListener('loadedmetadata', () => {
      console.log(`📹 Video loaded: ${heroVideo.duration}s duration`);
    });

    heroVideo.addEventListener('error', (e) => {
      console.error('❌ Video error:', e);
      revealCarousel();
    });

    setTimeout(() => {
      // Fallback if video never starts
      if (!carouselRevealed && heroVideo.currentTime === 0) {
        console.log('⏱️ Fallback: Video never started, revealing carousel');
        revealCarousel();
      }
    }, 7000);
  } else {
    console.log('⚠️ No video element found');
    revealCarousel();
  }
}

// ================================================================
// CAROUSEL SWIPE & AUTO-ROTATE
// ================================================================
function initCarousel() {
  const carousel = document.querySelector(".hero-carousel");
  const slides = document.querySelectorAll(".hero-slide");

  if (!carousel || slides.length === 0 || carousel.dataset.carouselInit) return;
  carousel.dataset.carouselInit = "true";

  let currentSlide = 0;
  let autoplayInterval;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let startTime = 0;

  slides[0].classList.add("active");

  function goToSlide(index) {
    slides.forEach(slide => {
      slide.classList.remove("active");
      slide.style.transform = "";
      slide.style.opacity = "";
    });

    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;

    currentSlide = index;
    slides[currentSlide].classList.add("active");

    resetAutoplay();
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function prevSlide() {
    goToSlide(currentSlide - 1);
  }

  function startAutoplay() {
    if (isPaused) return;
    stopAutoplay();
    autoplayInterval = setInterval(nextSlide, 5000);
  }

  function stopAutoplay() {
    clearInterval(autoplayInterval);
  }

  function resetAutoplay() {
    if (isPaused) return;
    stopAutoplay();
    startAutoplay();
  }

  let isPaused = false;

  function handleStart(e) {
    isDragging = true;
    startTime = Date.now();
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    currentX = startX;

    stopAutoplay();
    carousel.style.cursor = "grabbing";
  }

  function handleMove(e) {
    if (!isDragging) return;

    currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const diff = currentX - startX;

    // Only prevent default for horizontal swipes
    if (Math.abs(diff) > 10) {
      e.preventDefault();
    }

    const opacity = Math.max(0.3, 1 - Math.abs(diff) / 400);

    slides[currentSlide].style.opacity = opacity;
    slides[currentSlide].style.transform = `translateX(${diff * 0.1}px)`;
  }

  function handleEnd(e) {
    if (!isDragging) return;

    isDragging = false;
    carousel.style.cursor = "grab";

    const diff = currentX - startX;
    const duration = Date.now() - startTime;
    const velocity = Math.abs(diff) / duration;

    const threshold = 50;
    const isSwipe = Math.abs(diff) > threshold || velocity > 0.5;

    slides[currentSlide].style.transform = "";
    slides[currentSlide].style.opacity = "";

    if (isSwipe) {
      isPaused = false;
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    } else {
      if (e.type.includes("touch")) {
        isPaused = !isPaused;
        if (isPaused) {
          stopAutoplay();
        } else {
          startAutoplay();
        }
      } else {
        if (!isPaused) {
          resetAutoplay();
        }
      }
    }
  }

  carousel.addEventListener("touchstart", handleStart, { passive: true });
  carousel.addEventListener("touchmove", handleMove, { passive: true });
  carousel.addEventListener("touchend", handleEnd, { passive: true });

  carousel.addEventListener("mousedown", handleStart);
  carousel.addEventListener("mousemove", handleMove);
  carousel.addEventListener("mouseup", handleEnd);
  carousel.addEventListener("mouseleave", handleEnd);

  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prevSlide();
    if (e.key === "ArrowRight") nextSlide();
  });

  slides.forEach(slide => {
    const buttons = slide.querySelectorAll("a, button, .btn");

    buttons.forEach(btn => {
      btn.addEventListener("mouseenter", stopAutoplay);
      btn.addEventListener("mouseleave", () => {
        if (!isDragging && !isPaused) {
          startAutoplay();
        }
      });
    });
  });

  carousel.style.cursor = "grab";
  carousel.setAttribute("tabindex", "0");

  startAutoplay();
}

// ================================================================
// GALLERY – APPLE-GRADE STAGGERED FADE (FIXED)
// ================================================================
function initGallery() {
  const galleries = document.querySelectorAll(".mixed-gallery");
  if (!galleries.length) return;

  // Check if GSAP is available
  const hasGSAP = typeof window.gsap !== 'undefined';
  if (!hasGSAP) {
    console.warn('GSAP not loaded - gallery animations disabled');
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  galleries.forEach(gallery => {
    const items = [...gallery.querySelectorAll(".gallery-item")];
    if (!items.length) return;

    const filterContainer = gallery.closest(".container-glass")?.querySelector(".gallery-filters");
    if (!filterContainer) return;

    const buttons = filterContainer.querySelectorAll(".filter");
    let active = "all";
    let isAnimating = false;

    // Set initial state for all items - ensure they start visible
    items.forEach(item => {
      if (hasGSAP) {
        gsap.set(item, { opacity: 1, scale: 1, y: 0 });
      }
      item.classList.remove("flip-hidden");
      item.style.display = "";
      item.style.pointerEvents = "auto";
    });

    buttons.forEach(btn =>
      btn.addEventListener("click", () => {
        if (btn.classList.contains("active") || isAnimating) return;
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        active = btn.dataset.filter || "all";
        applyFilter();
      })
    );

    function applyFilter() {
      if (isAnimating) return;
      isAnimating = true;

      // Special handling for "ALL" - clean slate approach
      if (active === "all") {
        const allVisible = items.filter(item => item.style.display !== "none");

        // If everything is already showing, no animation needed
        if (allVisible.length === items.length) {
          isAnimating = false;
          return;
        }

        if (prefersReducedMotion || !hasGSAP) {
          items.forEach(item => {
            item.style.display = "";
            item.classList.remove("flip-hidden");
          });
          isAnimating = false;
          return;
        }

        // Fade out all currently visible items first
        gsap.to(allVisible, {
          opacity: 0,
          scale: 0.96,
          duration: 0.15,
          ease: "power2.in",
          onComplete: () => {
            // Reset all items
            items.forEach(item => {
              item.style.display = "";
              item.classList.remove("flip-hidden");
              gsap.set(item, { opacity: 0, scale: 0.94, y: 12 });
            });

            // Reveal everything together with stagger
            gsap.to(items, {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.5,
              stagger: {
                amount: 0.2,
                from: "start",
                ease: "power1.out"
              },
              ease: "power3.out",
              onComplete: () => {
                isAnimating = false;
              }
            });
          }
        });
        return;
      }

      // Regular filter logic for specific categories
      const toHide = [];
      const toShow = [];

      items.forEach(item => {
        const shouldShow = item.dataset.category === active;
        const isCurrentlyVisible = item.style.display !== "none";

        if (shouldShow && !isCurrentlyVisible) {
          toShow.push(item);
        } else if (!shouldShow && isCurrentlyVisible) {
          toHide.push(item);
        }
      });

      // If no changes needed, exit early
      if (toHide.length === 0 && toShow.length === 0) {
        isAnimating = false;
        return;
      }

      if (prefersReducedMotion || !hasGSAP) {
        toHide.forEach(item => {
          item.style.display = "none";
          item.classList.add("flip-hidden");
        });
        toShow.forEach(item => {
          item.style.display = "";
          item.classList.remove("flip-hidden");
        });
        isAnimating = false;
        return;
      }

      // Phase 1: Fade out hidden items
      if (toHide.length) {
        gsap.to(toHide, {
          opacity: 0,
          scale: 0.96,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            toHide.forEach(item => {
              item.style.display = "none";
              item.classList.add("flip-hidden");
            });
            showItems();
          }
        });
      } else {
        showItems();
      }

      function showItems() {
        if (toShow.length) {
          toShow.forEach(item => {
            item.style.display = "";
            item.classList.remove("flip-hidden");
            gsap.set(item, { opacity: 0, scale: 0.94, y: 12 });
          });

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

    // Initial filter application (show all)
    items.forEach(item => {
      const shouldShow = active === "all" || item.dataset.category === active;
      item.style.display = shouldShow ? "" : "none";
      item.classList.toggle("flip-hidden", !shouldShow);
    });
  });
}

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
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    lightbox.classList.remove("open");
    document.body.classList.remove("lightbox-open");
    document.body.style.overflow = "";

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
      imgEl.style.cursor = "zoom-in";
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
// WORKS GALLERY LIGHTBOX - COMPLETE IMPLEMENTATION
// ================================================================
function initWorksGalleryLightbox() {
  const lightbox = document.getElementById("works-lightbox");
  const lightboxImg = document.getElementById("works-lightbox-img");
  const caption = lightbox?.querySelector(".lightbox-caption");
  const prevBtn = lightbox?.querySelector(".lightbox-prev");
  const nextBtn = lightbox?.querySelector(".lightbox-next");

  if (!lightbox || !lightboxImg) return;

  // Initialize as hidden - set both inert and aria-hidden immediately
  lightbox.setAttribute("inert", "");
  lightbox.setAttribute("aria-hidden", "true");

  // Get all gallery items from the "Our Work" section
  const gallerySection = document.getElementById("gallery");
  if (!gallerySection) return;

  const items = [...gallerySection.querySelectorAll(".gallery-item")];
  if (!items.length) return;

  let currentIndex = 0;

  // Open lightbox at specific index
  const openLightbox = (index) => {
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;

    currentIndex = index;
    const item = items[currentIndex];

    // Get image source
    const img = item.querySelector("img");
    if (!img) return;

    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "Gallery image";

    // Get caption content
    const overlay = item.querySelector(".gallery-overlay");
    if (caption && overlay) {
      caption.innerHTML = overlay.innerHTML;
    }

    // Remove inert/aria-hidden BEFORE adding open class to prevent focus issues
    lightbox.removeAttribute("inert");
    lightbox.removeAttribute("aria-hidden");
    lightbox.classList.add("open");
    document.body.classList.add("lightbox-open");
    document.body.style.overflow = "hidden";
  };

  // Close lightbox
  const closeLightbox = () => {
    lightbox.classList.remove("open");
    document.body.classList.remove("lightbox-open");
    document.body.style.overflow = "";

    // Add inert and aria-hidden AFTER closing animation
    setTimeout(() => {
      if (!lightbox.classList.contains("open")) {
        lightbox.setAttribute("inert", "");
        lightbox.setAttribute("aria-hidden", "true");
      }
    }, 300);
  };

  // Navigate to previous image
  const showPrev = () => {
    openLightbox(currentIndex - 1);
  };

  // Navigate to next image
  const showNext = () => {
    openLightbox(currentIndex + 1);
  };

  // Add click handlers to gallery items
  items.forEach((item, index) => {
    // Click on the image wrapper to open lightbox
    const imgWrap = item.querySelector(".img-wrap");
    if (imgWrap) {
      imgWrap.style.cursor = "zoom-in";
      imgWrap.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(index);
      });
    }
  });

  // Close lightbox when clicking on overlay
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target === lightboxImg) {
      closeLightbox();
    }
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
        closeLightbox();
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
// CARDS — EXPAND AT TOP OF GRID WITH NAVIGATION (WITH LOOPING)
// ================================================================
function initCards() {
  // Check if mobile
  const isMobile = window.innerWidth <= 768;

  // Initialize for both #how-it-works and #services sections
  const sections = ['#how-it-works', '#services'];

  sections.forEach(sectionId => {
    const section = document.querySelector(sectionId);
    if (!section) return;

    const grid = section.querySelector('.grid');
    const cards = [...section.querySelectorAll('.card')];
    if (!cards.length || !grid) return;

    let expandedCard = null;
    let currentExpandedIndex = isMobile ? 0 : -1; // Start at first card on mobile

    const createExpandedCard = () => {
      const card = document.createElement('div');
      card.className = 'card full-width';
      card.style.display = 'none';
      card.innerHTML = `
        <button class="card-nav card-nav-left" aria-label="Previous card"></button>
        <img class="card-image" src="" alt="">
        <div class="card-content">
          <h2 class="expanded-title"></h2>
          <p class="expanded-subtitle"></p>
          <div class="card-expand-text expanded-description"></div>
          <button class="expanded-close-btn">CLOSE</button>
        </div>
        <button class="card-nav card-nav-right" aria-label="Next card"></button>
      `;
      grid.parentNode.insertBefore(card, grid);
      return card;
    };

    expandedCard = createExpandedCard();

    const prevBtn = expandedCard.querySelector('.card-nav-left');
    const nextBtn = expandedCard.querySelector('.card-nav-right');
    const closeBtn = expandedCard.querySelector('.expanded-close-btn');
    const expandedImage = expandedCard.querySelector('.card-image');
    const expandedTitle = expandedCard.querySelector('.expanded-title');
    const expandedSubtitle = expandedCard.querySelector('.expanded-subtitle');
    const expandedDescription = expandedCard.querySelector('.expanded-description');

    const expandCardAtIndex = (index) => {
      // Loop the index
      if (index < 0) index = cards.length - 1;
      if (index >= cards.length) index = 0;

      const card = cards[index];

      // Get card content
      const title = card.querySelector('h2')?.textContent || '';
      const subtitle = card.querySelector('.card-content > p')?.textContent || '';
      const description = card.querySelector('.card-expand-text')?.innerHTML || '';
      const imgSrc = card.querySelector('.card-image')?.src || '';
      const imgAlt = card.querySelector('.card-image')?.alt || '';

      // Populate expanded card
      expandedTitle.textContent = title;
      expandedSubtitle.textContent = subtitle;
      expandedDescription.innerHTML = description;
      expandedImage.src = imgSrc;
      expandedImage.alt = imgAlt;

      // Mark all cards as inactive
      cards.forEach(c => c.classList.remove('card-active'));

      // Mark this card as active
      card.classList.add('card-active');
      currentExpandedIndex = index;

      // Show expanded card
      const wasHidden = expandedCard.style.display === 'none';
      expandedCard.style.display = 'grid';

      if (wasHidden && !isMobile) {
        // Scroll to section top when first opening (desktop only)
        const nav = document.querySelector('nav');
        const topBar = document.querySelector('.top-bar');
        const offset = (nav?.offsetHeight || 0) + (topBar?.offsetHeight || 0);

        const sectionTop = section.offsetTop - offset;

        window.scrollTo({
          top: sectionTop,
          behavior: 'smooth'
        });
      }

      // Animate in with GSAP if available
      if (wasHidden && window.gsap) {
        gsap.fromTo(expandedCard,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
        );
      } else if (window.gsap) {
        // Just update content with fade if already open
        gsap.fromTo([expandedImage, expandedCard.querySelector('.card-content')],
          { opacity: 0.5 },
          { opacity: 1, duration: 0.3, ease: 'power2.out' }
        );
      }

      // Nav buttons always enabled with looping
      prevBtn.style.opacity = '1';
      prevBtn.style.pointerEvents = 'auto';
      nextBtn.style.opacity = '1';
      nextBtn.style.pointerEvents = 'auto';
    };

    const collapseCard = () => {
      cards.forEach(c => c.classList.remove('card-active'));
      currentExpandedIndex = -1;

      if (window.gsap) {
        gsap.to(expandedCard, {
          opacity: 0,
          y: -20,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            expandedCard.style.display = 'none';
            gsap.set(expandedCard, { opacity: 1, y: 0 });
          }
        });
      } else {
        expandedCard.style.display = 'none';
      }
    };

    const navigatePrev = () => {
      expandCardAtIndex(currentExpandedIndex - 1);
    };

    const navigateNext = () => {
      expandCardAtIndex(currentExpandedIndex + 1);
    };

    // Add click handlers to cards (desktop only)
    if (!isMobile) {
      cards.forEach((card, index) => {
        const cta = card.querySelector('.card-cta');

        if (cta) {
          cta.style.cursor = 'pointer';
          cta.addEventListener('click', (e) => {
            e.stopPropagation();
            expandCardAtIndex(index);
          });
        }

        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-nav')) return;
          if (e.target.closest('a, button:not(.card-cta)')) return;
          expandCardAtIndex(index);
        });
      });
    }

    // Navigation buttons
    prevBtn?.addEventListener('click', navigatePrev);
    nextBtn?.addEventListener('click', navigateNext);

    // Close button - always attach handler, just hide on mobile
    if (closeBtn) {
      closeBtn.addEventListener('click', collapseCard);
      if (isMobile) {
        closeBtn.style.display = 'none';
      }
    }

    // Keyboard navigation
    const handleKeydown = (e) => {
      if (currentExpandedIndex === -1) return;

      if (e.key === 'Escape' && !isMobile) {
        collapseCard();
      } else if (e.key === 'ArrowLeft') {
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      }
    };

    document.addEventListener('keydown', handleKeydown);

    // Initialize first card on mobile
    if (isMobile && cards.length > 0) {
      expandCardAtIndex(0);
    }
  });
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