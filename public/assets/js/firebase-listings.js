import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
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
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in ms

/**
 * Public function to clear cache (used by admin dashboard)
 */
window.clearListingCache = function () {
  console.log("Clearing Listing Cache...");
  localStorage.removeItem(CACHE_KEY);
};

async function fetchListings() {
  const grid = document.querySelector(".property-grid");
  if (!grid) return;

  // 1. Try Cache First
  const cachedData = localStorage.getItem(CACHE_KEY);
  if (cachedData) {
    try {
      const { listings, timestamp } = JSON.parse(cachedData);
      const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

      if (!isExpired) {
        console.log("Loading listings from CACHE");
        renderListings(listings);
        return;
      }
      console.log("Cache expired, fetching fresh data...");
    } catch (e) {
      console.error("Error parsing cache", e);
    }
  }

  // 2. Fetch from Firebase
  try {
    console.log("Fetching listings from FIREBASE");
    const snapshot = await getDocs(collection(db, "Listings"));

    if (snapshot.empty) {
      console.warn("No listings found in Firebase.");
      return;
    }

    const listings = [];
    snapshot.forEach(doc => {
      listings.push({ id: doc.id, ...doc.data() });
    });

    // 3. Save to Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      listings,
      timestamp: Date.now()
    }));

    renderListings(listings);

  } catch (error) {
    console.error("Error fetching listings:", error);
  }
}

function formatPriceAbbreviated(v) {
  if (!v) return "TBC";
  const num = Number(v);
  if (isNaN(num)) return v;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 ? 1 : 0)}m`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
  return num.toString();
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
  const size = specs.lot_size || "";

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
  card.dataset.features = Array.isArray(featuresList) ? featuresList.join("|") : "";

  // Feature icons HTML generation
  let featuresHTML = "";

  // Size icon
  if (size) {
    featuresHTML += `<div class="feature"><i class="fa-solid fa-ruler-combined"></i> ${size}sqm</div>`;
  }

  // Floor area icon (optional from schema)
  if (specs.floor_area) {
    featuresHTML += `<div class="feature"><i class="fa-solid fa-house"></i> ${specs.floor_area}sqm</div>`;
  }

  // Beds icon
  if (beds) {
    featuresHTML += `<div class="feature"><i class="fa-solid fa-bed"></i> ${beds}</div>`;
  }

  // Baths icon
  if (baths) {
    featuresHTML += `<div class="feature"><i class="fa-solid fa-bath"></i> ${baths}</div>`;
  }

  // Add first few custom features as chips if space allows, or just icons.
  if (featuresList.some(f => f.toLowerCase().includes("pool"))) {
    featuresHTML += `<div class="feature"><i class="fa-solid fa-person-swimming"></i></div>`;
  }
  if (featuresList.some(f => f.toLowerCase().includes("solar"))) {
    featuresHTML += `<div class="feature"><i class="fa-solid fa-sun"></i></div>`;
  }

  const logoHTML = isFeatured ? '<div class="property-logo"><img src="images/logo2-dark.png" alt=""></div>' : '';

  card.innerHTML = `
        <div class="property-image">
          <img src="${imageSrc}" alt="${title}" loading="lazy">
          ${logoHTML}
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

fetchListings();
