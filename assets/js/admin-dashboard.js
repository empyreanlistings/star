import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, addDoc, getDoc, updateDoc, query, where, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const storage = getStorage(app);
const auth = getAuth(app);

console.log("Admin Dashboard Script Loaded");
// alert("Admin Script Loaded"); // Uncomment if needed for visible check

// Globals
let isEditMode = false;
let isInitialized = false;
let modal;
let currentUserCompany = null; // Store user's company reference
let currentUserId = null; // Store current user's UID
let galleryModal;
let isGalleryEditMode = false;
let palawanGalleryModal;
let isPalawanGalleryEditMode = false;

// Global Data Store for Filtering
let allListings = [];
let allGallery = [];
let allPalawanGallery = [];

// Filtering State
let dashboardFilters = {
    category: 'all',
    minPrice: 0,
    maxPrice: 50000000
};

// Init
document.addEventListener("DOMContentLoaded", () => {
    if (isInitialized) return;
    isInitialized = true;

    console.log("Admin Dashboard Initializing...");
    modal = document.getElementById("listingModal");
    galleryModal = document.getElementById("galleryModal");

    // Use Firebase Auth to check user and fetch company
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("User authenticated:", user.email);

            // Initialize UI elements
            initGlobalDelegation(); // Added for robust event handling

            // Sync collections
            initAdminListingsSync();
            initGallerySync();
            initPalawanGallerySync();

            // Initialize filters & events
            initDashboardFilters();
            initModalEvents();
            initGalleryModalEvents();
            initPalawanGalleryModalEvents();
            initPropertyModalEvents();
            initLocationPicker(); // Initialize Google Maps Places Autocomplete

            // 2. Fetch user's company and RE-INIT sync with filter
            await getUserCompany(user.uid);
            initAdminListingsSync();
        }
    });
});

/**
 * Global Event Delegation for Dynamic Content
 */
function initGlobalDelegation() {
    console.log("🛠️ [Global] Initializing Global Event Delegation...");

    document.addEventListener("click", async (e) => {
        const target = e.target;

        // 1. Action Buttons Delegation
        const actionBtn = target.closest(".action-btn");
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            if (actionBtn.classList.contains("edit")) {
                handleEdit(e);
            } else if (actionBtn.classList.contains("delete")) {
                handleDelete(e);
            } else if (actionBtn.classList.contains("duplicate")) {
                handleDuplicate(e);
            }
            return; // Stop here if it was an action button
        }

        // 2. Row Click Delegation (View Property)
        const tr = target.closest("tr");
        if (tr && tr.parentElement?.id === "listingsTableBody") {
            console.log("🕵️ [RowClick] Triggered for property view");
            const firstBtn = tr.querySelector(".action-btn");
            const id = firstBtn?.dataset.id;
            if (id) {
                const listing = allListings.find(l => l.id === id);
                if (listing) {
                    openPropertyModal(listing);
                } else {
                    console.warn("⚠️ [RowClick] Listing data not found for ID:", id);
                }
            }
        }
    });
}

// Fetch User's Company Reference
async function getUserCompany(uid) {
    try {
        const userDoc = await getDoc(doc(db, "Users", uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUserCompany = userData.company_id;
            console.log("User company loaded:", currentUserCompany?.id || "No company");
        } else {
            console.error("User document not found");
        }
    } catch (error) {
        console.error("Error fetching user company:", error);
    }
}



// Caching Constants (matched with firebase-listings.js)
const CACHE_KEY = "kai_isla_listings";
const GALLERY_CACHE_KEY = "kai_isla_gallery";

let activeListingsListener = null;
let activeGalleryListener = null;

/**
 * Initialize Admin Listings with Real-time Sync and Cache
 */
function initAdminListingsSync() {
    const tbody = document.getElementById("listingsTableBody");
    if (!tbody) return;

    if (activeListingsListener) {
        console.log("🔄 [Firebase] Unsubscribing previous admin listener...");
        activeListingsListener();
        activeListingsListener = null;
    }

    // 1. Instant Load from Cache
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            const { listings } = JSON.parse(cachedData);
            console.log("🚀 [Cache] Loading initial admin listings...");
            allListings = listings;
            applyDashboardFilters();
        } catch (e) {
            console.error("Error parsing cache", e);
        }
    }

    // 2. Establish Real-time Listener
    console.log("📡 [Firebase] Connecting to real-time admin sync...");

    // Apply company filter if it exists
    // The listener is established immediately. If currentUserCompany is not yet available,
    // it fetches all listings. Once currentUserCompany is set (after getUserCompany),
    // initAdminListingsSync is called again, unsubscribing the old listener and
    // establishing a new, filtered one.
    let listingsQuery = collection(db, "Listings");
    if (currentUserCompany) {
        console.log(`🔍 [Filter] Applying company sync: ${currentUserCompany.id}`);
        listingsQuery = query(listingsQuery, where("company", "==", currentUserCompany));
    } else {
        console.log("🔍 [Filter] No company filter applied yet. Fetching all listings.");
    }

    activeListingsListener = onSnapshot(listingsQuery, (snapshot) => {
        handleAdminSnapshot(snapshot);
    }, (error) => {
        console.error("Error in admin sync:", error);
    });
}

function handleAdminSnapshot(snapshot) {
    const tbody = document.getElementById("listingsTableBody");
    if (!tbody) return;

    if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:3rem;opacity:0.6;"><i class="fas fa-search" style="font-size:2rem;margin-bottom:1rem;display:block;"></i><strong>Nothing here. Try updating your filters</strong></td></tr>`;
        allListings = [];
        return;
    }

    allListings = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    console.log(`🔥 [Firebase] Admin sync received: ${allListings.length} listings`);

    // 3. Update Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        listings: allListings,
        timestamp: Date.now()
    }));

    currentListings = allListings; // Update global for sorting

    // 4. Apply Filters & Render
    applyDashboardFilters();
}

