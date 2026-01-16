import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, addDoc, getDoc, updateDoc, query, where, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { submitManualEnquiry } from "./firebase-enquiries.js";

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
let inspectionModal;
let currentInspectionGallery = [];
let enquiryDetailsModal;
let inspectionDetailsModal;

// Activity Comments
let activeCommentsListener = null;
let userAvatarCache = {}; // Cache for user avatars {userId: {name, avatar}}

// Global Data Store for Filtering
let allListings = [];
let allGallery = [];
let allPalawanGallery = [];
let allInspections = [];

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
    inspectionModal = document.getElementById("inspectionModal");
    enquiryDetailsModal = document.getElementById("enquiryDetailsModal");
    inspectionDetailsModal = document.getElementById("inspectionDetailsModal");

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
            initEnquirySync();
            initInspectionsSync();

            // Initialize filters & events
            initDashboardFilters();
            initModalEvents();
            initGalleryModalEvents();
            initPalawanGalleryModalEvents();
            initInspectionModalEvents();
            initPropertyModalEvents();
            initEnquiryModalEvents(); // Keep but triggers moved to global
            initEnquiryDetailsModalEvents();
            initInspectionDetailsModalEvents();
            initEditButtonFeedback(); // Added for user feedback on Edit actions
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

        if (target.closest("#addEnquiryBtn, #addEnquiryNavbarBtn")) {
            console.log("🖱️ [Global] Add Enquiry button clicked");
            if (typeof openEnquiryModal === 'function') openEnquiryModal();
            return;
        }

        if (target.closest("#addListingBtn, #addListingNavbarBtn")) {
            console.log("🖱️ [Global] Add Listing button clicked");
            if (typeof openModal === 'function') openModal(false); // false = not edit mode
            return;
        }

        if (target.closest("#addInspectionBtn, #addInspectionNavbarBtn")) {
            console.log("🖱️ [Global] Add Inspection button clicked");
            if (typeof openInspectionModal === 'function') openInspectionModal();
            return;
        }

        // Enquiry Details Edit Button
        const detEnqEditBtn = target.closest("#detEnqEditBtn");
        if (detEnqEditBtn) {
            const id = detEnqEditBtn.dataset.id;
            if (id) {
                closeEnquiryDetailsModal();
                handleEditEnquiry(id);
            }
            return;
        }

        // Enquiry Actions Delegation
        const enqActionBtn = target.closest(".action-btn");
        if (enqActionBtn && (enqActionBtn.classList.contains("edit-enquiry") || enqActionBtn.classList.contains("delete-enquiry") || enqActionBtn.classList.contains("toggle-responded"))) {
            const id = enqActionBtn.dataset.id;
            if (enqActionBtn.classList.contains("edit-enquiry")) {
                handleEditEnquiry(id);
            } else if (enqActionBtn.classList.contains("delete-enquiry")) {
                if (confirm("Are you sure you need to delete this enquiry?")) {
                    deleteDoc(doc(db, "Enquiries", id)).then(() => console.log("Deleted enquiry", id));
                }
            } else if (enqActionBtn.classList.contains("toggle-responded")) {
                // Fetch current status or just toggle via a helper if available, for now manual toggle reference:
                // We need to know current state or just toggle. Simple approach:
                const isResponded = enqActionBtn.querySelector("i").classList.contains("fa-undo"); // If undo icon, it is currently responded
                updateDoc(doc(db, "Enquiries", id), { responded: !isResponded });
            }
            return;
        }

        // Enquiry Row Click (Details)
        const enqTr = target.closest("tr");
        if (enqTr && enqTr.closest("#enquiriesTableBody") && !target.closest("button") && !target.closest("a")) {
            // We need the enquiry object. Since we don't have it direct, we can look it up or use data attribute.
            // We can look up in allEnquiries array.
            // Let's rely on finding it by some index or ID if we stored it?
            // Or better, let renderEnquiryTable store data-id on TR.
            const enqId = enqTr.dataset.id;
            if (enqId && typeof allEnquiries !== 'undefined') {
                const enq = allEnquiries.find(e => e.id === enqId);
                if (enq) openEnquiryDetailsModal(enq);
            }
            return;
        }


        // 2. Row Click Delegation (View Property)
        const tr = target.closest("tr");
        if (tr && tr.parentElement && tr.parentElement.id === "listingsTableBody") {
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

        // Abbreviate Price
        let price = "TBC";
        if (data.price) {
            const numPrice = Number(data.price);
            if (numPrice >= 1000000) {
                price = `₱${(numPrice / 1000000).toFixed(1)}m`;
            } else if (numPrice >= 1000) {
                price = `₱${(numPrice / 1000).toFixed(1)}k`;
            } else {
                price = `₱${numPrice.toLocaleString()}`;
            }
        }

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
            <td style="width: 80px;">
                <div class="thumb-wrapper">
                    <img src="${thumbnail}" alt="thumb">
                    ${galleryCount > 0 ? `<span class="gallery-badge" title="${galleryCount} more images">${galleryCount}</span>` : ''}
                </div>
            </td>
            <td style="min-width: 250px;">
                <strong>${title}</strong><br>
                <small style="opacity: 0.7;">${shortDesc}</small>
            </td>
            <td style="width: 100px;"><span style="text-transform: capitalize;">${status.replace('_', ' ')}</span></td>
            <td style="width: 100px;">${price}</td>
            <td style="width: 120px;"><span class="status-badge status-active">${category.toUpperCase()}</span></td>
            <td style="width: 60px; text-align:center;">${sourceHtml}</td>
            <td style="width: 60px; text-align:center;">${data.featured ? '<i class="fas fa-star featured-star"></i>' : ''}</td>
            <td style="width: 60px; text-align:center;">${data.visits || 0}</td>
            <td style="width: 60px; text-align:center;">${data.likes || 0}</td>
            <td style="width: 140px; white-space: nowrap;">
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
let inspectionsPage = 1;
const inspectionsPerPage = 20;

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
async function initLocationPicker() {
    const input = document.getElementById('locationSearch');
    if (!input) return;

    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.warn("Google Maps API not loaded yet. Waiting...");
        window.initMapCallback = initLocationPicker;
        return;
    }

    try {
        console.log("📍 [Maps] Initializing Location Picker...");

        // Strategy: Use PlaceAutocompleteElement if available (recommended by Google)
        // Check if the custom element is defined or the library is loaded
        if (google.maps.importLibrary) {
            const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
            if (PlaceAutocompleteElement) {
                console.log("✅ [Maps] Using modern PlaceAutocompleteElement");
                const autocompleteElement = new google.maps.places.PlaceAutocompleteElement({
                    types: ['geocode', 'establishment']
                });

                // Style it to match the existing input
                autocompleteElement.style.width = "100%";
                autocompleteElement.style.marginTop = "10px";

                // Replace or append
                const container = input.parentElement;
                if (container) {
                    // We hide the old input and add the new element
                    input.style.display = 'none';
                    // Avoid double injection
                    const existing = container.querySelector('gmpx-place-autocomplete');
                    if (!existing) {
                        container.appendChild(autocompleteElement);
                    }

                    autocompleteElement.addEventListener('gmp-placeselect', async ({ place: placeInstance }) => {
                        await placeInstance.fetchFields({
                            fields: ['displayName', 'formattedAddress', 'location', 'addressComponents']
                        });

                        const lat = placeInstance.location.lat();
                        const lng = placeInstance.location.lng();

                        document.getElementById('locLat').value = lat;
                        document.getElementById('locLng').value = lng;

                        // Extract Area and Municipality
                        let area = "";
                        let municipality = "";

                        if (placeInstance.addressComponents) {
                            placeInstance.addressComponents.forEach(component => {
                                const types = component.types;
                                if (types.includes('sublocality') || types.includes('neighborhood')) {
                                    area = component.longText;
                                }
                                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                                    municipality = component.longText;
                                }
                            });
                            if (area) document.getElementById('locArea').value = area;
                            if (municipality) document.getElementById('locMunicipality').value = municipality;
                        }
                    });
                }
            }
        }
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
            if (data.whatsapp) document.getElementById("sourceWhatsappMain").checked = true;
            else if (data.telegram) document.getElementById("sourceTelegramMain").checked = true;
            else document.getElementById("sourceUserMain").checked = true;

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

            // New Detailed Fields
            const saleCheck = document.getElementById("propListingForSale");
            if (saleCheck) saleCheck.checked = !!data.listing_for_sale;
            const leaseCheck = document.getElementById("propListingForLease");
            if (leaseCheck) leaseCheck.checked = !!data.listing_for_lease;

            setField("propLeasePrice", data.lease_price);
            setField("propFloorNumber", data.floor_number);
            setField("propUnitNumber", data.unit_number);
            setField("propParkingSpaces", data.parking_spaces);

            const parkingCheck = document.getElementById("propHasParking");
            if (parkingCheck) {
                parkingCheck.checked = !!data.has_parking;
                const pcont = document.getElementById("propParkingSpacesContainer");
                if (pcont) pcont.style.display = parkingCheck.checked ? "block" : "none";
            }

            const furnishedCheck = document.getElementById("propFurnished");
            if (furnishedCheck) furnishedCheck.checked = !!data.furnished;
            const balconyCheck = document.getElementById("propBalcony");
            if (balconyCheck) balconyCheck.checked = !!data.balcony;

            // Lead Source (Updated for standardized radios)
            const source = data.source || (data.whatsapp ? "whatsapp" : (data.telegram ? "telegram" : "user"));
            const sourceRadio = document.querySelector(`input[name="leadSource"][value="${source}"]`);
            if (sourceRadio) {
                sourceRadio.checked = true;
                const tcont = document.getElementById("telegramLinkContainerMain");
                if (tcont) tcont.style.display = (source === "telegram") ? "block" : "none";
            }
            setField("propTelegramLink", data.telegram_link);

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
// =============================================================================
// ENQUIRY MODAL LOGIC
// =============================================================================
let enquiryModal;

function initEnquiryModalEvents() {
    enquiryModal = document.getElementById("enquiryModal");
    const closeBtn = document.getElementById("closeEnquiryModal");
    const form = document.getElementById("enquiryForm");

    // Close buttons logic remains the same
    // Triggers are now handled by Global Delegation (initGlobalDelegation)

    if (closeBtn && enquiryModal) {
        closeBtn.onclick = () => {
            enquiryModal.classList.remove("active");
            setTimeout(() => enquiryModal.style.display = "none", 300);
        };
    }

    if (enquiryModal) {
        window.addEventListener("click", (e) => {
            if (e.target === enquiryModal) {
                enquiryModal.classList.remove("active");
                setTimeout(() => enquiryModal.style.display = "none", 300);
            }
        });

        // Visibility Logic for Telegram Link
        const sourceRadios = enquiryModal.querySelectorAll('input[name="enqSource"]');
        const telegramLinkContainer = document.getElementById("telegramLinkContainer");
        sourceRadios.forEach(radio => {
            radio.addEventListener("change", () => {
                if (telegramLinkContainer) {
                    telegramLinkContainer.style.display = (radio.value === "telegram" && radio.checked) ? "block" : "none";
                }
            });
        });

        // Visibility Logic for Parking Spaces
        const parkingCheckbox = document.getElementById("enqHasParking");
        const parkingSpacesContainer = document.getElementById("parkingSpacesContainer");
        if (parkingCheckbox) {
            parkingCheckbox.addEventListener("change", () => {
                if (parkingSpacesContainer) {
                    parkingSpacesContainer.style.display = parkingCheckbox.checked ? "block" : "none";
                }
            });
        }
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById("enqSubmitBtn");
            const statusDiv = document.getElementById("enqStatus");

            submitBtn.disabled = true;
            submitBtn.textContent = "Adding...";
            statusDiv.textContent = "";

            // Gather Data
            const forSale = document.getElementById("enqListingForSale").checked;
            const forLease = document.getElementById("enqListingForLease").checked;

            if (!forSale && !forLease) {
                statusDiv.textContent = "⚠️ Select at least one Listing Type.";
                statusDiv.style.color = "orange";
                submitBtn.disabled = false;
                submitBtn.textContent = "Add Enquiry";
                return;
            }

            const sourceRadio = document.querySelector('input[name="enqSource"]:checked');

            const data = {
                name: document.getElementById("enqName").value,
                email: document.getElementById("enqEmail").value,
                phone: document.getElementById("enqPhone").value,
                responded: document.getElementById("enqResponded").checked,
                off_plan: document.getElementById("enqOffPlan").checked,
                custom_build: document.getElementById("enqCustomBuild").checked,

                // New Fields
                listing_for_sale: forSale,
                listing_for_lease: forLease,
                property_type: document.getElementById("enqPropType").value,
                has_parking: document.getElementById("enqHasParking").checked,
                parking_spaces: document.getElementById("enqParkingSpaces").value || 0,
                furnished: document.getElementById("enqFurnished").checked,
                balcony: document.getElementById("enqBalcony").checked,
                floor_number: document.getElementById("enqFloorNumber").value,
                unit_number: document.getElementById("enqUnitNumber").value,
                area: document.getElementById("enqArea").value,
                selling_price: document.getElementById("enqSellingPrice").value,
                lease_price: document.getElementById("enqLeasePrice").value,

                // Source
                source: sourceRadio ? sourceRadio.value : "manual",
                telegram_link: document.getElementById("enqTelegramLink").value,

                comments: document.getElementById("enqComments").value
            };

            const enqId = document.getElementById("enqId").value;

            try {
                if (enqId) {
                    await updateDoc(doc(db, "Enquiries", enqId), data);
                    console.log("✅ Enquiry updated:", enqId);
                } else {
                    await submitManualEnquiry(data);
                }

                statusDiv.textContent = enqId ? "✅ Enquiry Updated!" : "✅ Enquiry Added!";
                statusDiv.style.color = "var(--accent)";

                setTimeout(() => {
                    enquiryModal.classList.remove("active");
                    setTimeout(() => enquiryModal.style.display = "none", 300);
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Add Enquiry";
                    statusDiv.textContent = ""; // Clear status after successful operation
                }, 1500);

            } catch (err) {
                console.error(err);
                statusDiv.textContent = "❌ Error: " + err.message;
                statusDiv.style.color = "red";
                submitBtn.disabled = false;
                submitBtn.textContent = "Add Enquiry";
            }
        });
    }
}

