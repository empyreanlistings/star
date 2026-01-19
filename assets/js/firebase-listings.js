import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  increment,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAu9fL7HRSouwBAvmi9SI4AomaHd7epvpY",
  authDomain: "empyrean-3da06.firebaseapp.com",
  projectId: "empyrean-3da06",
  storageBucket: "empyrean-3da06.firebasestorage.app",
  messagingSenderId: "973213.57906",
  appId: "1:973213.57906:web:5cfbee0541932e579403b3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Caching Constants
const CACHE_KEY = "star_listings";

/**
 * Public function to clear cache (used by admin dashboard)
 */
window.clearListingCache = function () {
  console.log("Clearing Listing Cache...");
  localStorage.removeItem(CACHE_KEY);
};

/**
 * Initialize Listings with Real-time Sync and Cache
 */
function initListingsSync() {
  if (window.listingsSyncActive) return;
  window.listingsSyncActive = true;

  const grid = document.querySelector(".property-grid");
  if (!grid) return;

  // 1. Instant Load from Cache
  const cachedData = localStorage.getItem(CACHE_KEY);
  if (cachedData) {
    try {
      const { listings } = JSON.parse(cachedData);
      console.log("🚀 [Cache] Loading initial listings...");
      renderListings(listings);
    } catch (e) {
      console.error("Error parsing cache", e);
    }
  }

  // 2. Establish Real-time Listener
  console.log("📡 [Firebase] Connecting to real-time sync...");
  const q = query(collection(db, "Listings"));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      console.warn("No listings found in Firebase.");
      renderListings([]); // Clear UI if empty
      return;
    }

    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`🔥 [Firebase] Sync received: ${listings.length} listings`);

    // 3. Update Cache & Render
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      listings,
      timestamp: Date.now()
    }));

    renderListings(listings);

    // Check if we need to update active modal engagement (if open)
    const overlay = document.getElementById("modalOverlay");
    if (overlay && (overlay.classList.contains("open") || overlay.style.display === "flex")) {
      const modal = document.getElementById("propertyModal");
      const currentId = modal?.dataset?.currentId; // We should set this when opening modal
      if (currentId) {
        const updated = listings.find(l => l.id === currentId);
        if (updated) updateModalEngagement(updated);
      }
    }
  }, (error) => {
    console.error("Error in real-time sync:", error);
  });
}

function updateModalEngagement(data) {
  const visitsEl = document.getElementById("modalVisits");
  const likesEl = document.getElementById("modalLikes");
  const visitsLabel = document.getElementById("modalVisitsLabel");
  const likesLabel = document.getElementById("modalLikesLabel");

  if (visitsEl) visitsEl.textContent = data.visits || 0;
  if (likesEl) likesEl.textContent = data.likes || 0;
  if (visitsLabel) visitsLabel.textContent = (data.visits || 0) === 1 ? 'visit' : 'visits';
  if (likesLabel) likesLabel.textContent = (data.likes || 0) === 1 ? 'like' : 'likes';
}