function applyDashboardFilters() {
    let filtered = [...allListings];

    // Category Filter
    if (dashboardFilters.category !== 'all') {
        filtered = filtered.filter(l => {
            const cat = (l.category || '').toLowerCase().trim();
            return cat === dashboardFilters.category;
        });
    }

    // Price Filter
    filtered = filtered.filter(l => {
        const p = parseInt(l.price) || 0;
        return p >= dashboardFilters.minPrice && p <= dashboardFilters.maxPrice;
    });

    // Apply sorting to the filtered set if active
    if (sortConfig.column) {
        const col = sortConfig.column;
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            let valA = a[col] || '';
            let valB = b[col] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return -dir;
            if (valA > valB) return dir;
            return 0;
        });
    }

    renderAdminTable(filtered);
}

function renderAdminTable(listings) {
    const tbody = document.getElementById("listingsTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    // PAGINATION
    const totalRecords = listings.length;
    const startIndex = (listingsPage - 1) * listingsPerPage;
    const endIndex = startIndex + listingsPerPage;
    const paginatedListings = listings.slice(startIndex, endIndex);

    paginatedListings.forEach(data => {
        const id = data.id;
        const title = data.title || "Untitled";
        const thumbnail = data.media?.thumbnail || "images/coming-soon.webp";
        const price = data.price ? `₱${Number(data.price).toLocaleString()}` : "TBC";
        const status = data.status || "-";
        const category = data.category || "All";
        const shortDesc = data.content?.short_description || "";

        // Gallery Badge Logic
        const allImages = data.media?.images || [];
        const thumbUrl = data.media?.thumbnail;
        const galleryItems = allImages.filter(url => url !== thumbUrl);
        const galleryCount = galleryItems.length;

        // Source Icon Logic
        let sourceHtml = '<i class="fas fa-user source-icon user" title="Manual / User"></i>';
        if (data.whatsapp) {
            sourceHtml = '<i class="fab fa-whatsapp source-icon whatsapp" title="WhatsApp Source"></i>';
        } else if (data.telegram) {
            sourceHtml = '<i class="fab fa-telegram source-icon telegram" title="Telegram Source"></i>';
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div class="thumb-wrapper">
                    <img src="${thumbnail}" alt="thumb">
                    ${galleryCount > 0 ? `<span class="gallery-badge" title="${galleryCount} more images">${galleryCount}</span>` : ''}
                </div>
            </td>
            <td>
                <strong>${title}</strong><br>
                <small style="opacity: 0.7;">${shortDesc}</small>
            </td>
            <td><span style="text-transform: capitalize;">${status.replace('_', ' ')}</span></td>
            <td>${price}</td>
            <td><span class="status-badge status-active">${category.toUpperCase()}</span></td>
            <td style="text-align:center;">${sourceHtml}</td>
            <td style="text-align:center;">${data.featured ? '<i class="fas fa-star" style="color:var(--accent);"></i>' : ''}</td>
            <td style="text-align:center;">${data.visits || 0}</td>
            <td style="text-align:center;">${data.likes || 0}</td>
            <td>
                <button class="action-btn edit" data-id="${id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="action-btn duplicate" data-id="${id}" title="Duplicate / Copy"><i class="fas fa-copy"></i></button>
                <button class="action-btn delete" data-id="${id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Pagination helper will be called here
    renderTablePagination("listingsPagination", totalRecords, listingsPerPage, listingsPage, (newPage) => {
        listingsPage = newPage;
        applyDashboardFilters(); // Re-apply filters and render
        document.getElementById("listingsTableContainer").scrollIntoView({ behavior: 'smooth' });
    });

    initSorting();
}

let currentListings = [];
let sortConfig = { column: null, direction: 'asc' };

// Pagination State
let listingsPage = 1;
const listingsPerPage = 25;
let galleryPage = 1;
const galleryPerPage = 10;
let palawanPage = 1;
const palawanPerPage = 10;

// Shared Pagination Helper
// =============================================================================
// SHARED UI HELPERS
// =============================================================================

function renderTablePagination(containerId, totalRecords, recordsPerPage, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    if (totalPages === 0) {
        container.innerHTML = "";
        return;
    }

    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

    container.innerHTML = `
        <div class="pagination-container">
            <div class="pagination-info">
                Showing <strong>${startRecord}-${endRecord}</strong> of <strong>${totalRecords}</strong>
            </div>
            <div class="pagination-nav">
                <button class="pagination-btn" id="${containerId}_prev" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span class="page-count">Page ${currentPage} of ${totalPages}</span>
                <button class="pagination-btn" id="${containerId}_next" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;

    const prevBtn = document.getElementById(`${containerId}_prev`);
    const nextBtn = document.getElementById(`${containerId}_next`);

    if (prevBtn) prevBtn.onclick = () => onPageChange(currentPage - 1);
    if (nextBtn) nextBtn.onclick = () => onPageChange(currentPage + 1);
}

// Google Maps Location Picker
function initLocationPicker() {
    const input = document.getElementById('locationSearch');
    if (!input) return;

    try {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['geocode', 'establishment']
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                console.log("Returned place contains no geometry");
                return;
            }

            document.getElementById('locLat').value = place.geometry.location.lat();
            document.getElementById('locLng').value = place.geometry.location.lng();

            // Extract Area and Municipality
            let area = "";
            let municipality = "";

            place.address_components.forEach(component => {
                const types = component.types;
                if (types.includes('sublocality') || types.includes('neighborhood')) {
                    area = component.long_name;
                }
                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                    municipality = component.long_name;
                }
            });

            document.getElementById('locArea').value = area;
            document.getElementById('locMunicipality').value = municipality;
        });
    } catch (err) {
        console.error("Google Maps failed to load or initialize:", err);
    }
}

function initSorting() {
    const headers = document.querySelectorAll("#listingsTableContainer th.sortable");
    headers.forEach(th => {
        th.style.cursor = "pointer";
        th.onclick = () => {
            const column = th.dataset.sort;
            if (sortConfig.column === column) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.column = column;
                sortConfig.direction = 'asc';
            }
            listingsPage = 1; // Reset to first page on sort change
            sortListings();
            updateSortIcons(column, sortConfig.direction);
        };
    });
}

function updateSortIcons(column, direction) {
    document.querySelectorAll("#listingsTableContainer th.sortable i").forEach(i => i.className = "fas fa-sort");
    const activeHeader = document.querySelector(`#listingsTableContainer th[data-sort="${column}"] i`);
    if (activeHeader) {
        activeHeader.className = `fas fa-sort-${direction === 'asc' ? 'up' : 'down'}`;
    }
}

function sortListings() {
    if (!currentListings.length) return;

    currentListings.sort((a, b) => {
        let valA = a[sortConfig.column];
        let valB = b[sortConfig.column];

        // Handle nested or special fields
        if (sortConfig.column === 'price') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else if (['visits', 'likes'].includes(sortConfig.column)) {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else if (sortConfig.column === 'featured') {
            valA = a.featured ? 1 : 0;
            valB = b.featured ? 1 : 0;
        } else {
            valA = (valA || "").toString().toLowerCase();
            valB = (valB || "").toString().toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    renderAdminTable(currentListings, true); // true = prevent infinite recursion if we called sort inside render
}

// Updated Render Function to support Sorting State
// NOTE: We overwrite the previous renderAdminTable but need to keep its core logic
// For simplicity in this `replace_file_content`, we are injecting helper functions.
// To fully hook this up, we need to modify handleAdminSnapshot to update `currentListings` global.

// Duplicate
async function handleDuplicate(e) {
    const btn = e.target.closest("button");
    const id = btn.dataset.id;
    if (!confirm("Duplicate this listing?")) return;

    try {
        const docRef = doc(db, "Listings", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Create a copy
            const newData = { ...data };
            newData.title = `${data.title} (Copy)`;
            newData.created_at = new Date().toISOString();
            if (newData.updated_at) delete newData.updated_at; // Reset updated

            await addDoc(collection(db, "Listings"), newData);
            // Invalidate cache
            localStorage.removeItem("kai_isla_listings");
            // No need to call fetchAdminListings, the real-time listener will update
            alert("Listing duplicated.");
        }
    } catch (error) {
        console.error(error);
        alert("Failed to duplicate.");
    }
}

// Delete
async function handleDelete(e) {
    const btn = e.target.closest("button");
    const id = btn.dataset.id;
    if (!confirm("Delete this listing?")) return;

    try {
        await deleteDoc(doc(db, "Listings", id));
        // Invalidate cache
        localStorage.removeItem("kai_isla_listings");
        // No need to call fetchAdminListings, the real-time listener will update
        alert("Deleted.");
    } catch (error) {
        console.error(error);
        alert("Failed to delete.");
    }
}

// Edit - Open Modal & Populate
async function handleEdit(e) {
    try {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.dataset.id;
        console.log("📝 [Edit] handleEdit triggered for ID:", id);

        // Reset Form First
        openModal(true); // true = edit mode

        const idInput = document.getElementById("listingId");
        if (idInput) idInput.value = id;

        const docRef = doc(db, "Listings", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("📥 [Edit] Document data fetched:", data.title);

            const setField = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val !== undefined && val !== null ? val : "";
            };

            setField("propTitle", data.title);
            setField("propSlug", data.slug);
            setField("propPrice", data.price);
            setField("propCurrency", data.currency || "PHP");
            setField("propType", data.type);
            setField("propCategory", data.category);
            setField("propStatus", data.status);

            const featuredEl = document.getElementById("propFeatured");
            if (featuredEl) featuredEl.checked = !!data.featured;

            const displayEl = document.getElementById("propDisplay");
            if (displayEl) displayEl.checked = data.display !== false; // default true

            setField("propShortDesc", data.content?.short_description);
            setField("propFullDesc", data.content?.full_description);

            setField("propBeds", data.specs?.beds);
            setField("propBaths", data.specs?.baths);
            setField("propSize", data.specs?.size);
            setField("propLotSize", data.specs?.lot_size);
            setField("propFloorArea", data.specs?.floor_area);

            // Lead Source
            if (data.whatsapp) document.getElementById("sourceWhatsapp").checked = true;
            else if (data.telegram) document.getElementById("sourceTelegram").checked = true;
            else document.getElementById("sourceUser").checked = true;

            // Location
            setField("locArea", data.location?.area);
            setField("locMunicipality", data.location?.municipality);
            setField("locLat", data.location?.coordinates?.lat);
            setField("locLng", data.location?.coordinates?.lng);
            const locSearch = document.getElementById("locationSearch");
            if (locSearch) locSearch.value = data.location?.display || "";

            // Meta
            setField("metaTitle", data.meta?.title);
            setField("metaDesc", data.meta?.description);

            const featuresInput = document.getElementById("propFeatures");
            if (featuresInput) {
                const features = data.content?.features || [];
                featuresInput.value = Array.isArray(features) ? features.join(", ") : "";
            }

            // Populate Gallery
            const allImages = data.media?.images || [];
            const thumb = data.media?.thumbnail;
            currentGalleryState = allImages.filter(url => url !== thumb);
            updateGalleryPreview();

        } else {
            console.error("❌ [Edit] No such document!");
            alert("Error: Listing not found in database.");
        }
    } catch (error) {
        console.error("❌ [Edit] Error in handleEdit:", error);
    }
}

// Modal Events Helper
function closeModal() {
    if (!modal) return;
    modal.classList.remove("active");
    setTimeout(() => {
        if (!modal.classList.contains("active")) {
            modal.style.display = "none";
        }
    }, 400);
}

// =============================================================================
// GALLERY UPLOAD LOGIC
// =============================================================================
let currentGalleryState = []; // Stores mixed array of Strings (URLs) and File objects

function initGalleryLogic() {
    const galleryInput = document.getElementById("propGallery");
    console.log("🛠️ [Gallery] Initializing logic. Input found:", !!galleryInput);

    if (galleryInput) {
        galleryInput.addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            console.log(`📸 [Gallery] Selected ${files.length} files`);
            if (files.length > 0) {
                currentGalleryState = [...currentGalleryState, ...files];
                updateGalleryPreview();
                galleryInput.value = ""; // Reset to allow adding more
            }
        });
    } else {
        console.error("❌ [Gallery] #propGallery input not found!");
    }
}

function updateGalleryPreview() {
    const grid = document.getElementById("galleryPreview");
    if (!grid) return;
    grid.innerHTML = "";
    console.log(`🖼️ [Gallery] Updating preview with ${currentGalleryState.length} items`);

    currentGalleryState.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "preview-item";

        const img = document.createElement("img");
        if (item instanceof File) {
            img.src = URL.createObjectURL(item);
        } else {
            img.src = item;
        }

        const btn = document.createElement("button");
        btn.className = "preview-remove";
        btn.innerHTML = "&times;";
        btn.onclick = () => {
            console.log(`🗑️ [Gallery] Removing item at index ${index}`);
            currentGalleryState.splice(index, 1);
            updateGalleryPreview();
        };

        div.appendChild(img);
        div.appendChild(btn);
        grid.appendChild(div);
    });
}

function initModalEvents() {
    console.log("Initializing Modal Events...");
    const addBtn = document.getElementById("addListingBtn");
    const closeBtn = document.getElementById("closeModal");

    if (!modal) {
        console.error("Listing Modal NOT FOUND");
        return;
    }

    console.log("Modal Elements Found:", { modal, addBtn, closeBtn });

    if (addBtn) addBtn.onclick = () => openModal(false);
    if (closeBtn) closeBtn.onclick = closeModal;

    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    const form = document.getElementById("listingForm");
    if (form) {
        form.addEventListener("submit", handleFormSubmit);
    }

    initGalleryLogic();
}

function openModal(edit = false) {
    console.log("🚀 [Modal] openModal triggered. Edit Mode:", edit);
    isEditMode = edit;

    if (!modal) {
        modal = document.getElementById("listingModal");
        if (!modal) {
            console.error("❌ [Modal] CRITICAL: listingModal NOT FOUND in DOM");
            return;
        }
    }

    const form = document.getElementById("listingForm");
    const title = document.getElementById("modalTitle");
    const submitBtn = document.getElementById("submitBtn");
    const idInput = document.getElementById("listingId");
    const imgInput = document.getElementById("propImage");

    if (!form || !title || !submitBtn) {
        console.error("❌ [Modal] Missing elements inside listingModal", { form, title, submitBtn });
        return;
    }

    form.reset();
    currentGalleryState = []; // Reset gallery
    updateGalleryPreview();

    // Reset Hidden Location Fields
    const lat = document.getElementById('locLat');
    const lng = document.getElementById('locLng');
    if (lat) lat.value = "";
    if (lng) lng.value = "";

    // Safer transition trigger: display then active class with delay
    modal.style.display = "flex";
    modal.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important; pointer-events: auto !important;";

    setTimeout(() => {
        modal.classList.add("active");
    }, 10);

    if (edit) {
        title.textContent = "Edit Property";
        submitBtn.textContent = "Save Changes";
        imgInput.removeAttribute("required");
    } else {
        title.textContent = "Add New Property";
        submitBtn.textContent = "Create Listing";
        idInput.value = "";
        imgInput.setAttribute("required", "true");
    }
}

// Form Submit (Create or Update)
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById("submitBtn");
    const statusDiv = document.getElementById("uploadStatus");
    const id = document.getElementById("listingId").value;

    submitBtn.disabled = true;
    statusDiv.textContent = isEditMode ? "Saving changes..." : "Uploading & Creating...";

    try {
        console.log("💾 [Submit] Starting form submission...");

        // Lead Source Logic
        const leadSource = document.querySelector('input[name="leadSource"]:checked')?.value;
        const isWhatsapp = leadSource === "whatsapp";
        const isTelegram = leadSource === "telegram";

        // Prepare Data Object (Base)
        let docData = {
            title: document.getElementById("propTitle").value,
            slug: document.getElementById("propSlug").value || document.getElementById("propTitle").value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            price: Number(document.getElementById("propPrice").value),
            currency: document.getElementById("propCurrency").value,
            type: document.getElementById("propType").value,
            category: document.getElementById("propCategory").value,
            status: document.getElementById("propStatus").value,
            featured: document.getElementById("propFeatured").checked,
            display: document.getElementById("propDisplay").checked,
            whatsapp: isWhatsapp,
            telegram: isTelegram,
            location: {
                display: document.getElementById("locationSearch").value,
                area: document.getElementById("locArea").value,
                municipality: document.getElementById("locMunicipality").value,
                coordinates: {
                    lat: Number(document.getElementById("locLat").value) || null,
                    lng: Number(document.getElementById("locLng").value) || null
                }
            },
            meta: {
                title: document.getElementById("metaTitle").value,
                description: document.getElementById("metaDesc").value
            },
            content: {
                short_description: document.getElementById("propShortDesc").value,
                full_description: document.getElementById("propFullDesc").value,
                features: document.getElementById("propFeatures").value.split(",").map(s => s.trim()).filter(Boolean)
            },
            specs: {
                beds: document.getElementById("propBeds").value,
                baths: document.getElementById("propBaths").value,
                size: document.getElementById("propSize").value,
                lot_size: document.getElementById("propLotSize").value,
                floor_area: document.getElementById("propFloorArea").value
            },
            updated_at: new Date().toISOString()
        };

        // 1. Handle Thumbnail Upload (Slide 1)
        let thumbnailURL = null;
        const fileInput = document.getElementById("propImage");

        if (fileInput.files.length > 0) {
            console.log("📤 [Submit] Uploading new thumbnail...");
            statusDiv.textContent = "Uploading thumbnail...";
            const file = fileInput.files[0];
            const resizedBlob = await compressAndConvertToWebP(file, 800);
            const storageRef = ref(storage, 'property-images/' + Date.now() + '_thumb_' + file.name.split('.')[0] + '.webp');
            await uploadBytes(storageRef, resizedBlob);
            thumbnailURL = await getDownloadURL(storageRef);
        } else if (isEditMode && id) {
            console.log("📥 [Submit] Fetching existing thumbnail...");
            const docRef = doc(db, "Listings", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                thumbnailURL = docSnap.data().media?.thumbnail;
            }
        }

        // 2. Handle Gallery Uploads (Slides 2+)
        // 2. Handle Gallery Uploads (Slides 2+)
        console.log(`📤 [Submit] Processing ${currentGalleryState.length} gallery items...`);
        statusDiv.textContent = "Uploading gallery images...";

        // Parallel Uploads
        const uploadPromises = currentGalleryState.map(async (item) => {
            if (item instanceof File) {
                const resizedBlob = await compressAndConvertToWebP(item, 800);
                const storageRef = ref(storage, 'property-images/' + Date.now() + '_gallery_' + item.name.split('.')[0] + '.webp');
                await uploadBytes(storageRef, resizedBlob);
                const url = await getDownloadURL(storageRef);
                return url;
            } else if (typeof item === 'string') {
                return item;
            }
            return null;
        });

        const galleryURLs = (await Promise.all(uploadPromises)).filter(Boolean);
        console.log(`✅ [Submit] Gallery URLs processed: ${galleryURLs.length}`);

        // 3. Construct Media Object
        const finalImages = [thumbnailURL, ...galleryURLs].filter(Boolean);

        docData.media = {
            thumbnail: thumbnailURL,
            images: finalImages
        };

        if (isEditMode && id) {
            // UPDATE
            console.log("📝 [Submit] Updating existing listing...");
            const docRef = doc(db, "Listings", id);
            if (currentUserId) docData.editor = doc(db, "Users", currentUserId);
            docData.edited_date = serverTimestamp();

            await updateDoc(docRef, docData);
            localStorage.removeItem("kai_isla_listings");
            alert("Listing updated successfully!");
        } else {
            // CREATE
            console.log("✨ [Submit] Creating new listing...");
            if (!thumbnailURL) throw new Error("Thumbnail is required.");
            if (currentUserCompany) docData.company = currentUserCompany;
            if (currentUserId) docData.creator = doc(db, "Users", currentUserId);
            docData.created_date = serverTimestamp();

            await addDoc(collection(db, "Listings"), docData);
            localStorage.removeItem("kai_isla_listings");
            alert("Listing created successfully!");
        }

        closeModal();
    } catch (error) {
        console.error("Error saving listing:", error);
        alert("Error: " + error.message);
    } finally {
        submitBtn.disabled = false;
        statusDiv.textContent = "";
    }
}

// =============================================================================
// PROPERTY MODAL (VIEW DETAILS)
// =============================================================================

function initPropertyModalEvents() {
    console.log("🛠️ [PropertyModal] Initializing Property View Modal Events...");
    const overlay = document.getElementById("modalOverlay");
    const closeBtn = document.getElementById("modalClose");

    if (closeBtn) closeBtn.onclick = closePropertyModal;

    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) closePropertyModal();
        };
    }
}