function openEnquiryModal() {
    if (!enquiryModal) return;
    const form = document.getElementById("enquiryForm");
    if (form) form.reset();

    // Reset ID and UI
    document.getElementById("enqId").value = "";
    document.getElementById("enquiryModalTitle").textContent = "Manually Add Enquiry";
    document.getElementById("enqSubmitBtn").textContent = "Add Enquiry";

    // Set defaults
    document.getElementById("enqOffPlan").checked = true;
    const websiteRadio = document.querySelector('input[name="enqSource"][value="website"]');
    if (websiteRadio) websiteRadio.checked = true;

    // Hide conditional containers
    const telegramLinkContainer = document.getElementById("telegramLinkContainer");
    if (telegramLinkContainer) telegramLinkContainer.style.display = "none";
    const parkingSpacesContainer = document.getElementById("parkingSpacesContainer");
    if (parkingSpacesContainer) parkingSpacesContainer.style.display = "none";

    enquiryModal.style.display = "flex";
    setTimeout(() => enquiryModal.classList.add("active"), 10);
}

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
    // Triggers are now handled by Global Delegation (initGlobalDelegation)
    const closeBtn = document.getElementById("closeModal");
    const addBtn = document.getElementById("addListingBtn");
    const navAddBtn = document.getElementById("addListingNavbarBtn");

    if (!modal) {
        console.error("Listing Modal NOT FOUND");
        return;
    }

    console.log("Modal Elements Found:", { modal, addBtn, navAddBtn, closeBtn });

    if (addBtn) addBtn.onclick = () => openModal(false);
    if (navAddBtn) navAddBtn.onclick = () => openModal(false);
    if (closeBtn) closeBtn.onclick = closeModal;

    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    const form = document.getElementById("listingForm");
    if (form) {
        form.addEventListener("submit", handleFormSubmit);
    }

    initGalleryLogic();

    // Visibility Logic for Telegram Link (Listing Modal)
    const sourceRadios = modal.querySelectorAll('input[name="leadSource"]');
    const telegramLinkContainerMain = document.getElementById("telegramLinkContainerMain");
    sourceRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            if (telegramLinkContainerMain) {
                telegramLinkContainerMain.style.display = (radio.value === "telegram" && radio.checked) ? "block" : "none";
            }
        });
    });

    // Visibility Logic for Parking Spaces (Listing Modal)
    const parkingCheckboxMain = document.getElementById("propHasParking");
    const parkingSpacesContainerMain = document.getElementById("propParkingSpacesContainer");
    if (parkingCheckboxMain) {
        parkingCheckboxMain.addEventListener("change", () => {
            if (parkingSpacesContainerMain) {
                parkingSpacesContainerMain.style.display = parkingCheckboxMain.checked ? "block" : "none";
            }
        });
    }
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

    // Reset Hidden Conditional Containers
    const telegramLinkContainerMain = document.getElementById("telegramLinkContainerMain");
    if (telegramLinkContainerMain) telegramLinkContainerMain.style.display = "none";
    const parkingSpacesContainerMain = document.getElementById("propParkingSpacesContainer");
    if (parkingSpacesContainerMain) parkingSpacesContainerMain.style.display = "none";

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

        // Lead Source Logic (Standardized)
        const sourceRadio = document.querySelector('input[name="leadSource"]:checked');
        const source = sourceRadio ? sourceRadio.value : "user";
        const telegramLink = document.getElementById("propTelegramLink").value;

        // Listing Type Validation
        const forSale = document.getElementById("propListingForSale").checked;
        const forLease = document.getElementById("propListingForLease").checked;

        if (!forSale && !forLease) {
            statusDiv.textContent = "⚠️ Select at least one Listing Type.";
            statusDiv.style.color = "orange";
            submitBtn.disabled = false;
            return;
        }

        // Prepare Data Object (Base)
        let docData = {
            title: document.getElementById("propTitle").value,
            slug: document.getElementById("propSlug").value || document.getElementById("propTitle").value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            price: Number(document.getElementById("propPrice").value), // Selling Price
            lease_price: Number(document.getElementById("propLeasePrice").value) || 0,
            currency: document.getElementById("propCurrency").value,
            type: document.getElementById("propType").value,
            category: document.getElementById("propCategory").value,
            status: document.getElementById("propStatus").value,
            featured: document.getElementById("propFeatured").checked,
            display: document.getElementById("propDisplay").checked,

            // New Detailed Fields
            listing_for_sale: forSale,
            listing_for_lease: forLease,
            floor_number: document.getElementById("propFloorNumber").value,
            unit_number: document.getElementById("propUnitNumber").value,

            has_parking: document.getElementById("propHasParking").checked,
            parking_spaces: parseInt(document.getElementById("propParkingSpaces").value) || 0,
            furnished: document.getElementById("propFurnished").checked,
            balcony: document.getElementById("propBalcony").checked,

            // Lead Source
            source: source,
            telegram_link: telegramLink,
            whatsapp: source === "whatsapp", // legacy comp
            telegram: source === "telegram", // legacy comp
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

/**
 * Initialize Inspection Modal Events
 */
function initInspectionModalEvents() {
    console.log("🛠️ [Inspection] Initializing Inspection Modal Events...");
    const closeBtn = document.getElementById("closeInspectionModal");
    if (closeBtn) closeBtn.onclick = closeInspectionModal;

    window.addEventListener("click", (e) => {
        if (e.target === inspectionModal) closeInspectionModal();
    });

    const form = document.getElementById("inspectionForm");
    if (form) {
        form.addEventListener("submit", handleInspectionFormSubmit);
    }

    // Development Selection Change Listener
    const devSelect = document.getElementById("inspDevelopment");
    if (devSelect) {
        devSelect.addEventListener("change", fetchPlotsForDevelopment);
    }

    // Check if modal is hidden by CSS by default
    const style = window.getComputedStyle(inspectionModal);
    console.log("   🎨 Modal Computed Style (Display):", style.display);
}

/**
 * Open Inspection Modal
 */
function openInspectionModal() {
    console.log("   🔓 openInspectionModal() called.");
    if (!inspectionModal) {
        console.error("   ❌ Cannot open modal: inspectionModal is null");
        return;
    }

    // Reset Form
    const form = document.getElementById("inspectionForm");
    if (form) form.reset();
    const status = document.getElementById("inspUploadStatus");
    if (status) status.textContent = "";

    // Show Modal
    inspectionModal.style.display = "flex";
    console.log("   ➡️ Set display to flex. Current style:", inspectionModal.style.display);

    // Force reflow
    void inspectionModal.offsetWidth;

    setTimeout(() => {
        inspectionModal.classList.add("active");
        console.log("   ➡️ Added 'active' class.");
    }, 10);

    // Fetch Developments to populate dropdown
    fetchDevelopments();
}

/**
 * Close Inspection Modal
 */
function closeInspectionModal() {
    if (!inspectionModal) return;
    inspectionModal.classList.remove("active");
    setTimeout(() => {
        if (!inspectionModal.classList.contains("active")) {
            inspectionModal.style.display = "none";
        }
    }, 400);
}

/**
 * Fetch Developments for Company
 */
async function fetchDevelopments() {
    const devSelect = document.getElementById("inspDevelopment");
    if (!devSelect) return;

    devSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        let q = collection(db, "Developments");
        if (currentUserCompany) {
            // Ensure currentUserCompany is a reference or use ID comparison depending on your schema
            // If currentUserCompany is an object/doc ref:
            q = query(q, where("company", "==", currentUserCompany));
        }

        const snapshot = await getDocs(q);
        devSelect.innerHTML = '<option value="">Select Development</option>';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = data.title || "Untitled Development";
            devSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching developments:", err);
        devSelect.innerHTML = '<option value="">Error loading</option>';
    }
}