function formatPriceAbbreviated(v) {
  if (!v) return "TBC";
  const num = Number(v);
  if (isNaN(num)) return v;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 ? 1 : 0)}m`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
  return num.toString();
}

function formatNumber(val) {
  if (!val) return "0";
  // Strip everything that isn't a digit or a decimal point
  const cleanVal = String(val).replace(/[^0-9.]/g, '');
  const num = Number(cleanVal);
  if (isNaN(num)) return val;
  return num.toLocaleString();
}

let currentPage = 1;
const recordsPerPage = 16;
let fullListings = [];

function renderListings(listings) {
  const grid = document.querySelector(".property-grid");
  if (!grid) return;

  // 0. Performance Check: Has the data actually changed?
  const currentIds = Array.from(grid.querySelectorAll('.property-card:not(.no-results-card)')).map(c => c.dataset.id).join(',');
  const newIds = listings.map(l => l.id).join(',');

  // If we are on the same page and data hasn't changed, skip heavy render
  if (!window.forceReRender && currentIds === newIds && fullListings.length === listings.length) {
    console.log("⚡ [Performance] Skipping redundant grid render");
    return;
  }

  fullListings = listings;

  // Read optional limit from grid OR its parent placeholder
  const parentPlaceholder = grid.closest("#listings-placeholder");
  const explicitLimit = parseInt(grid.dataset.limit) || (parentPlaceholder ? parseInt(parentPlaceholder.dataset.limit) : NaN);
  const isHomePage = !isNaN(explicitLimit);

  // Sort: Featured first
  const sorted = [...listings].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0; // Maintain order otherwise (could sort by date if available)
  });

  let displayList = [];
  if (isHomePage) {
    displayList = sorted.slice(0, explicitLimit);
    // Hide pagination container on index/home
    const container = document.getElementById("paginationControls");
    if (container) container.style.display = "none";
  } else {
    // PAGINATION LOGIC for Listings Page
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    displayList = sorted.slice(startIndex, endIndex);

    renderPagination(sorted.length);
  }

  grid.innerHTML = ""; // Clear grid
  const fragment = document.createDocumentFragment();

  displayList.forEach(data => {
    const card = createPropertyCard(data);
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);

  // Home page "View All" button visibility
  const viewAllBtn = document.querySelector(".view-all-row");
  if (viewAllBtn) {
    viewAllBtn.style.display = isHomePage ? "flex" : "none";
  }

  if (!document.getElementById("noResults")) {
    const noResults = document.createElement("div");
    noResults.id = "noResults";
    noResults.className = "property-card no-results-card";
    noResults.style.display = "none";
    noResults.innerHTML = `
      <div class="property-image" style="background:var(--glass-bg);display:flex;align-items:center;justify-content:center;height:220px;flex-direction:column;gap:16px;">
          <i class="fas fa-search" style="font-size:48px;color:var(--text);opacity:0.3;"></i>
          <h4 style="margin:0; opacity:0.8;">Nothing here. Try updating your filters</h4>
      </div>
    `;
    grid.appendChild(noResults);
  }

  // Dispatch event for other scripts (like filters) to re-init or update
  window.dispatchEvent(new Event("listingsLoaded"));
}

function renderPagination(totalRecords) {
  const container = document.getElementById("paginationControls");
  if (!container) return;

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  const startRecord = (currentPage - 1) * recordsPerPage + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  container.innerHTML = `
    <div class="pagination-info">
      <span>Showing <strong>${startRecord}-${endRecord}</strong> of <strong>${totalRecords}</strong> records</span>
    </div>
    <div class="pagination-nav">
      <button class="pagination-btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''} aria-label="Previous Page">
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="page-count">Page ${currentPage} of ${totalPages}</span>
      <button class="pagination-btn" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Next Page">
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `;

  // Bind Events
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");

  if (prev) prev.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderListings(fullListings);
      window.scrollTo({ top: document.getElementById("listings").offsetTop - 100, behavior: 'smooth' });
    }
  };

  if (next) next.onclick = () => {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderListings(fullListings);
      window.scrollTo({ top: document.getElementById("listings").offsetTop - 100, behavior: 'smooth' });
    }
  };
}

function createPropertyCard(data) {
  // Schema Mapping
  const title = data.title || "Untitled Property";
  const price = data.price || 0;
  const priceFormattedAbbr = formatPriceAbbreviated(data.price);
  const category = (data.category || "all").toLowerCase();
  const isFeatured = !!data.featured;

  // Nested objects with fallbacks
  const media = data.media || {};
  let imageSrc = media.thumbnail || "images/web-video.webp";
  if (imageSrc.includes("coming-soon")) imageSrc = "images/web-video.webp";

  const content = data.content || {};
  const shortDesc = content.short_description || "All-inclusive / key-in-hand";
  const fullDesc = content.full_description || "";
  const featuresList = content.features || [];

  const specs = data.specs || {};
  const beds = specs.beds || "";
  const baths = specs.baths || "";
  const size = specs.size || "";

  const type = data.type || "";

  const card = document.createElement("div");
  card.className = "property-card animate-on-scroll";

  // Data attributes for filters and modal
  card.dataset.category = category;
  card.dataset.status = (data.status || "").toLowerCase(); // New status filter
  card.dataset.price = price;
  card.dataset.type = type;
  card.dataset.beds = beds;
  card.dataset.baths = baths;
  card.dataset.size = size;
  card.dataset.address = shortDesc; // For the modal location field
  card.dataset.description = fullDesc;
  card.dataset.id = data.id || "";
  card.dataset.likes = data.likes || 0;
  card.dataset.visits = data.visits || 0;
  card.dataset.features = Array.isArray(featuresList) ? featuresList.join("|") : "";
  card.dataset.featured = isFeatured;
  card.dataset.gallery = JSON.stringify(media.images || []);

  // Feature icons HTML generation
  let featuresHTML = "";


  // Lot size icon
  if (specs.lot_size) {
    featuresHTML += `<div class="feature" data-tooltip="Lot Size"><i class="fa-solid fa-ruler-combined"></i> ${formatNumber(specs.lot_size)}sqm</div>`;
  }

  // Floor area icon
  if (specs.floor_area) {
    featuresHTML += `<div class="feature" data-tooltip="Floor Area"><i class="fa-solid fa-house"></i> ${formatNumber(specs.floor_area)}sqm</div>`;
  }

  // Beds icon
  if (beds) {
    featuresHTML += `<div class="feature" data-tooltip="Bedrooms"><i class="fa-solid fa-bed"></i> ${beds}</div>`;
  }

  // Baths icon
  if (baths) {
    featuresHTML += `<div class="feature" data-tooltip="Bathrooms"><i class="fa-solid fa-bath"></i> ${baths}</div>`;
  }

  // Add first few custom features as chips if space allows, or just icons.
  if (featuresList.some(f => f.toLowerCase().includes("pool"))) {
    featuresHTML += `<div class="feature" data-tooltip="Swimming Pool"><i class="fa-solid fa-person-swimming"></i></div>`;
  }
  if (featuresList.some(f => f.toLowerCase().includes("solar"))) {
    featuresHTML += `<div class="feature" data-tooltip="Solar Power"><i class="fa-solid fa-sun"></i></div>`;
  }

  // Conditionally render logo if featured (Hardcoded to dark for ribbons)
  const hbLogoImg = "images/homebuyer_dark2.png";

  const logoHTML = isFeatured
    ? `<div class="property-logo"><img src="${hbLogoImg}" alt="Paradise Life Homebuyer"></div>`
    : '';

  // Heart icon state for grid
  const hasLiked = localStorage.getItem(`liked_${data.id}`);
  const heartIcon = hasLiked ? 'fas fa-heart' : 'far fa-heart';
  const likedClass = hasLiked ? 'liked' : '';

  // Mock Nav Arrows for "just for show" if multiple images exist
  const hasMultipleImages = media.images && media.images.length > 1;
  const mockNavHTML = hasMultipleImages ? `
    <div class="mock-nav prev"><i class="fas fa-chevron-left"></i></div>
    <div class="mock-nav next"><i class="fas fa-chevron-right"></i></div>
  ` : '';

  card.innerHTML = `
        <div class="property-image">
          <img src="${imageSrc}" alt="${title}" loading="lazy">
          ${mockNavHTML}
          ${logoHTML}
          <button class="grid-like-btn ${likedClass}" data-id="${data.id}" aria-label="Like Property">
            <i class="${heartIcon}"></i>
          </button>
        </div>
        <div class="property-info primary">
          <span class="property-location">${title}</span>
          <span class="property-price">₱${priceFormattedAbbr}</span>
        </div>
        <div class="property-info">
          <span class="property-location">${shortDesc}</span>
        </div>
        <div class="property-features">
          ${featuresHTML}
        </div>
    `;

  return card;
}

/**
 * Global Tracking Functions
 */
window.trackVisit = async (propertyId) => {
  if (!propertyId) return;
  try {
    const propertyRef = doc(db, "Listings", propertyId);
    await updateDoc(propertyRef, {
      visits: increment(1)
    });
    console.log(`📈 Visit tracked for ${propertyId}`);
  } catch (e) {
    console.error("Error tracking visit:", e);
  }
};

window.trackLike = async (propertyId, isUnlike = false) => {
  if (!propertyId) return;
  try {
    const propertyRef = doc(db, "Listings", propertyId);
    await updateDoc(propertyRef, {
      likes: increment(isUnlike ? -1 : 1)
    });
    console.log(`${isUnlike ? '💔 Unlike' : '❤️ Like'} tracked for ${propertyId}`);
    return true;
  } catch (e) {
    console.error("Error tracking like/unlike:", e);
    return false;
  }
};

/**
 * Real-time Engagement Sync
 */
window.getLatestEngagement = async (propertyId) => {
  if (!propertyId) return null;
  try {
    const propertyRef = doc(db, "Listings", propertyId);
    const snap = await getDoc(propertyRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        likes: data.likes || 0,
        visits: data.visits || 0
      };
    }
  } catch (e) {
    console.error("Error fetching latest engagement:", e);
  }
  return null;
};

// Initialize when grid is ready (for dynamic loading)
window.addEventListener("listingsGridReady", () => {
  console.log("📦 Listings grid ready, initializing sync...");
  initListingsSync();
});

// Fallback for static pages or if script loads after injection
if (document.querySelector(".property-grid")) {
  initListingsSync();
}
