// ================================================================
// NAV + HEADER + THEME SYSTEM (ULTRA-SMOOTH APPLE STYLE)
// ================================================================
let lastScroll = 0;
let ticking = false;

function initHeader() {
  const nav = document.querySelector("nav");
  const body = document.body;
  const topBar = document.querySelector(".top-bar");
  const navLogo = document.querySelector("nav .logo-container img");
  const mobileLogo = document.querySelector(".mobile-menu img");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector(".mobile-menu");
  const menuOverlay = document.querySelector(".menu-overlay");

  if (!nav || !topBar) return;
  if (nav.dataset.initialized === "true") return;
  nav.dataset.initialized = "true";

  // ================================================================
  // SECTION MAP (for section-based progress)
  // ================================================================
  const allSections = Array.from(document.querySelectorAll("section[id]"));
  // Exclude hero for progress tracking
  const sections = allSections.filter(s => s.id !== "home");

  // ================================================================
  // SCROLL PROGRESS (SECTION-BASED + FADE OUT BEFORE FIRST TRACKABLE SECTION)
  // ================================================================
  function updateScrollProgress(forceTop = false) {
    const bar = document.querySelector(".scroll-progress-bar");
    if (!bar) return;

    // Standard Global Scroll Progress (0% at top, 100% at bottom)
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

    if (scrollHeight <= 0) {
      bar.style.width = "0%";
      return;
    }

    let progress = scrollTop / scrollHeight;
    progress = Math.min(Math.max(progress, 0), 1);

    bar.style.width = `${progress * 100}%`;
    bar.style.opacity = progress < 0.001 ? "0" : "1";
  }

  // ================================================================
  // THEME & LOGOS
  // ================================================================
  function syncLogos(theme) {
    const light = "images/logo_light.png";
    const dark = "images/logo_dark.png";
    if (navLogo) navLogo.src = theme === "light" ? light : dark;
    if (mobileLogo) mobileLogo.src = theme === "light" ? light : dark;

    // Paradise Life Homebuyer Logo Sync (Main Section only)
    const hbLogoImg = theme === "light" ? "images/homebuyer_dark2.png" : "images/homebuyer_light2.png";
    const hbLogo = document.getElementById("homebuyerLogoMain");
    if (hbLogo) hbLogo.src = hbLogoImg;
    const hbRibbons = document.querySelectorAll(".property-logo img");
    hbRibbons.forEach(img => {
      img.src = "images/homebuyer_dark2.png"; // Per user: always dark for ribbons
    });

    // Team Card Logos Sync
    document.querySelectorAll(".team-card .team-image img").forEach(img => {
      if (img.src.includes("logo_")) {
        img.src = theme === "light" ? light : dark;
      }
    });
  }

  function updateBodyBackground(theme) {
    const root = document.documentElement;
    const overlay = getComputedStyle(root)
      .getPropertyValue(`--site-bg-overlay-${theme}`)
      .trim();
    const image = getComputedStyle(root)
      .getPropertyValue("--site-bg-image")
      .trim();
    const chroma =
      theme === "dark"
        ? getComputedStyle(root)
          .getPropertyValue("--site-bg-overlay-chroma")
          .trim()
        : "";

    body.style.transition =
      "background 0.5s var(--transition), color 0.5s var(--transition)";

    topBar.style.background =
      theme === "light"
        ? "rgba(255,255,255,0.95)"
        : "rgba(0,0,0,0.9)";

    body.style.color =
      theme === "light"
        ? "#111"
        : getComputedStyle(root).getPropertyValue("--text").trim();
  }

  const theme =
    document.documentElement.getAttribute("data-theme") ||
    localStorage.getItem("theme") ||
    "dark";

  syncLogos(theme);
  updateBodyBackground(theme);

  document.addEventListener("themechange", e => {
    syncLogos(e.detail);
    updateBodyBackground(e.detail);
  });

  // ================================================================
  // MOBILE MENU
  // ================================================================
  function showTopBar() {
    topBar.classList.remove("hidden");
    topBar.style.opacity = "1";
  }

  function closeMenu() {
    mobileMenu?.classList.remove("open");
    menuOverlay?.classList.remove("active");
    menuToggle?.classList.remove("active");
    body.classList.remove("menu-open");
    showTopBar();
    nav.style.top = `${topBar.offsetHeight}px`;
  }

  menuToggle?.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    menuToggle.classList.toggle("active", open);
    menuOverlay.classList.toggle("active", open);
    body.classList.toggle("menu-open", open);
    open ? showTopBar() : handleScroll();
  });

  menuOverlay?.addEventListener("click", closeMenu);
  document
    .querySelectorAll(".mobile-menu a")
    .forEach(a => a.addEventListener("click", closeMenu));

  // ================================================================
  // SCROLL HANDLER
  // ================================================================
  function handleScroll() {
    const scrollY = window.scrollY;
    const delta = scrollY - lastScroll;
    const topBarHeight = topBar.offsetHeight;

    if (scrollY <= 5) {
      showTopBar();
      nav.style.top = `${topBarHeight}px`;
      updateScrollProgress(true);
      lastScroll = scrollY;
      ticking = false;
      return;
    }

    if (delta > 0 && scrollY > 50) {
      topBar.classList.add("hidden");
      nav.style.top = "0px";
    } else {
      topBar.classList.remove("hidden");
      nav.style.top = `${topBarHeight}px`;
    }

    const scale = Math.max(0.85, 1 - scrollY / 800);
    navLogo && (navLogo.style.transform = `scale(${scale})`);
    mobileLogo && (mobileLogo.style.transform = `scale(${scale})`);

    updateScrollProgress();
    lastScroll = scrollY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(handleScroll);
      ticking = true;
    }
  });

  // ================================================================
  // ANCHOR NAV
  // ================================================================
  document.addEventListener("click", e => {
    const link = e.target.closest('a');
    if (!link) return;

    let href = link.getAttribute("href");
    if (!href || !href.includes("#")) return;

    // Handle both "#hash" and "index.html#hash"
    const parts = href.split("#");
    const page = parts[0];
    const hash = "#" + parts[1];

    // If it's a different page (not index.html on index.html), let it through
    const isHomePage = window.location.pathname === "/" || window.location.pathname.endsWith("index.html");
    if (page && page !== "index.html" && !(isHomePage && page === "")) return;

    const target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    showTopBar();

    const offset = nav.offsetHeight + topBar.offsetHeight + 20;
    window.scrollTo({
      top: target.offsetTop - offset,
      behavior: "auto",
    });

    if (hash === "#home") {
      updateScrollProgress(true);
      lastScroll = 0;
    }

    history.pushState(null, "", hash);
  });

  // ================================================================
  // PROGRESS BAR INIT
  // ================================================================
  if (!document.querySelector(".scroll-progress-bar")) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress-bar";
    bar.style.position = "fixed";
    bar.style.top = "0";
    bar.style.left = "0";
    bar.style.height = "3px";
    bar.style.background = "var(--accent)";
    bar.style.opacity = "0";
    bar.style.transition = "width 0.2s ease, opacity 0.3s ease";
    bar.style.zIndex = "9999";
    document.body.appendChild(bar);
  }

  // ================================================================
  // HASH REFRESH FIX
  // ================================================================
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    updateScrollProgress(true);
    lastScroll = 0;
  });
}