/**
 * Fetch Plots based on selected Development
 */
async function fetchPlotsForDevelopment() {
    const devId = document.getElementById("inspDevelopment").value;
    const plotSelect = document.getElementById("inspPlot");

    if (!plotSelect) return;

    plotSelect.innerHTML = '<option value="">Loading...</option>';
    plotSelect.disabled = true;

    if (!devId) {
        plotSelect.innerHTML = '<option value="">Select Plot</option>';
        return;
    }

    try {
        const devRef = doc(db, "Developments", devId);
        const q = query(collection(db, "Plots"), where("development", "==", devRef));

        const snapshot = await getDocs(q);
        plotSelect.innerHTML = '<option value="">Select Plot</option>';
        plotSelect.disabled = false;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = `Plot ${data.number || data.title || "Untitled"}`;
            plotSelect.appendChild(option);
        });

    } catch (err) {
        console.error("Error fetching plots:", err);
        plotSelect.innerHTML = '<option value="">Error loading</option>';
    }
}

/**
 * Handle Inspection Form Submit
 */
async function handleInspectionFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("inspSubmitBtn");
    const status = document.getElementById("inspUploadStatus");

    submitBtn.disabled = true;
    status.textContent = "Creating Inspection Report...";

    try {
        const developmentId = document.getElementById("inspDevelopment").value;
        const plotId = document.getElementById("inspPlot").value;
        const title = document.getElementById("inspTitle").value;
        const note = document.getElementById("inspNote").value;
        const files = document.getElementById("inspMedia").files;

        // 1. Upload Images
        const mediaUrls = [];
        if (files.length > 0) {
            status.textContent = `Uploading ${files.length} images...`;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const resizedBlob = await compressAndConvertToWebP(file, 1000);
                const storageRef = ref(storage, `inspections/${Date.now()}_${i}.webp`);
                await uploadBytes(storageRef, resizedBlob);
                const url = await getDownloadURL(storageRef);
                mediaUrls.push(url);
            }
        }

        // 2. Create Document
        const docData = {
            title: title,
            development: doc(db, "Developments", developmentId),
            plot: doc(db, "Plots", plotId),
            note: note,
            media: mediaUrls,
            status: "Pending", // Default status
            created_at: serverTimestamp(),
            created_by: doc(db, "Users", currentUserId)
        };

        await addDoc(collection(db, "Inspections"), docData);

        status.textContent = "✅ Inspection Created Successfully!";
        setTimeout(() => {
            closeInspectionModal();
            status.textContent = "";
            submitBtn.disabled = false;
        }, 1500);

    } catch (err) {
        console.error("Inspection Creation Error:", err);
        status.textContent = "Error: " + err.message;
        submitBtn.disabled = false;
    }
}