function closePropertyModal() {
    const overlay = document.getElementById("modalOverlay");
    const modal = document.getElementById("propertyModal");

    if (overlay) {
        overlay.classList.remove("open");
        overlay.style.cssText = ""; // Reset inline hacks
    }
    if (modal) {
        modal.classList.remove("open");
        modal.style.cssText = ""; // Reset inline hacks
    }

    document.body.style.overflow = ""; // Re-enable scrolling
}

// Open Property Modal with listing data
function openPropertyModal(data) {
    console.log("🔍 [PropertyModal] openPropertyModal called for:", data?.title);
    const overlay = document.getElementById("modalOverlay");
    const modal = document.getElementById("propertyModal");

    if (!overlay || !modal) {
        console.error("❌ [PropertyModal] overlay or modal NOT FOUND", { overlay, modal });
        return;
    }

    // Populate modal fields
    try {
        const getEl = (id) => {
            const el = document.getElementById(id);
            if (!el) console.warn(`⚠️ [PropertyModal] Element #${id} missing`);
            return el;
        };

        const img = getEl("modalImage");
        const locationEl = getEl("modalLocation");
        const typeEl = getEl("modalType");
        const priceEl = getEl("modalPrice");
        const bedsEl = getEl("modalBeds");
        const bathsEl = getEl("modalBaths");
        const sizeEl = getEl("modalSize");
        const descEl = getEl("modalDescription");
        const featuresEl = getEl("modalFeatures");
        const visitsEl = getEl("modalVisits");
        const likesEl = getEl("modalLikes");
        const visitsLabel = getEl("modalVisitsLabel");
        const likesLabel = getEl("modalLikesLabel");

        if (img) img.src = data.media?.thumbnail || "images/coming-soon.webp";
        if (locationEl) locationEl.textContent = data.title || "Untitled";
        if (typeEl) typeEl.textContent = data.type || "";
        if (priceEl) {
            const price = data.price ? `₱${Number(data.price).toLocaleString()}` : "TBC";
            priceEl.textContent = price;
        }
        if (bedsEl) bedsEl.textContent = data.specs?.beds || "-";
        if (bathsEl) bathsEl.textContent = data.specs?.baths || "-";
        if (sizeEl) sizeEl.textContent = data.specs?.lot_size || "-";
        if (descEl) descEl.textContent = data.content?.full_description || data.content?.short_description || "";

        // Features
        if (featuresEl) {
            featuresEl.innerHTML = "";
            const features = data.content?.features || [];
            features.forEach(f => {
                const li = document.createElement("li");
                li.textContent = f;
                featuresEl.appendChild(li);
            });
        }

        // Engagement stats
        const visits = data.visits || 0;
        const likes = data.likes || 0;
        if (visitsEl) visitsEl.textContent = visits;
        if (likesEl) likesEl.textContent = likes;
        if (visitsLabel) visitsLabel.textContent = visits === 1 ? 'visit' : 'visits';
        if (likesLabel) likesLabel.textContent = likes === 1 ? 'like' : 'likes';

        // Open modal
        overlay.classList.add("open");
        modal.classList.add("open");
        document.body.style.overflow = "hidden";

        // Use inline styles to override any display:none
        overlay.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important; pointer-events: auto !important;";
        modal.style.cssText = "display: block !important; visibility: visible !important; opacity: 1 !important;";

        console.log("✅ [PropertyModal] Finished populating and showing modal.");
    } catch (err) {
        console.error("❌ [PropertyModal] Error populating modal:", err);
    }
}