// ---------------- Init ----------------
// ================================================================
// SEARCH FEATURE (Ctrl+F / Cmd+F Replaced)
// ================================================================
if (!document.getElementById("searchFab")) {
  const searchFab = document.createElement("div");
  searchFab.id = "searchFab";
  searchFab.className = "search-fab";
  searchFab.innerHTML = '<i class="fas fa-search"></i>';
  document.body.appendChild(searchFab);

  const searchContainer = document.createElement("div");
  searchContainer.id = "searchContainer";
  searchContainer.className = "search-container";
  searchContainer.innerHTML = `
      <input type="text" id="searchInput" class="search-input" placeholder="Find in page...">
      <span id="searchCount" class="search-count">0/0</span>
      <button id="searchPrev" class="search-nav-btn"><i class="fas fa-chevron-up"></i></button>
      <button id="searchNext" class="search-nav-btn"><i class="fas fa-chevron-down"></i></button>
      <button id="searchClose" class="search-close"><i class="fas fa-times"></i></button>
    `;
  document.body.appendChild(searchContainer);

  let matches = [];
  let currentMatchIndex = -1;

  const toggleSearch = () => {
    const isOpen = searchContainer.classList.contains("open");
    if (isOpen) {
      closeSearch();
    } else {
      openSearch();
    }
  };

  const openSearch = () => {
    searchContainer.classList.add("open");
    searchFab.style.opacity = "0";
    searchFab.style.visibility = "hidden";
    setTimeout(() => document.getElementById("searchInput").focus(), 100);
  };

  const closeSearch = () => {
    searchContainer.classList.remove("open");
    searchFab.style.opacity = "";
    searchFab.style.visibility = "";
    removeHighlights();
    document.getElementById("searchInput").value = "";
    document.getElementById("searchCount").textContent = "0/0";
  };

  const removeHighlights = () => {
    document.querySelectorAll("mark.search-highlight").forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize(); // Merge text nodes
    });
    matches = [];
    currentMatchIndex = -1;
  };

  const performSearch = (text) => {
    removeHighlights();
    if (!text || text.length < 2) {
      document.getElementById("searchCount").textContent = "0/0";
      return;
    }

    const regex = new RegExp(`(${text})`, "gi");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement.closest(".search-container")) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest("script")) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest("style")) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToHighlight = [];
    while (walker.nextNode()) {
      if (regex.test(walker.currentNode.textContent)) {
        nodesToHighlight.push(walker.currentNode);
      }
    }

    let count = 0;
    nodesToHighlight.forEach(node => {
      const span = document.createElement("span");
      span.innerHTML = node.textContent.replace(regex, '<mark class="search-highlight">$1</mark>');

      // Replace node with new HTML
      const fragment = document.createDocumentFragment();
      while (span.firstChild) {
        fragment.appendChild(span.firstChild);
      }
      node.parentNode.replaceChild(fragment, node);
    });

    matches = Array.from(document.querySelectorAll("mark.search-highlight"));
    if (matches.length > 0) {
      currentMatchIndex = 0;
      updateMatchState();
    }

    document.getElementById("searchCount").textContent = matches.length > 0 ? `1/${matches.length}` : "0/0";
  };

  const updateMatchState = () => {
    matches.forEach(m => m.classList.remove("active"));
    if (currentMatchIndex >= 0 && matches[currentMatchIndex]) {
      const match = matches[currentMatchIndex];
      match.classList.add("active");
      match.scrollIntoView({ behavior: "auto", block: "center" });
      document.getElementById("searchCount").textContent = `${currentMatchIndex + 1}/${matches.length}`;
    }
  };

  // Events
  searchFab.addEventListener("click", toggleSearch);
  document.getElementById("searchClose").addEventListener("click", closeSearch);

  document.getElementById("searchInput").addEventListener("input", (e) => {
    performSearch(e.target.value);
  });

  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (matches.length > 0) {
        currentMatchIndex = e.shiftKey ?
          (currentMatchIndex - 1 + matches.length) % matches.length :
          (currentMatchIndex + 1) % matches.length;
        updateMatchState();
      }
    }
  });

  document.getElementById("searchPrev").addEventListener("click", () => {
    if (matches.length > 0) {
      currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
      updateMatchState();
    }
  });

  document.getElementById("searchNext").addEventListener("click", () => {
    if (matches.length > 0) {
      currentMatchIndex = (currentMatchIndex + 1) % matches.length;
      updateMatchState();
    }
  });

  // Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      openSearch();
    }
    if (e.key === "Escape" && searchContainer.classList.contains("open")) {
      closeSearch();
    }
  });
}

window.initHeader = initHeader;