// Make initMapCallback available globally
window.initMapCallback = function () {
    console.log("🗺️ Google Maps API Loaded Callback");
    if (typeof initLocationPicker === 'function') {
        initLocationPicker();
    } else {
        // Retry if script isn't fully parsed yet
        setTimeout(() => {
            if (typeof initLocationPicker === 'function') initLocationPicker();
        }, 500);
    }
};

// =============================================================================
// ENQUIRIES SYNC & RENDERING
// =============================================================================
let allEnquiries = [];
let enquiryPage = 1;
const enquiriesPerPage = 10;
let activeEnquiryListener = null;

function initEnquirySync() {
    const tbody = document.getElementById("enquiriesTableBody");
    if (!tbody) return;

    if (activeEnquiryListener) {
        activeEnquiryListener();
        activeEnquiryListener = null;
    }

    console.log("📡 [Firebase] Connecting to real-time enquiries sync...");
    const q = query(collection(db, "Enquiries")); // Sort by date later if needed

    activeEnquiryListener = onSnapshot(q, (snapshot) => {
        allEnquiries = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // Sort by created_at descending (newest first)
        allEnquiries.sort((a, b) => {
            const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(0);
            const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(0);
            return dateB - dateA;
        });

        console.log(`🔥 [Firebase] Enquiries sync received: ${allEnquiries.length} items`);
        renderEnquiryTable();
    });
}

function renderEnquiryTable() {
    const tbody = document.getElementById("enquiriesTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (allEnquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;opacity:0.6;">No enquiries found.</td></tr>';
        return;
    }

    // Pagination
    const totalRecords = allEnquiries.length;
    const startIndex = (enquiryPage - 1) * enquiriesPerPage;
    const endIndex = startIndex + enquiriesPerPage;
    const paginated = allEnquiries.slice(startIndex, endIndex);

    paginated.forEach(enq => {
        const date = enq.created_at?.toDate ? enq.created_at.toDate().toLocaleString() : "N/A";
        const name = enq.name || "Anonymous";
        const contact = `<div>${enq.email || "No Email"}</div><small>${enq.phone_number || ""}</small>`;

        // Construct Source/Details string
        const sources = [];
        if (enq.via_website) sources.push("Website");
        if (enq.via_facebook) sources.push("Facebook");
        if (enq.via_instagram) sources.push("Instagram");
        if (enq.via_tiktok) sources.push("TikTok");
        if (enq.via_word_of_mouth) sources.push("Word of Mouth");
        if (enq.via_direct_contact) sources.push("Direct");

        const details = `
            <div style="font-size:0.85rem;">
                <strong>Source:</strong> ${sources.join(", ") || "Unknown"}<br>
                ${enq.off_plan ? '• Off-Plan ' : ''}
                ${enq.custom_build ? '• Custom Build ' : ''}
            </div>
            ${enq.comments?.length > 0 ? `<small style="display:block;margin-top:4px;opacity:0.8;">Latest: ${enq.comments[0].text}</small>` : ''}
        `;

        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.dataset.id = enq.id; // For delegation
        // tr.onclick = () => openEnquiryDetailsModal(enq); // Moved to delegation
        tr.innerHTML = `
            <td>${date}</td>
            <td><strong>${name}</strong></td>
            <td>${contact}</td>
            <td>${details}</td>
            <td>
                <span class="status-badge ${enq.responded ? 'status-active' : 'status-draft'}">
                    ${enq.responded ? 'Responded' : 'Pending'}
                </span>
            </td>
            <td>
                <button class="action-btn toggle-responded" data-id="${enq.id}" title="Toggle Responded Status">
                    <i class="fas ${enq.responded ? 'fa-undo' : 'fa-check'}"></i>
                </button>
                <button class="action-btn edit-enquiry" data-id="${enq.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete-enquiry" data-id="${enq.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderTablePagination("enquiriesPagination", totalRecords, enquiriesPerPage, enquiryPage, (newPage) => {
        enquiryPage = newPage;
        renderEnquiryTable();
    });

    // Action Handlers
    tbody.querySelectorAll(".toggle-responded").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const enq = allEnquiries.find(x => x.id === id);
            await updateDoc(doc(db, "Enquiries", id), { responded: !enq.responded });
        };
    });

    tbody.querySelectorAll(".delete-enquiry").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Delete this enquiry?")) {
                await deleteDoc(doc(db, "Enquiries", btn.dataset.id));
            }
        };
    });
}

/**
 * Initialize Inspections Real-time Sync
 */
function initInspectionsSync() {
    const tbody = document.getElementById("inspectionsTableBody");
    if (!tbody) return;

    let q = collection(db, "Inspections");
    if (currentUserCompany) {
        console.log(`🔍 [Inspections] Applying company sync: ${currentUserCompany.id}`);
        q = query(q, where("company_id", "==", currentUserCompany));
    }

    onSnapshot(q, (snapshot) => {
        allInspections = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        console.log(`🔥 [Firebase] Inspections sync received: ${allInspections.length} items`);

        // Sort by date desc
        allInspections.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
        });

        renderInspectionsTable();
    }, (error) => {
        console.error("Error in inspections sync:", error);
    });
}

function renderInspectionsTable() {
    const tbody = document.getElementById("inspectionsTableBody");
    if (!tbody) return;

    const totalRecords = allInspections.length;
    const startIndex = (inspectionsPage - 1) * inspectionsPerPage;
    const endIndex = startIndex + inspectionsPerPage;
    const paginated = allInspections.slice(startIndex, endIndex);

    if (totalRecords === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:3rem;opacity:0.6;"><i class="fas fa-clipboard-list" style="font-size:2rem;margin-bottom:1rem;display:block;"></i><strong>No inspections found.</strong></td></tr>';
        return;
    }

    tbody.innerHTML = "";
    paginated.forEach(insp => {
        const date = insp.created_at ? new Date(insp.created_at).toLocaleDateString() : "-";
        const name = insp.name || "Unnamed";

        // Handle References for Dev/Plot if they are objects
        const devId = (insp.development_id?.id || insp.development_id || "-").toUpperCase();
        const plotId = (insp.plot_id?.id || insp.plot_id || "-").toUpperCase();

        const tags = Array.isArray(insp.inspection_tags) ? insp.inspection_tags.join(", ") : "-";
        const statusText = insp.private ? "Private" : "Public";
        const statusClass = insp.private ? "status-draft" : "status-active";

        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.onclick = () => openInspectionDetailsModal(insp);
        tr.innerHTML = `
            <td style="width: 120px;">${date}</td>
            <td style="min-width: 200px;"><strong>${name}</strong></td>
            <td style="width: 150px;">${devId}</td>
            <td style="width: 120px;">${plotId}</td>
            <td><small>${tags}</small></td>
            <td style="width: 100px;"><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td style="width: 100px; white-space: nowrap;">
                <button class="action-btn edit-inspection" data-id="${insp.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete-inspection" data-id="${insp.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderTablePagination("inspectionsPagination", totalRecords, inspectionsPerPage, inspectionsPage, (newPage) => {
        inspectionsPage = newPage;
        renderInspectionsTable();
        document.getElementById("inspectionsSection").scrollIntoView({ behavior: 'smooth' });
    });

    // Action Handlers
    tbody.querySelectorAll(".edit-inspection").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            // Re-use handleEdit style logic but for inspections if needed
            // For now, let's assume openInspectionModal handles it if we pass an ID
            handleEditInspection(btn.dataset.id);
        };
    });

    tbody.querySelectorAll(".delete-inspection").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Delete this inspection report?")) {
                try {
                    await deleteDoc(doc(db, "Inspections", btn.dataset.id));
                    alert("Deleted.");
                } catch (err) {
                    console.error(err);
                    alert("Delete failed.");
                }
            }
        };
    });
}

