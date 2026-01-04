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
  apiKey: "AIzaSyArViUzMduVitt8FJDrSVPC_IQTeQrDFX4",
  authDomain: "kaiandisla-rulryn.firebaseapp.com",
  projectId: "kaiandisla-rulryn",
  storageBucket: "kaiandisla-rulryn.firebasestorage.app",
  messagingSenderId: "155934228174",
  appId: "1:155934228174:web:a4bcdc4b9702980c4e1a9f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Caching Constants
const CACHE_KEY = "kai_isla_listings";

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

function renderListings(listings) {
  const grid = document.querySelector(".property-grid");
  if (!grid) return;

  // Read optional limit (e.g., 8 for home page)
  const limit = parseInt(grid.dataset.limit);

  // Sort: Featured first
  const sorted = [...listings].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0; // Maintain order otherwise (could sort by date if available)
  });

  // Apply limit if specified
  const displayList = !isNaN(limit) ? sorted.slice(0, limit) : sorted;

  grid.innerHTML = ""; // Clear grid
  const fragment = document.createDocumentFragment();

  displayList.forEach(data => {
    const card = createPropertyCard(data);
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);

  // Add the "No Results" card back (it's hidden by CSS or filter script usually)
  const noResults = document.createElement("div");
  noResults.id = "noResults";
  noResults.className = "property-card no-results-card";
  noResults.style.display = "none";
  noResults.innerHTML = `
    <div class="property-image" style="background:var(--glass-bg);display:flex;align-items:center;justify-content:center;height:220px;flex-direction:column;gap:16px;">
        <i class="fas fa-search" style="font-size:48px;color:var(--text);opacity:0.3;"></i>
        <h4 style="margin:0; opacity:0.8;">No results, try adjusting your filters</h4>
    </div>
  `;
  grid.appendChild(noResults);

  // Dispatch event for other scripts (like filters) to re-init or update
  window.dispatchEvent(new Event("listingsLoaded"));
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
  const imageSrc = media.thumbnail || "images/coming-soon.webp";

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

  card.innerHTML = `
        <div class="property-image">
          <img src="${imageSrc}" alt="${title}" loading="lazy">
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

initListingsSync();