// Dashboard Table Filters
function initDashboardFilters() {
    const section = document.getElementById('listingsTableContainer');
    if (!section) {
        console.warn('Dashboard filters: listingsTableContainer not found');
        return;
    }

    const filterBtns = section.querySelectorAll('.property-gallery-filters .filter');
    const priceMin = document.getElementById('dashPriceMin');
    const priceMax = document.getElementById('dashPriceMax');
    const priceRangeValue = document.getElementById('dashPriceRangeValue');

    if (!filterBtns.length || !priceMin || !priceMax) return;

    const formatPrice = v => {
        if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)} m`;
        if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)} k`;
        return `₱${v} `;
    };

    const updatePriceDisplay = () => {
        if (priceRangeValue) {
            if (dashboardFilters.minPrice === 0 && dashboardFilters.maxPrice === 50000000) {
                priceRangeValue.textContent = 'Any Price';
            } else {
                priceRangeValue.textContent = `${formatPrice(dashboardFilters.minPrice)} – ${formatPrice(dashboardFilters.maxPrice)} `;
            }
        }
    };

    // Category filter buttons
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dashboardFilters.category = btn.dataset.filter.toLowerCase();
            listingsPage = 1; // Reset to page 1
            applyDashboardFilters();
        };
    });

    // Price sliders
    const updateSlider = () => {
        const min = parseInt(priceMin.value);
        const max = parseInt(priceMax.value);

        if (min > max - 1000000) {
            if (priceMin === document.activeElement) {
                priceMin.value = Math.max(0, max - 1000000);
            } else {
                priceMax.value = Math.min(50000000, min + 1000000);
            }
        }

        dashboardFilters.minPrice = parseInt(priceMin.value);
        dashboardFilters.maxPrice = parseInt(priceMax.value);

        const percentMin = (dashboardFilters.minPrice / 50000000) * 100;
        const percentMax = (dashboardFilters.maxPrice / 50000000) * 100;

        const sliderRange = document.querySelector('.slider-range-inline');
        if (sliderRange) {
            sliderRange.style.left = percentMin + '%';
            sliderRange.style.width = (percentMax - percentMin) + '%';
        }

        updatePriceDisplay();
        listingsPage = 1; // Reset to page 1
        applyDashboardFilters();
    };

    if (priceMin && priceMax) {
        priceMin.oninput = updateSlider;
        priceMax.oninput = updateSlider;
        updateSlider(); // Initial run
    }
}