// Placeholder for handleEditInspection if not defined
async function handleEditInspection(id) {
    console.log("📝 [Inspection] Edit triggered for ID:", id);
    // Since the user said the modal is working well, I'll assume it can populate.
    // However, I might need to implement the populating logic here or in openInspectionModal.
    // For now, I'll just log it.
}

/**
 * Initialize Enquiry Details Modal Events
 */
function initEnquiryDetailsModalEvents() {
    if (!enquiryDetailsModal) return;
    const closeBtn = document.getElementById("closeEnquiryDetailsModal");
    const closeBtnFooter = document.getElementById("detEnqCloseBtn");
    const editBtn = document.getElementById("detEnqEditBtn");

    if (closeBtn) closeBtn.onclick = closeEnquiryDetailsModal;
    if (closeBtnFooter) closeBtnFooter.onclick = closeEnquiryDetailsModal;
    if (editBtn) {
        editBtn.onclick = () => {
            const enqId = editBtn.dataset.id;
            if (enqId) {
                closeEnquiryDetailsModal();
                handleEditEnquiry(enqId);
            }
        };
    }

    window.addEventListener("click", (e) => {
        if (e.target === enquiryDetailsModal) closeEnquiryDetailsModal();
    });
}

function openEnquiryDetailsModal(enq) {
    console.log("🔍 [EnquiryDetails] Opening modal for:", enq.id);
    if (!enquiryDetailsModal) {
        console.error("❌ [EnquiryDetails] Modal element not found!");
        return;
    }
    console.log("✅ [EnquiryDetails] Modal element exists, display:", enquiryDetailsModal.style.display);

    // Populate Fields
    document.getElementById("detEnqName").textContent = enq.name || "Anonymous";
    document.getElementById("detEnqDate").textContent = enq.created_at?.toDate ? enq.created_at.toDate().toLocaleString() : "N/A";
    document.getElementById("detEnqEmail").textContent = enq.email || "No Email";
    document.getElementById("detEnqPhone").textContent = enq.phone_number || "No Phone";

    // Source & Status
    document.getElementById("detEnqSource").textContent = enq.source?.toUpperCase() || "MANUAL";
    const telLink = document.getElementById("detEnqTelegramLink");
    if (enq.telegram_link) {
        telLink.style.display = "block";
        telLink.innerHTML = `<a href="${enq.telegram_link}" target="_blank">View Telegram Profile</a>`;
    } else {
        telLink.style.display = "none";
    }

    document.getElementById("detEnqStatus").innerHTML = `<span class="status-badge ${enq.responded ? 'status-active' : 'status-draft'}">${enq.responded ? 'Responded' : 'Pending'}</span>`;

    // Property Requirements
    document.getElementById("detEnqListingType").textContent = (enq.listing_for_sale ? "For Sale " : "") + (enq.listing_for_lease ? "For Lease" : "");
    document.getElementById("detEnqPropType").textContent = enq.property_type?.toUpperCase() || "-";
    document.getElementById("detEnqArea").textContent = enq.area || "-";
    document.getElementById("detEnqUnitFloor").textContent = `Unit ${enq.unit_number || "-"} / Floor ${enq.floor_number || "-"}`;
    document.getElementById("detEnqSellingPrice").textContent = enq.selling_price ? `₱ ${parseFloat(enq.selling_price).toLocaleString()}` : "-";
    document.getElementById("detEnqLeasePrice").textContent = enq.lease_price ? `₱ ${parseFloat(enq.lease_price).toLocaleString()}` : "-";

    // Features
    const featuresDiv = document.getElementById("detEnqFeatures");
    featuresDiv.innerHTML = "";
    if (enq.has_parking) featuresDiv.innerHTML += `<span class="status-badge">Parking (${enq.parking_spaces || 0})</span>`;
    if (enq.furnished) featuresDiv.innerHTML += `<span class="status-badge">Furnished</span>`;
    if (enq.balcony) featuresDiv.innerHTML += `<span class="status-badge">Balcony</span>`;
    if (featuresDiv.innerHTML === "") featuresDiv.textContent = "-";

    document.getElementById("detEnqOffPlan").style.display = enq.off_plan ? "block" : "none";
    document.getElementById("detEnqCustomBuild").style.display = enq.custom_build ? "block" : "none";

    // Initialize Activity Comments
    initCommentsListener("enquiry", enq.id, "detEnqCommentsContainer");

    // Setup comment form event listeners
    const attachImageBtn = document.getElementById("detEnqAttachImageBtn");
    const fileInput = document.getElementById("detEnqCommentImage");
    const imagePreview = document.getElementById("detEnqImagePreview");
    const postBtn = document.getElementById("detEnqPostCommentBtn");
    const textarea = document.getElementById("detEnqNewComment");

    // Attach image button
    attachImageBtn.onclick = () => fileInput.click();

    // File input change
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            imagePreview.textContent = `📎 ${e.target.files[0].name}`;
        } else {
            imagePreview.textContent = "";
        }
    };

    // Post comment button
    postBtn.onclick = async () => {
        const commentText = textarea.value.trim();
        const imageFile = fileInput.files[0] || null;

        if (commentText || imageFile) {
            postBtn.disabled = true;
            postBtn.textContent = "Posting...";
            await handleAddComment("enquiry", enq.id, commentText, imageFile);
            postBtn.disabled = false;
            postBtn.textContent = "Post Comment";
        }
    };

    // Edit Button Data
    document.getElementById("detEnqEditBtn").dataset.id = enq.id;

    console.log("🎨 [EnquiryDetails] Setting display to flex");
    enquiryDetailsModal.style.display = "flex";
    setTimeout(() => {
        console.log("🎨 [EnquiryDetails] Adding active class");
        enquiryDetailsModal.classList.add("active");
        console.log("✅ [EnquiryDetails] Modal should now be visible");
    }, 10);
}

function closeEnquiryDetailsModal() {
    if (!enquiryDetailsModal) return;
    detachCommentsListener(); // Clean up comments listener
    enquiryDetailsModal.classList.remove("active");
    setTimeout(() => {
        if (!enquiryDetailsModal.classList.contains("active")) {
            enquiryDetailsModal.style.display = "none";
        }
    }, 400);
}

/**
 * Initialize Inspection Details Modal Events
 */
