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
    if (!bar || !sections || sections.length === 0) return;

    const offset = nav.offsetHeight + topBar.offsetHeight;
    const scrollY = window.scrollY;

    if (forceTop || scrollY < sections[0].offsetTop - offset) {
      bar.style.width = "0%";
      bar.style.opacity = "0";
      return;
    }

    // Determine current section
    let currentSection = sections[0];
    for (let i = sections.length - 1; i >= 0; i--) {
      if (scrollY + offset >= sections[i].offsetTop) {
        currentSection = sections[i];
        break;
      }
    }

    const nextIndex = sections.indexOf(currentSection) + 1;
    const nextSection = sections[nextIndex] || {
      offsetTop: document.documentElement.scrollHeight,
    };

    const start = currentSection.offsetTop - offset;
    const end = nextSection.offsetTop - offset;

    let progress = (scrollY - start) / (end - start);
    progress = Math.min(Math.max(progress, 0), 1);

    bar.style.width = `${progress * 100}%`;
    bar.style.opacity = progress < 0.01 ? "0" : "1";
  }

  // ================================================================
  // THEME & LOGOS
  // ================================================================
  function syncLogos(theme) {
    const light = "images/logo2-light.png";
    const dark = "images/logo2-dark.png";
    if (navLogo) navLogo.src = theme === "light" ? dark : light;
    if (mobileLogo) mobileLogo.src = theme === "light" ? dark : light;

    // Paradise Life Homebuyer Logo Sync (Main Section only)
    const hbLogoImg = theme === "light" ? "images/homebuyer_light2.png" : "images/homebuyer_dark2.png";
    const hbLogo = document.getElementById("homebuyerLogoMain");
    if (hbLogo) hbLogo.src = hbLogoImg;
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
    body.classList.remove("menu-open");
    showTopBar();
    nav.style.top = `${topBar.offsetHeight}px`;
  }

  menuToggle?.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
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
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const hash = link.getAttribute("href");
    const target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    showTopBar();

    const offset = nav.offsetHeight + topBar.offsetHeight + 20;
    window.scrollTo({
      top: target.offsetTop - offset,
      behavior: "smooth",
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
window.initHeader = initHeader;