// Call this at the end of renderAdminTable
window.initDashboardFilters = initDashboardFilters;


// =============================================================================
// GALLERY MANAGEMENT
// =============================================================================

function initGallerySync() {
    const tbody = document.getElementById("galleryTableBody");
    if (!tbody) return;

    if (activeGalleryListener) {
        activeGalleryListener();
        activeGalleryListener = null;
    }

    // 1. Load from Cache
    const cachedData = localStorage.getItem(GALLERY_CACHE_KEY);
    if (cachedData) {
        try {
            const { gallery } = JSON.parse(cachedData);
            allGallery = gallery;
            applyGalleryFilters();
        } catch (e) {
            console.error("Gallery cache error", e);
        }
    }

    // 2. Listener
    console.log("📡 [Firebase] Connecting to real-time Gallery sync...");
    activeGalleryListener = onSnapshot(collection(db, "Gallery"), (snapshot) => {
        allGallery = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        console.log(`🔥[Firebase] Gallery sync received: ${allGallery.length} items`);
        localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify({
            gallery: allGallery,
            timestamp: Date.now()
        }));
        applyGalleryFilters();
    }, (error) => {
        console.error("❌ [Firebase] Gallery sync error:", error);
    });
}

function applyGalleryFilters() {
    let filtered = [...allGallery];
    const filterContainer = document.querySelector('.gallery-type-filters');
    const activeFilter = filterContainer?.querySelector('.filter.active')?.dataset.filter || 'all';

    if (activeFilter !== 'all') {
        filtered = filtered.filter(item => (item.category || '').toLowerCase() === activeFilter);
    }

    renderGalleryTable(filtered);
}