function initInspectionDetailsModalEvents() {
    if (!inspectionDetailsModal) return;
    const closeBtn = document.getElementById("closeInspectionDetailsModal");
    const closeBtnFooter = document.getElementById("detInspCloseBtn");
    const editBtn = document.getElementById("detInspEditBtn");

    if (closeBtn) closeBtn.onclick = closeInspectionDetailsModal;
    if (closeBtnFooter) closeBtnFooter.onclick = closeInspectionDetailsModal;
    if (editBtn) {
        editBtn.onclick = () => {
            const inspId = editBtn.dataset.id;
            if (inspId) {
                closeInspectionDetailsModal();
                handleEditInspection(inspId);
            }
        };
    }

    window.addEventListener("click", (e) => {
        if (e.target === inspectionDetailsModal) closeInspectionDetailsModal();
    });
}

function openInspectionDetailsModal(insp) {
    if (!inspectionDetailsModal) return;

    document.getElementById("detInspTitle").textContent = insp.title || "Unnamed Inspection";
    document.getElementById("detInspDate").textContent = insp.created_at ? new Date(insp.created_at).toLocaleString() : "-";

    // References
    const devId = (insp.development_id?.id || insp.development_id || "-").toUpperCase();
    const plotId = (insp.plot_id?.id || insp.plot_id || "-").toUpperCase();
    document.getElementById("detInspDev").textContent = devId;
    document.getElementById("detInspPlot").textContent = plotId;

    // Tags
    const tagsDiv = document.getElementById("detInspTags");
    if (Array.isArray(insp.inspection_tags) && insp.inspection_tags.length > 0) {
        tagsDiv.innerHTML = insp.inspection_tags.map(t => `<span class="status-badge">${t}</span>`).join("");
    } else {
        tagsDiv.textContent = "-";
    }

    // Status
    document.getElementById("detInspStatus").innerHTML = `<span class="status-badge ${insp.private ? 'status-draft' : 'status-active'}">${insp.private ? 'Private' : 'Public'}</span>`;

    // Note
    document.getElementById("detInspNote").textContent = insp.note || "No notes provided.";

    // Media
    const mediaDiv = document.getElementById("detInspMedia");
    mediaDiv.innerHTML = "";
    if (insp.media && insp.media.length > 0) {
        insp.media.forEach(url => {
            const img = document.createElement("img");
            img.src = url;
            img.style.width = "100%";
            img.style.height = "100px";
            img.style.objectFit = "cover";
            img.style.borderRadius = "4px";
            img.style.cursor = "pointer";
            img.onclick = () => window.open(url, "_blank");
            mediaDiv.appendChild(img);
        });
    } else {
        mediaDiv.innerHTML = '<div style="grid-column: 1/-1; opacity:0.5; font-size:0.9rem;">No media attached.</div>';
    }

    // Initialize Activity Comments
    initCommentsListener("inspection", insp.id, "detInspCommentsContainer");

    // Setup comment form event listeners
    const attachImageBtn = document.getElementById("detInspAttachImageBtn");
    const fileInput = document.getElementById("detInspCommentImage");
    const imagePreview = document.getElementById("detInspImagePreview");
    const postBtn = document.getElementById("detInspPostCommentBtn");
    const textarea = document.getElementById("detInspNewComment");

    // Attach image button
    attachImageBtn.onclick = () => fileInput.click();

    // File input change
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            imagePreview.textContent = `📎 ${e.target.files[0].name}`;
        } else {
            imagePreview.textContent = "";
        }
    };

    // Post comment button
    postBtn.onclick = async () => {
        const commentText = textarea.value.trim();
        const imageFile = fileInput.files[0] || null;

        if (commentText || imageFile) {
            postBtn.disabled = true;
            postBtn.textContent = "Posting...";
            await handleAddComment("inspection", insp.id, commentText, imageFile);
            postBtn.disabled = false;
            postBtn.textContent = "Post Comment";
        }
    };

    document.getElementById("detInspEditBtn").dataset.id = insp.id;

    inspectionDetailsModal.style.display = "flex";
    setTimeout(() => inspectionDetailsModal.classList.add("active"), 10);
}

function closeInspectionDetailsModal() {
    if (!inspectionDetailsModal) return;
    detachCommentsListener(); // Clean up comments listener
    inspectionDetailsModal.classList.remove("active");
    setTimeout(() => {
        if (!inspectionDetailsModal.classList.contains("active")) {
            inspectionDetailsModal.style.display = "none";
        }
    }, 400);
}

/**
 * HandleEditEnquiry - Populates the enquiry modal for editing
 */
async function handleEditEnquiry(id) {
    console.log("📝 [Enquiry] Edit triggered for ID:", id);
    if (!enquiryModal) return;

    try {
        const docSnap = await getDoc(doc(db, "Enquiries", id));
        if (!docSnap.exists()) {
            console.error("Enquiry not found:", id);
            return;
        }

        const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();

        // Reset form first
        const form = document.getElementById("enquiryForm");
        if (form) form.reset();

        // Populate hidden ID
        document.getElementById("enqId").value = id;

        // Populate Basic Fields
        document.getElementById("enqName").value = data.name || "";
        document.getElementById("enqEmail").value = data.email || "";
        document.getElementById("enqPhone").value = data.phone_number || data.phone || "";
        document.getElementById("enqResponded").checked = !!data.responded;
        document.getElementById("enqOffPlan").checked = !!data.off_plan;
        document.getElementById("enqCustomBuild").checked = !!data.custom_build;

        // Detailed Fields
        document.getElementById("enqListingForSale").checked = !!data.listing_for_sale;
        document.getElementById("enqListingForLease").checked = !!data.listing_for_lease;
        document.getElementById("enqPropType").value = data.property_type || "";
        document.getElementById("enqHasParking").checked = !!data.has_parking;
        document.getElementById("enqParkingSpaces").value = data.parking_spaces || 0;
        document.getElementById("enqFurnished").checked = !!data.furnished;
        document.getElementById("enqBalcony").checked = !!data.balcony;
        document.getElementById("enqFloorNumber").value = data.floor_number || "";
        document.getElementById("enqUnitNumber").value = data.unit_number || "";
        document.getElementById("enqArea").value = data.area || "";
        document.getElementById("enqSellingPrice").value = data.selling_price || 0;
        document.getElementById("enqLeasePrice").value = data.lease_price || 0;

        // Source
        const sourceVal = data.source || "manual";
        const sourceRadio = document.querySelector(`input[name="enqSource"][value="${sourceVal}"]`);
        if (sourceRadio) sourceRadio.checked = true;

        document.getElementById("enqTelegramLink").value = data.telegram_link || "";

        // Toggle visibility containers based on data
        const telegramLinkContainer = document.getElementById("telegramLinkContainer");
        if (telegramLinkContainer) telegramLinkContainer.style.display = (sourceVal === "telegram") ? "block" : "none";
        const parkingSpacesContainer = document.getElementById("parkingSpacesContainer");
        if (parkingSpacesContainer) parkingSpacesContainer.style.display = (data.has_parking) ? "block" : "none";

        // Comments (Legacy or existing) - if it's an array of objects
        if (Array.isArray(data.comments) && data.comments.length > 0) {
            // For editing, we might just show the latest or not support bulk edit of history here
            // But we'll at least show the latest in the textarea if it's meant for adding a NEW comment
            // document.getElementById("enqComments").value = ""; 
        } else if (typeof data.comments === 'string') {
            document.getElementById("enqComments").value = data.comments;
        }

        // Update Modal UI
        document.getElementById("enquiryModalTitle").textContent = "Edit Enquiry";
        document.getElementById("enqSubmitBtn").textContent = "Update Enquiry";

        // Show Modal
        enquiryModal.style.display = "flex";
        setTimeout(() => enquiryModal.classList.add("active"), 10);

    } catch (err) {
        console.error("Error fetching enquiry for edit:", err);
        alert("Failed to load enquiry data.");
    }
}


/**
 * ========================================
 * ACTIVITY COMMENTS SYSTEM
 * ========================================
 */

