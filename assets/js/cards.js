// ================================================================
// CARDS — GRID CARD EXPAND / COLLAPSE
// ================================================================
function initCards() {
  document.querySelectorAll(".grid").forEach(grid => {
    const cards = Array.from(grid.querySelectorAll(".card"));
    if (!cards.length) return;

    const getNavOffset = () =>
      (document.querySelector("nav")?.offsetHeight || 0) + 20;

    function collapseAll() {
      cards.forEach(card => {
        card.classList.remove("full-width", "is-expanding");
        card.style.order = 0;
        card.setAttribute("aria-expanded", "false");

        const prevBtn = card.querySelector(".card-nav-left");
        const nextBtn = card.querySelector(".card-nav-right");
        if (prevBtn) prevBtn.style.display = "";
        if (nextBtn) nextBtn.style.display = "";
      });
    }

    function updateArrowVisibility(card) {
      const index = cards.indexOf(card);
      const prevBtn = card.querySelector(".card-nav-left");
      const nextBtn = card.querySelector(".card-nav-right");

      if (!prevBtn || !nextBtn) return;

      // First card → only RIGHT
      if (index === 0) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "";
        return;
      }

      // Last card → only LEFT
      if (index === cards.length - 1) {
        prevBtn.style.display = "";
        nextBtn.style.display = "none";
        return;
      }

      // Middle cards → both
      prevBtn.style.display = "";
      nextBtn.style.display = "";
    }

    function expandCard(card, scroll = true) {
      collapseAll();

      card.style.order = -1;
      card.classList.add("full-width");

      requestAnimationFrame(() => {
        card.classList.add("is-expanding");
        card.setAttribute("aria-expanded", "true");
        card.focus({ preventScroll: true });
        updateArrowVisibility(card);
      });

      if (scroll) {
        const y =
          grid.getBoundingClientRect().top +
          window.scrollY -
          getNavOffset();

        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }

    function getAdjacentCard(card, direction) {
      const index = cards.indexOf(card);
      if (index === -1) return null;

      if (direction === "next" && index < cards.length - 1) {
        return cards[index + 1];
      }

      if (direction === "prev" && index > 0) {
        return cards[index - 1];
      }

      return null;
    }

    cards.forEach(card => {
      // Accessibility
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-expanded", "false");

      const prevBtn = card.querySelector(".card-nav-left");
      const nextBtn = card.querySelector(".card-nav-right");

      // Click to expand / collapse
      card.addEventListener("click", e => {
        e.stopPropagation();

        const isExpanded = card.classList.contains("full-width");
        if (!isExpanded) {
          expandCard(card);
        } else {
          collapseAll();
        }
      });

      // Arrow button navigation
      if (prevBtn) {
        prevBtn.addEventListener("click", e => {
          e.stopPropagation();
          const prev = getAdjacentCard(card, "prev");
          if (prev) expandCard(prev);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", e => {
          e.stopPropagation();
          const next = getAdjacentCard(card, "next");
          if (next) expandCard(next);
        });
      }

      // Keyboard support
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }

        if (e.key === "ArrowRight") {
          const next = getAdjacentCard(card, "next");
          if (next) {
            e.preventDefault();
            expandCard(next);
          }
        }

        if (e.key === "ArrowLeft") {
          const prev = getAdjacentCard(card, "prev");
          if (prev) {
            e.preventDefault();
            expandCard(prev);
          }
        }
      });

      // Touch feedback
      card.addEventListener("touchstart", () => {
        card.classList.add("touching");
      });

      card.addEventListener("touchend", () => {
        card.classList.remove("touching");
      });
    });

    // Expand FIRST card by default (no scroll jump)
    expandCard(cards[0], false);

    // Click outside grid collapses
    document.addEventListener("click", e => {
      if (!e.target.closest(".grid")) collapseAll();
    });
  });
}

// Expose globally
window.initCards = initCards;