function renderGalleryTable(gallery) {
    const tbody = document.getElementById("galleryTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    gallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    if (gallery.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;opacity:0.6;">No gallery items found.</td></tr>`;
        return;
    }

    // PAGINATION
    const totalRecords = gallery.length;
    const startIndex = (galleryPage - 1) * galleryPerPage;
    const endIndex = startIndex + galleryPerPage;
    const paginatedGallery = gallery.slice(startIndex, endIndex);

    paginatedGallery.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${item.image}" alt="gallery"></td>
            <td>
                <strong>${item.headline || "Untitled"}</strong><br>
                <small style="opacity: 0.7;">${item.sub_header || ""}</small>
            </td>
            <td><span class="status-badge status-active">${item.category?.toUpperCase() || "STRUCTURAL"}</span></td>
            <td style="text-align:center;">${item.display ? '<i class="fas fa-check" style="color:var(--accent);"></i>' : ''}</td>
            <td>
                <button class="action-btn edit-gallery" data-id="${item.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete delete-gallery" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Render Pagination
    renderTablePagination("galleryPagination", totalRecords, galleryPerPage, galleryPage, (newPage) => {
        galleryPage = newPage;
        applyGalleryFilters();
        document.getElementById("gallerySection").scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelectorAll(".edit-gallery").forEach(btn => btn.onclick = handleGalleryEdit);
    document.querySelectorAll(".delete-gallery").forEach(btn => btn.onclick = handleGalleryDelete);

    // Initial filter run
    if (typeof initGalleryFilters === 'function') initGalleryFilters();
}

async function handleGalleryDelete(e) {
    const id = e.target.closest("button").dataset.id;
    if (!confirm("Delete this gallery item?")) return;
    try {
        await deleteDoc(doc(db, "Gallery", id));
        localStorage.removeItem(GALLERY_CACHE_KEY);
    } catch (err) {
        alert("Delete failed: " + err.message);
    }
}

async function handleGalleryEdit(e) {
    const id = e.target.closest("button").dataset.id;
    isGalleryEditMode = true;
    openGalleryModal(true);
    document.getElementById("galleryItemId").value = id;

    const docSnap = await getDoc(doc(db, "Gallery", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById("galleryHeadline").value = data.headline || "";
        document.getElementById("gallerySubHeader").value = data.sub_header || "";
        setSelectedCategory(data.category || "structural"); // Use helper for chips
        document.getElementById("galleryDisplay").checked = !!data.display;
    }
}

/**
 * GALLERY FILTERING & CHIP LOGIC
 */
function initGalleryFilters() {
    const filterContainer = document.querySelector('.gallery-type-filters');
    if (!filterContainer) return;

    const filterBtns = filterContainer.querySelectorAll('.filter');
    if (!filterBtns.length) return;

    filterBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            galleryPage = 1; // Reset to page 1
            applyGalleryFilters();
        };
    });
}

function initCategoryChips() {
    const chips = document.querySelectorAll("#galleryCategoryChips .chip");
    chips.forEach(chip => {
        chip.onclick = () => {
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
        };
    });
}

function getSelectedCategory() {
    const activeChip = document.querySelector("#galleryCategoryChips .chip.active");
    return activeChip ? activeChip.dataset.value : "structural";
}

function setSelectedCategory(value) {
    const chips = document.querySelectorAll("#galleryCategoryChips .chip");
    chips.forEach(c => {
        if (c.dataset.value === value) {
            c.classList.add("active");
        } else {
            c.classList.remove("active");
        }
    });
}

function initGalleryModalEvents() {
    const addBtn = document.getElementById("addGalleryBtn");
    const closeBtn = document.getElementById("closeGalleryModal");
    const form = document.getElementById("galleryForm");

    console.log("🛠️ [Gallery] Initializing Gallery Modal Events...");
    if (addBtn) {
        console.log("   ✅ addGalleryBtn found");
        addBtn.onclick = () => openGalleryModal(false);
    } else {
        console.warn("   ❌ addGalleryBtn NOT FOUND");
    }
    if (closeBtn) closeBtn.onclick = closeGalleryModal;
    if (form) form.onsubmit = handleGalleryFormSubmit;

    initCategoryChips();
    console.log("   ✅ Gallery Modal Events initialized");
}

function openGalleryModal(edit = false) {
    console.log("🚀 [GalleryModal] openGalleryModal triggered. Edit Mode:", edit);
    isGalleryEditMode = edit;
    const form = document.getElementById("galleryForm");
    if (form) form.reset();

    const titleEl = document.getElementById("galleryModalTitle");
    const submitBtn = document.getElementById("gallerySubmitBtn");
    const imgInput = document.getElementById("galleryImage");

    if (titleEl) titleEl.textContent = edit ? "Edit Gallery Item" : "Add New Gallery Item";
    if (submitBtn) submitBtn.textContent = edit ? "Save Changes" : "Upload Gallery Item";
    if (imgInput) imgInput.required = !edit;

    if (!edit) {
        setSelectedCategory("structural");
    }

    // Safer transition trigger: display then active class with delay
    galleryModal.style.display = "flex";
    setTimeout(() => {
        galleryModal.classList.add("active");
    }, 10);
}

function closeGalleryModal() {
    galleryModal.classList.remove("active");
    setTimeout(() => {
        if (!galleryModal.classList.contains("active")) {
            galleryModal.style.display = "none";
        }
    }, 400);
}

async function handleGalleryFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("gallerySubmitBtn");
    const status = document.getElementById("galleryUploadStatus");
    const id = document.getElementById("galleryItemId").value;

    submitBtn.disabled = true;
    status.textContent = "Processing image...";

    try {
        let imageUrl = null;
        const fileInput = document.getElementById("galleryImage");

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const resizedBlob = await compressAndConvertToWebP(file, 800);
            status.textContent = "Uploading optimized image...";
            const storageRef = ref(storage, `gallery/${Date.now()}_${file.name.split('.')[0]}.webp`);
            await uploadBytes(storageRef, resizedBlob);
            imageUrl = await getDownloadURL(storageRef);
        }

        const docData = {
            headline: document.getElementById("galleryHeadline").value,
            sub_header: document.getElementById("gallerySubHeader").value,
            category: getSelectedCategory(), // Use helper for chips
            display: document.getElementById("galleryDisplay").checked,
            added_at: serverTimestamp(),
            added_by: doc(db, "Users", currentUserId)
        };

        if (imageUrl) docData.image = imageUrl;

        if (isGalleryEditMode) {
            await updateDoc(doc(db, "Gallery", id), docData);
        } else {
            await addDoc(collection(db, "Gallery"), docData);
        }

        localStorage.removeItem(GALLERY_CACHE_KEY);
        closeGalleryModal();
    } catch (err) {
        alert("Upload failed: " + err.message);
    } finally {
        submitBtn.disabled = false;
        status.textContent = "";
    }
}

async function compressAndConvertToWebP(file, maxWidth = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// =============================================================================
// PALAWAN GALLERY MANAGEMENT
// =============================================================================

const PALAWAN_GALLERY_CACHE_KEY = "kai_isla_palawan_gallery";
let activePalawanGalleryListener = null;

function initPalawanGallerySync() {
    console.log("🛠️ [Palawan] Initializing Palawan Gallery Sync...");
    const tbody = document.getElementById("palawanGalleryTableBody");
    if (!tbody) {
        console.warn("   ❌ palawanGalleryTableBody NOT FOUND");
        return;
    }

    if (activePalawanGalleryListener) {
        activePalawanGalleryListener();
        activePalawanGalleryListener = null;
    }

    // 1. Load from Cache
    const cachedData = localStorage.getItem(PALAWAN_GALLERY_CACHE_KEY);
    if (cachedData) {
        try {
            const { gallery } = JSON.parse(cachedData);
            allPalawanGallery = gallery;
            renderPalawanGalleryTable(allPalawanGallery);
        } catch (e) {
            console.error("Palawan gallery cache error", e);
        }
    }

    // 2. Real-time Listener
    console.log("📡 [Firebase] Connecting to real-time Palawan sync...");
    activePalawanGalleryListener = onSnapshot(collection(db, "PalawanGallery"), (snapshot) => {
        allPalawanGallery = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        console.log(`🔥[Firebase] Palawan sync received: ${allPalawanGallery.length} items`);
        localStorage.setItem(PALAWAN_GALLERY_CACHE_KEY, JSON.stringify({
            gallery: allPalawanGallery,
            timestamp: Date.now()
        }));
        applyPalawanGalleryFilters();
    }, (error) => {
        console.error("❌ [Firebase] Palawan sync error:", error);
    });
}

function applyPalawanGalleryFilters() {
    renderPalawanGalleryTable(allPalawanGallery);
}

function renderPalawanGalleryTable(gallery) {
    const tbody = document.getElementById("palawanGalleryTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    gallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    if (gallery.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;opacity:0.6;">No Palawan items found.</td></tr>`;
        return;
    }

    // PAGINATION
    const totalRecords = gallery.length;
    const startIndex = (palawanPage - 1) * palawanPerPage;
    const endIndex = startIndex + palawanPerPage;
    const paginatedPalawan = gallery.slice(startIndex, endIndex);

    paginatedPalawan.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${item.image}" alt="palawan"></td>
            <td>
                <strong>${item.title || "Untitled"}</strong><br>
                <small style="opacity: 0.7;">${item.description || ""}</small>
            </td>
            <td style="text-align:center;">${item.display ? '<i class="fas fa-check" style="color:var(--accent);"></i>' : ''}</td>
            <td>
                <button class="action-btn edit-palawan-gallery" data-id="${item.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete delete-palawan-gallery" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Render Pagination
    renderTablePagination("palawanGalleryPagination", totalRecords, palawanPerPage, palawanPage, (newPage) => {
        palawanPage = newPage;
        applyPalawanGalleryFilters();
        document.getElementById("palawanGallerySection").scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelectorAll(".edit-palawan-gallery").forEach(btn => btn.onclick = handlePalawanGalleryEdit);
    document.querySelectorAll(".delete-palawan-gallery").forEach(btn => btn.onclick = handlePalawanGalleryDelete);
}

async function handlePalawanGalleryDelete(e) {
    const id = e.target.closest("button").dataset.id;
    if (!confirm("Delete this Palawan gallery item?")) return;
    try {
        await deleteDoc(doc(db, "PalawanGallery", id));
        localStorage.removeItem(PALAWAN_GALLERY_CACHE_KEY);
    } catch (err) {
        alert("Delete failed: " + err.message);
    }
}

async function handlePalawanGalleryEdit(e) {
    const id = e.target.closest("button").dataset.id;
    isPalawanGalleryEditMode = true;
    openPalawanGalleryModal(true);
    document.getElementById("palawanGalleryItemId").value = id;

    const docSnap = await getDoc(doc(db, "PalawanGallery", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById("palawanGalleryTitle").value = data.title || "";
        document.getElementById("palawanGalleryDescription").value = data.description || "";
        document.getElementById("palawanGalleryDisplay").checked = !!data.display;
    }
}

function initPalawanGalleryModalEvents() {
    console.log("🛠️ [Palawan] Initializing Palawan Gallery Modal Events...");
    palawanGalleryModal = document.getElementById("palawanGalleryModal");
    const addBtn = document.getElementById("addPalawanGalleryBtn");
    const closeBtn = document.getElementById("closePalawanGalleryModal");

    console.log("   🔍 Palawan Elements:", { palawanGalleryModal, addBtn, closeBtn });

    if (!palawanGalleryModal) {
        console.error("   ❌ Palawan Gallery Modal NOT FOUND");
        return;
    }

    if (addBtn) {
        addBtn.onclick = () => openPalawanGalleryModal(false);
    }
    if (closeBtn) closeBtn.onclick = closePalawanGalleryModal;

    window.addEventListener("click", (e) => {
        if (e.target === palawanGalleryModal) closePalawanGalleryModal();
    });

    const form = document.getElementById("palawanGalleryForm");
    if (form) {
        form.addEventListener("submit", handlePalawanGalleryFormSubmit);
    }
}

function openPalawanGalleryModal(edit = false) {
    isPalawanGalleryEditMode = edit;
    const form = document.getElementById("palawanGalleryForm");
    const title = document.getElementById("palawanGalleryModalTitle");
    const submitBtn = document.getElementById("palawanGallerySubmitBtn");
    const imgInput = document.getElementById("palawanGalleryImage");

    if (!form || !title || !submitBtn) {
        console.error("Palawan Gallery modal elements missing");
        return;
    }

    form.reset();

    palawanGalleryModal.style.display = "flex";
    setTimeout(() => {
        palawanGalleryModal.classList.add("active");
    }, 10);

    if (edit) {
        title.textContent = "Edit Palawan Gallery Item";
        submitBtn.textContent = "Save Changes";
        imgInput.removeAttribute("required");
    } else {
        title.textContent = "Add New Palawan Gallery Item";
        submitBtn.textContent = "Upload Palawan Gallery Item";
        document.getElementById("palawanGalleryItemId").value = "";
        imgInput.setAttribute("required", "true");
    }
}

function closePalawanGalleryModal() {
    palawanGalleryModal.classList.remove("active");
    setTimeout(() => {
        if (!palawanGalleryModal.classList.contains("active")) {
            palawanGalleryModal.style.display = "none";
        }
    }, 400);
}

async function handlePalawanGalleryFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("palawanGallerySubmitBtn");
    const status = document.getElementById("palawanGalleryUploadStatus");
    const id = document.getElementById("palawanGalleryItemId").value;

    submitBtn.disabled = true;
    status.textContent = "Processing image...";

    try {
        console.log("Palawan Gallery Form Submission Started");
        let imageUrl = null;
        const fileInput = document.getElementById("palawanGalleryImage");

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            console.log("🚀 [Upload] File selected:", file.name, "(" + (file.size / 1024).toFixed(2) + " KB)");
            const resizedBlob = await compressAndConvertToWebP(file, 800);
            console.log("🚀 [Upload] Starting Firebase Storage upload...");
            status.textContent = "Uploading optimized image...";
            const storageRef = ref(storage, `palawan-gallery/${Date.now()}_${file.name.split('.')[0]}.webp`);
            await uploadBytes(storageRef, resizedBlob);
            imageUrl = await getDownloadURL(storageRef);
            console.log("✅ [Upload] Image uploaded successfully. URL:", imageUrl);
        }

        const docData = {
            title: document.getElementById("palawanGalleryTitle").value,
            description: document.getElementById("palawanGalleryDescription").value,
            display: document.getElementById("palawanGalleryDisplay").checked,
            added_at: serverTimestamp(),
            added_by: doc(db, "Users", currentUserId)
        };

        if (imageUrl) docData.image = imageUrl;

        if (isPalawanGalleryEditMode) {
            await updateDoc(doc(db, "PalawanGallery", id), docData);
        } else {
            await addDoc(collection(db, "PalawanGallery"), docData);
        }

        localStorage.removeItem(PALAWAN_GALLERY_CACHE_KEY);
        closePalawanGalleryModal();
    } catch (err) {
        console.error("Palawan Gallery Upload Error:", err);
        alert("Upload failed: " + err.message);
    } finally {
        submitBtn.disabled = false;
        status.textContent = "";
    }
}