/**
 * Fetch User Avatar and Name from Users collection
 * @param {DocumentReference} userRef - Firestore reference to Users document
 * @returns {Promise<{name: string, avatar: string}>}
 */
async function fetchUserAvatar(userRef) {
    if (!userRef || !userRef.id) {
        return { name: "Unknown User", avatar: "" };
    }

    const userId = userRef.id;

    // Check cache first
    if (userAvatarCache[userId]) {
        return userAvatarCache[userId];
    }

    try {
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const result = {
                name: userData.name || userData.displayName || "User",
                avatar: userData.avatar || userData.photoURL || ""
            };
            // Cache the result
            userAvatarCache[userId] = result;
            return result;
        }
    } catch (err) {
        console.error("Error fetching user avatar:", err);
    }

    return { name: "Unknown User", avatar: "" };
}

/**
 * Render Activity Comments with Threading Support
 * @param {Array} comments - Array of comment objects
 * @param {string} containerId - ID of the container to render comments in
 * @param {string} documentType - "enquiry" or "inspection"
 * @param {string} documentId - ID of the parent document
 */
async function renderActivityComments(comments, containerId, documentType, documentId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!comments || comments.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.5; padding:2rem;">No comments yet. Be the first to comment!</div>';
        return;
    }

    // Filter out trashed comments
    const activeComments = comments.filter(c => !c.trash);

    if (activeComments.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.5; padding:2rem;">No comments yet. Be the first to comment!</div>';
        return;
    }

    // Separate top-level comments from replies
    const topLevelComments = activeComments.filter(c => !c.parent_comment_id);
    const repliesMap = {};

    // Organize replies by parent comment ID
    activeComments.forEach(c => {
        if (c.parent_comment_id) {
            if (!repliesMap[c.parent_comment_id]) {
                repliesMap[c.parent_comment_id] = [];
            }
            repliesMap[c.parent_comment_id].push(c);
        }
    });

    // Sort top-level comments by date (newest first)
    topLevelComments.sort((a, b) => {
        const dateA = a.added_at?.toDate ? a.added_at.toDate() : new Date(0);
        const dateB = b.added_at?.toDate ? b.added_at.toDate() : new Date(0);
        return dateB - dateA;
    });

    container.innerHTML = "";

    // Render each top-level comment and its thread
    for (let i = 0; i < topLevelComments.length; i++) {
        const comment = topLevelComments[i];
        if (i > 0) {
            const divider = document.createElement("div");
            divider.className = "comment-divider";
            container.appendChild(divider);
        }
        await renderCommentThread(comment, repliesMap, container, documentType, documentId, 0);
    }

    // Attach event listeners
    attachCommentEventListeners(container, documentType, documentId);
}

/**
 * Recursively render a comment and its replies
 * @param {Object} comment - Comment object
 * @param {Object} repliesMap - Map of parent comment IDs to their replies
 * @param {HTMLElement} container - Container element
 * @param {string} documentType - "enquiry" or "inspection"
 * @param {string} documentId - ID of the parent document
 * @param {number} depth - Current nesting depth
 */
