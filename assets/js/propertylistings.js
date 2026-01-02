// ================================================================
// propertylistings.js — FILTERS + MODAL + APPLE-GRADE FLIP
// ================================================================
(function () {
  if (typeof gsap !== "undefined" && gsap.Flip) gsap.registerPlugin(gsap.Flip);

  let isAnimating = false;

  // Module-scope state
  let cards = [];
  let activeCategory = "all";
  let minPrice = 0;
  let maxPrice = 50000000;

  // ================================================================
  // MODAL LOGIC
  // ================================================================
  function openPropertyModal(card) {
    const modal = document.getElementById("propertyModal");
    const overlay = document.getElementById("modalOverlay");
    if (!modal || !overlay || !card) return;

    const img = card.querySelector("img");
    if (img) document.getElementById("modalImage").src = img.src;

    document.getElementById("modalLocation").textContent =
      card.querySelector(".property-location")?.textContent || "";

    document.getElementById("modalPrice").textContent =
      card.querySelector(".property-price")?.textContent || "";

    document.getElementById("modalDescription").textContent =
      card.dataset.description || "";

    const features = (card.dataset.features || "")
      .split("|")
      .map(f => f.trim())
      .filter(Boolean);

    const list = document.getElementById("modalFeatures");
    if (list) list.innerHTML = features.map(f => `<li>${f}</li>`).join("");

    overlay.classList.add("open");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closePropertyModal() {
    document.getElementById("propertyModal")?.classList.remove("open");
    document.getElementById("modalOverlay")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  function initModals() {
    const modal = document.getElementById("propertyModal");
    const overlay = document.getElementById("modalOverlay");
    if (!modal || !overlay) return;

    modal.querySelector(".modal-close")?.addEventListener("click", closePropertyModal);
    overlay.addEventListener("click", e => {
      if (e.target === overlay) closePropertyModal();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && modal.classList.contains("open")) {
        closePropertyModal();
      }
    });
  }

  // ================================================================
  // FILTER + FLIP LOGIC
  // ================================================================

  function runFlip() {
    if (!gsap.Flip || isAnimating) return;

    // If we don't have cards yet, try to find them
    if (!cards.length) {
      updateListings();
      if (!cards.length) return; // Still empty
    }

    isAnimating = true;

    const state = gsap.Flip.getState(cards);

    let visibleCount = 0;

    cards.forEach(card => {
      const category = card.dataset.category || "all";
      const price = parseInt(card.dataset.price || "0", 10);

      const visible =
        (activeCategory === "all" || category === activeCategory) &&
        price >= minPrice &&
        price <= maxPrice;

      card.classList.toggle("flip-hidden", !visible);
      if (visible) visibleCount++;
    });

    const noResults = document.getElementById("noResults");
    if (noResults) noResults.style.display = visibleCount === 0 ? "block" : "none";

    gsap.Flip.from(state, {
      duration: 0.45,
      ease: "cubic-bezier(0.22, 1, 0.36, 1)",
      absolute: false,
      stagger: 0,
      fade: true,
      scale: false,
      onEnter: els =>
        gsap.fromTo(
          els,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
        ),
      onLeave: els =>
        gsap.to(els, { opacity: 0, y: -6, duration: 0.2, ease: "power1.in" }),
      onComplete: () => {
        isAnimating = false;
      }
    });
  }

  function updateListings() {
    const grid = document.querySelector(".property-grid");
    if (!grid) return;
    // Exclude no-results card from the 'cards' list used for filtering
    cards = Array.from(grid.querySelectorAll(".property-card:not(.no-results-card)"));
    runFlip();
  }

  function setupFilters() {
    const grid = document.querySelector(".property-grid");
    if (!grid) return;

    const buttons = document.querySelectorAll(".gallery-filters .filter");
    const priceMin = document.getElementById("priceMin");
    const priceMax = document.getElementById("priceMax");
    const priceLabel = document.getElementById("priceRangeValue");

    // ------------------------
    // CATEGORY BUTTONS
    // ------------------------
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("active") || isAnimating) return;

        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        activeCategory = btn.dataset.filter || "all";
        runFlip();
      });
    });

    // ------------------------
    // PRICE SLIDERS
    // ------------------------
    function normalizePrice() {
      let min = parseInt(priceMin?.value || "0", 10);
      let max = parseInt(priceMax?.value || "50000000", 10);

      if (min > max) [min, max] = [max, min];

      minPrice = min;
      maxPrice = max;

      if (priceLabel) {
        priceLabel.textContent =
          min === 0 && max === 50000000
            ? "Any Price"
            : `₱${min.toLocaleString()} – ₱${max.toLocaleString()}`;
      }
    }

    priceMin?.addEventListener("input", () => {
      normalizePrice();
      runFlip();
    });

    priceMax?.addEventListener("input", () => {
      normalizePrice();
      runFlip();
    });

    // Initial normalize to set label
    normalizePrice();

    // ------------------------
    // CARD CLICK → MODAL
    // ------------------------
    grid.addEventListener("click", e => {
      const card = e.target.closest(".property-card");
      // Use !card or check if it's the no-results card (which shouldn't open modal)
      if (!card || card.classList.contains("flip-hidden") || card.id === "noResults") return;
      e.preventDefault();
      openPropertyModal(card);
    });
  }

  // ================================================================
  // INIT
  // ==================================================
  function init() {
    initModals();
    setupFilters();
    updateListings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("listingsLoaded", () => {
    updateListings();
  });

})();