async function renderCommentThread(comment, repliesMap, container, documentType, documentId, depth) {
    const MAX_DEPTH = 4;
    const user = await fetchUserAvatar(comment.added_by);
    const timestamp = comment.added_at?.toDate ? comment.added_at.toDate().toLocaleString() : "Unknown date";

    const indentPx = depth * 40; // 40px indent per level

    const commentCard = document.createElement("div");
    commentCard.className = "comment-item";
    commentCard.style.cssText = `background: rgba(255,255,255,0.05); border-radius:8px; padding:1rem; margin-bottom:0.75rem; margin-left:${indentPx}px; display:flex; gap:0.75rem;`;
    commentCard.dataset.commentId = comment.id;
    commentCard.dataset.depth = depth;

    // Avatar
    const avatarHtml = user.avatar
        ? `<img src="${user.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; flex-shrink:0;" alt="${user.name}">`
        : `<div style="width:40px; height:40px; border-radius:50%; background:var(--accent); display:flex; align-items:center; justify-content:center; font-weight:bold; flex-shrink:0;">${user.name.charAt(0).toUpperCase()}</div>`;

    // Build comment HTML
    commentCard.innerHTML = `
        ${avatarHtml}
        <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.25rem;">
                <div>
                    <strong style="font-size:0.9rem;">${user.name}</strong>
                    <div style="font-size:0.75rem; opacity:0.6; margin-top:2px;">${timestamp}</div>
                </div>
                <div style="display:flex; gap:0.4rem; align-items: center;">
                    <button class="comment-collapse-btn action-btn" data-id="${comment.id}" title="Collapse/Expand">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    ${comment.flagged ? '<span class="status-badge" style="background:orange; font-size:0.7rem; padding:2px 6px;">Flagged</span>' : ''}
                    <button class="action-btn flag-comment" data-id="${comment.id}" title="${comment.flagged ? 'Unflag' : 'Flag'}" style="padding:4px 6px;">
                        <i class="fas fa-flag" style="font-size:0.8rem;"></i>
                    </button>
                    ${currentUserId === comment.added_by?.id ? `
                        <button class="action-btn delete-comment" data-id="${comment.id}" data-type="${documentType}" title="Delete" style="padding:4px 6px;">
                            <i class="fas fa-trash" style="font-size:0.8rem;"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div style="font-size:0.9rem; line-height:1.5; word-wrap:break-word;" class="comment-body">${comment.comment || ""}</div>
            ${comment.image ? `<img src="${comment.image}" style="max-width:200px; border-radius:4px; margin-top:0.5rem; cursor:pointer;" onclick="window.open('${comment.image}', '_blank')" alt="Comment attachment">` : ''}
            <div class="comment-actions" style="margin-top:0.5rem;">
                ${depth < MAX_DEPTH ? `
                    <button class="reply-btn" data-comment-id="${comment.id}" data-user-name="${user.name}" style="padding:0.25rem 0.5rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:inherit; cursor:pointer; font-size:0.8rem;">
                        <i class="fas fa-reply"></i> Reply
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    container.appendChild(commentCard);

    // Render replies recursively
    const replies = repliesMap[comment.id] || [];
    if (replies.length > 0) {
        // Sort replies by date (oldest first for replies)
        replies.sort((a, b) => {
            const dateA = a.added_at?.toDate ? a.added_at.toDate() : new Date(0);
            const dateB = b.added_at?.toDate ? b.added_at.toDate() : new Date(0);
            return dateA - dateB;
        });

        for (const reply of replies) {
            await renderCommentThread(reply, repliesMap, container, documentType, documentId, depth + 1);
        }
    }
}

/**
 * Attach event listeners to comment actions
 */
function attachCommentEventListeners(container, documentType, documentId) {
    // Flag comment buttons
    container.querySelectorAll(".flag-comment").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            await handleFlagComment(btn.dataset.id);
        };
    });

    // Delete comment buttons
    container.querySelectorAll(".delete-comment").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Delete this comment?")) {
                await handleDeleteComment(btn.dataset.id, btn.dataset.type, documentId);
            }
        };
    });

    // Reply buttons
    container.querySelectorAll(".reply-btn").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            showReplyInput(btn.dataset.commentId, btn.dataset.userName, documentType, documentId);
        };
    });

    // Collapse buttons
    container.querySelectorAll(".comment-collapse-btn").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const commentItem = btn.closest("[data-comment-id]");
            if (commentItem) {
                const isCollapsed = commentItem.classList.toggle("collapsed");
                const icon = btn.querySelector("i");
                if (icon) {
                    icon.className = isCollapsed ? "fas fa-chevron-down" : "fas fa-chevron-up";
                }

                // Also hide children (replies)
                let next = commentItem.nextElementSibling;
                while (next && next.dataset.depth > commentItem.dataset.depth) {
                    next.style.display = isCollapsed ? "none" : "flex";
                    next = next.nextElementSibling;
                }
            }
        };
    });
}

// Add snackbar listeners for Edit buttons
function initEditButtonFeedback() {
    ['detEnqEditBtn', 'detInspEditBtn', 'listingEditBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                showSnackbar("Edit mode enabled. Update fields and save changes.", "info");
            });
        }
    });
}

/**
 * Show reply input below a comment
 */
function showReplyInput(parentCommentId, parentUserName, documentType, documentId) {
    // Remove any existing reply inputs
    const existingReply = document.querySelector('.reply-input-container');
    if (existingReply) {
        existingReply.remove();
    }

    // Find the parent comment card
    const parentCard = document.querySelector(`[data - comment - id="${parentCommentId}"]`);
    if (!parentCard) return;

    // Create reply input container
    const replyContainer = document.createElement('div');
    replyContainer.className = 'reply-input-container';
    replyContainer.style.cssText = 'background: rgba(255,255,255,0.03); border-radius:8px; padding:1rem; margin-top:0.5rem; margin-left:40px;';

    replyContainer.innerHTML = `
    < div style = "margin-bottom:0.5rem; font-size:0.85rem; opacity:0.7;" > Replying to @${parentUserName}</div >
        <textarea class="reply-textarea" placeholder="Write your reply..." 
            style="width:100%; min-height:60px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:0.5rem; color:inherit; font-family:inherit; resize:vertical;"></textarea>
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem; align-items:center;">
            <input type="file" class="reply-image-input" accept="image/*" style="display:none;">
            <button class="reply-attach-btn action-btn" title="Attach Image" style="background:rgba(255,255,255,0.1);">
                <i class="fas fa-image"></i>
            </button>
            <span class="reply-image-preview" style="font-size:0.8rem; opacity:0.7;"></span>
            <button class="reply-post-btn btn-add" style="margin-left:auto; padding:0.5rem 1rem;">
                Post Reply
            </button>
            <button class="reply-cancel-btn btn-logout" style="padding:0.5rem 1rem;">
                Cancel
            </button>
        </div>
`;

    // Insert after parent card
    parentCard.insertAdjacentElement('afterend', replyContainer);

    // Attach event listeners
    const textarea = replyContainer.querySelector('.reply-textarea');
    const fileInput = replyContainer.querySelector('.reply-image-input');
    const attachBtn = replyContainer.querySelector('.reply-attach-btn');
    const imagePreview = replyContainer.querySelector('.reply-image-preview');
    const postBtn = replyContainer.querySelector('.reply-post-btn');
    const cancelBtn = replyContainer.querySelector('.reply-cancel-btn');

    attachBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            imagePreview.textContent = `📎 ${e.target.files[0].name} `;
        } else {
            imagePreview.textContent = "";
        }
    };

    postBtn.onclick = async () => {
        const commentText = textarea.value.trim();
        const imageFile = fileInput.files[0] || null;

        if (commentText || imageFile) {
            postBtn.disabled = true;
            postBtn.textContent = "Posting...";
            await handleAddComment(documentType, documentId, commentText, imageFile, parentCommentId);
            postBtn.disabled = false;
            postBtn.textContent = "Post Reply";
        }
    };

    cancelBtn.onclick = () => {
        replyContainer.remove();
    };

    // Focus the textarea
    textarea.focus();
}

/**
 * Handle Adding a New Comment
 * @param {string} documentType - "enquiry" or "inspection"
 * @param {string} documentId - ID of the parent document
 * @param {string} commentText - The comment text
 * @param {File} imageFile - Optional image file
 * @param {string} parentCommentId - Optional parent comment ID for replies
 */
async function handleAddComment(documentType, documentId, commentText, imageFile = null, parentCommentId = null) {
    if (!commentText.trim() && !imageFile) {
        alert("Please enter a comment or attach an image.");
        return;
    }

    try {
        let imageUrl = null;

        // Upload image if provided
        if (imageFile) {
            const resizedBlob = await compressAndConvertToWebP(imageFile, 800);
            const storageRef = ref(storage, `activity - comments / ${Date.now()}_${imageFile.name.split('.')[0]}.webp`);
            await uploadBytes(storageRef, resizedBlob);
            imageUrl = await getDownloadURL(storageRef);
        }

        // Create parent document reference
        const parentRef = doc(db, documentType === "enquiry" ? "Enquiries" : "Inspections", documentId);
        const userRef = doc(db, "Users", currentUserId);

        // Create comment document
        const commentData = {
            added_by: userRef,
            added_at: serverTimestamp(),
            comment: commentText,
            flagged: false,
            trash: false,
            parent_document: parentRef,
            document_type: documentType
        };

        if (imageUrl) {
            commentData.image = imageUrl;
        }

        // Add parent_comment_id if this is a reply
        if (parentCommentId) {
            commentData.parent_comment_id = parentCommentId;
        }

        await addDoc(collection(db, "activityComments"), commentData);

        // Clear form
        const textareaId = documentType === "enquiry" ? "detEnqNewComment" : "detInspNewComment";
        const previewId = documentType === "enquiry" ? "detEnqImagePreview" : "detInspImagePreview";
        const fileInputId = documentType === "enquiry" ? "detEnqCommentImage" : "detInspCommentImage";

        document.getElementById(textareaId).value = "";
        document.getElementById(previewId).textContent = "";
        document.getElementById(fileInputId).value = "";

        // Close reply input if it exists
        const replyContainer = document.querySelector('.reply-input-container');
        if (replyContainer) {
            replyContainer.remove();
        }

        console.log("Comment added successfully");
    } catch (err) {
        console.error("Error adding comment:", err);
        alert("Failed to add comment: " + err.message);
    }
}

/**
 * Handle Flagging a Comment
 * @param {string} commentId - ID of the comment to flag/unflag
 */
async function handleFlagComment(commentId) {
    try {
        const commentRef = doc(db, "activityComments", commentId);
        const commentDoc = await getDoc(commentRef);

        if (commentDoc.exists()) {
            const currentFlag = commentDoc.data().flagged || false;
            await updateDoc(commentRef, { flagged: !currentFlag });
        }
    } catch (err) {
        console.error("Error flagging comment:", err);
        alert("Failed to flag comment.");
    }
}

/**
 * Handle Deleting a Comment (Soft Delete)
 * @param {string} commentId - ID of the comment to delete
 * @param {string} documentType - "enquiry" or "inspection"
 * @param {string} documentId - ID of the parent document
 */
async function handleDeleteComment(commentId, documentType, documentId) {
    try {
        const commentRef = doc(db, "activityComments", commentId);
        // Soft delete
        await updateDoc(commentRef, { trash: true });
        console.log("Comment deleted successfully");
    } catch (err) {
        console.error("Error deleting comment:", err);
        alert("Failed to delete comment.");
    }
}

/**
 * Initialize Real-time Comments Listener
 * @param {string} documentType - "enquiry" or "inspection"
 * @param {string} documentId - ID of the parent document
 * @param {string} containerId - ID of the container to render comments in
 */
function initCommentsListener(documentType, documentId, containerId) {
    // Detach previous listener if exists
    if (activeCommentsListener) {
        activeCommentsListener();
        activeCommentsListener = null;
    }

    const parentRef = doc(db, documentType === "enquiry" ? "Enquiries" : "Inspections", documentId);
    const q = query(
        collection(db, "activityComments"),
        where("parent_document", "==", parentRef)
    );

    activeCommentsListener = onSnapshot(q, (snapshot) => {
        const comments = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        renderActivityComments(comments, containerId, documentType, documentId);
    }, (error) => {
        console.error("Error in comments listener:", error);
    });
}

/**
 * Detach Comments Listener
 */
function detachCommentsListener() {
    if (activeCommentsListener) {
        activeCommentsListener();
        activeCommentsListener = null;
    }
}

