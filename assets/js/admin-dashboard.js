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

            // 1. Load listings immediately (uses cache first)
            initAdminListingsSync();
            initDashboardFilters();
            initModalEvents();
            initGallerySync();
            initGalleryModalEvents();
            initPalawanGallerySync();
            initPalawanGalleryModalEvents();

            // 2. Fetch user's company and RE-INIT sync with filter
            await getUserCompany(user.uid);
            initAdminListingsSync();
        }
        // No else needed here, auth.js handles strict redirect for unauth users
    });
});

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
            renderAdminTable(listings);
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
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;">No listings found.</td></tr>`;
        return;
    }

    const listings = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    console.log(`🔥 [Firebase] Admin sync received: ${listings.length} listings`);

    // 3. Update Cache & Render
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        listings,
        timestamp: Date.now()
    }));

    renderAdminTable(listings);
}

function renderAdminTable(listings) {
    const tbody = document.getElementById("listingsTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    listings.forEach(data => {
        const id = data.id;
        const title = data.title || "Untitled";
        const thumbnail = data.media?.thumbnail || "images/coming-soon.webp";
        const price = data.price ? `₱${Number(data.price).toLocaleString()}` : "TBC";
        const type = data.type || "-";
        const category = data.category || "All";

        const shortDesc = data.content?.short_description || "";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${thumbnail}" alt="thumb"></td>
            <td>
                <strong>${title}</strong><br>
                <small style="opacity: 0.7;">${shortDesc}</small>
            </td>
            <td>${type}</td>
            <td>${price}</td>
            <td><span class="status-badge status-active">${category.toUpperCase()}</span></td>
            <td style="text-align:center;">${data.featured ? '<i class="fas fa-star" style="color:var(--accent);"></i>' : '-'}</td>
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

    // Bind events
    document.querySelectorAll(".action-btn.delete").forEach(btn => btn.addEventListener("click", handleDelete));
    document.querySelectorAll(".action-btn.edit").forEach(btn => btn.addEventListener("click", handleEdit));
    document.querySelectorAll(".action-btn.duplicate").forEach(btn => btn.addEventListener("click", handleDuplicate));

    // Add row click to view property details
    tbody.querySelectorAll("tr").forEach(tr => {
        tr.style.cursor = "pointer";
        tr.addEventListener("click", (e) => {
            // Don't trigger if clicking action buttons
            if (e.target.closest(".action-btn")) return;

            const id = tr.querySelector(".action-btn")?.dataset.id;
            if (id) {
                const listing = listings.find(l => l.id === id);
                if (listing) openPropertyModal(listing);
            }
        });
    });

    // Initialize filters after table is rendered
    if (typeof window.initDashboardFilters === 'function') {
        setTimeout(() => window.initDashboardFilters(), 100);
    }
}

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
    const btn = e.target.closest("button");
    const id = btn.dataset.id;

    // Reset Form First
    openModal(true); // true = edit mode
    const form = document.getElementById("listingForm");

    // Show Loading or similar if needed? 
    // Ideally we fetch data then show, or show then fill. 
    // Let's optimize UX: set ID now.
    document.getElementById("listingId").value = id;

    try {
        const docRef = doc(db, "Listings", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            document.getElementById("propTitle").value = data.title || "";
            document.getElementById("propPrice").value = data.price || "";
            document.getElementById("propType").value = data.type || "";
            document.getElementById("propCategory").value = data.category || "residential";
            document.getElementById("propStatus").value = data.status || "for_sale";
            document.getElementById("propFeatured").checked = !!data.featured;

            document.getElementById("propShortDesc").value = data.content?.short_description || "";
            document.getElementById("propFullDesc").value = data.content?.full_description || "";

            document.getElementById("propBeds").value = data.specs?.beds || "";
            document.getElementById("propBaths").value = data.specs?.baths || "";
            document.getElementById("propSize").value = data.specs?.size || "";
            document.getElementById("propLotSize").value = data.specs?.lot_size || "";
            document.getElementById("propFloorArea").value = data.specs?.floor_area || "";

            const features = data.content?.features || [];
            document.getElementById("propFeatures").value = Array.isArray(features) ? features.join(", ") : "";

            // Image note
            // We don't preview existing image in this simple form, but users know it exists.
        } else {
            console.log("No such document!");
        }
    } catch (error) {
        console.error("Error getting document:", error);
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
}

function openModal(edit = false) {
    console.log("🚀 [Modal] openModal triggered. Edit Mode:", edit);
    isEditMode = edit;
    const form = document.getElementById("listingForm");
    const title = document.getElementById("modalTitle");
    const submitBtn = document.getElementById("submitBtn");
    const idInput = document.getElementById("listingId");
    const imgInput = document.getElementById("propImage");

    if (!form || !title || !submitBtn) {
        console.error("Modal elements missing");
        return;
    }

    form.reset();

    // Safer transition trigger: display then active class with delay
    modal.style.display = "flex";
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
        // Prepare Data Object (Base)
        let docData = {
            title: document.getElementById("propTitle").value,
            price: Number(document.getElementById("propPrice").value),
            type: document.getElementById("propType").value,
            category: document.getElementById("propCategory").value,
            status: document.getElementById("propStatus").value,
            featured: document.getElementById("propFeatured").checked,
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

        // Handle Image Upload if file selected
        const fileInput = document.getElementById("propImage");
        if (fileInput.files.length > 0) {
            statusDiv.textContent = "Uploading new image...";
            const file = fileInput.files[0];
            const storageRef = ref(storage, 'property-images/' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            docData.media = {
                thumbnail: downloadURL,
                images: [downloadURL]
            };
        }

        if (isEditMode && id) {
            // UPDATE
            const docRef = doc(db, "Listings", id);

            // Add editor metadata
            if (currentUserId) {
                docData.editor = doc(db, "Users", currentUserId);
            }
            docData.edited_date = serverTimestamp();

            await updateDoc(docRef, docData);
            // Invalidate cache
            localStorage.removeItem("kai_isla_listings");
            alert("Listing updated successfully!");
        } else {
            // CREATE
            if (!docData.media) {
                throw new Error("Image is required for new listings.");
            }

            // Add company and creator metadata
            if (currentUserCompany) {
                docData.company = currentUserCompany;
            }
            if (currentUserId) {
                docData.creator = doc(db, "Users", currentUserId);
            }
            docData.created_date = serverTimestamp();

            await addDoc(collection(db, "Listings"), docData);
            // Invalidate cache
            localStorage.removeItem("kai_isla_listings");
            alert("Listing created successfully!");
        }

        // Close modal on success
        closeModal();
        // No need to call fetchAdminListings, the real-time listener will update
    } catch (error) {
        console.error("Error saving listing:", error);
        alert("Error: " + error.message);
    } finally {
        submitBtn.disabled = false;
        statusDiv.textContent = "";
    }
}

// Open Property Modal with listing data
function openPropertyModal(data) {
    const overlay = document.getElementById("modalOverlay");
    const modal = document.getElementById("propertyModal");

    if (!overlay || !modal) return;

    // Populate modal fields
    const img = document.getElementById("modalImage");
    const locationEl = document.getElementById("modalLocation");
    const typeEl = document.getElementById("modalType");
    const priceEl = document.getElementById("modalPrice");
    const bedsEl = document.getElementById("modalBeds");
    const bathsEl = document.getElementById("modalBaths");
    const sizeEl = document.getElementById("modalSize");
    const descEl = document.getElementById("modalDescription");
    const featuresEl = document.getElementById("modalFeatures");
    const visitsEl = document.getElementById("modalVisits");
    const likesEl = document.getElementById("modalLikes");
    const visitsLabel = document.getElementById("modalVisitsLabel");
    const likesLabel = document.getElementById("modalLikesLabel");

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
    overlay.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important;";
    modal.style.cssText = "display: block !important; visibility: visible !important; opacity: 1 !important;";
}

// Dashboard Table Filters
function initDashboardFilters() {
    const section = document.getElementById('listingsSection');
    if (!section) {
        console.error("Listings section not found for filters.");
        return;
    }

    const filterBtns = section.querySelectorAll('.property-gallery-filters .filter');
    const priceMin = document.getElementById('dashPriceMin');
    const priceMax = document.getElementById('dashPriceMax');
    const priceRangeValue = document.getElementById('dashPriceRangeValue');
    const tbody = document.getElementById('listingsTableBody');

    if (!filterBtns.length || !priceMin || !priceMax || !tbody) return;

    let activeCategory = 'all';
    let minPrice = 0;
    let maxPrice = 50000000;

    const formatPrice = v => {
        if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}m`;
        if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}k`;
        return `₱${v}`;
    };

    const updatePriceDisplay = () => {
        if (minPrice === 0 && maxPrice === 50000000) {
            priceRangeValue.textContent = 'Any Price';
        } else {
            priceRangeValue.textContent = `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`;
        }
    };

    const filterTable = () => {
        const rows = tbody.querySelectorAll('tr'); // Re-query cards to ensure latest DOM
        let visibleCount = 0;

        rows.forEach(row => {
            const categoryCell = row.querySelector('td:nth-child(5)');
            const priceCell = row.querySelector('td:nth-child(4)');

            if (!categoryCell || !priceCell) return;

            const category = categoryCell.textContent.trim().toLowerCase();
            const priceText = priceCell.textContent.replace(/[₱,]/g, '');
            const price = parseInt(priceText) || 0;

            const categoryMatch = activeCategory === 'all' || category === activeCategory;
            const priceMatch = price >= minPrice && price <= maxPrice;

            if (categoryMatch && priceMatch) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        // Show empty state if no results
        let noResultsRow = tbody.querySelector('.no-results-row');
        if (visibleCount === 0) {
            if (!noResultsRow) {
                noResultsRow = document.createElement('tr');
                noResultsRow.className = 'no-results-row';
                noResultsRow.innerHTML = `
                    <td colspan="9" style="text-align:center; padding:3rem; opacity:0.6;">
                        <i class="fas fa-search" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
                        <strong>Nothing here. Try updating your filters</strong>
                    </td>
                `;
                tbody.appendChild(noResultsRow);
            }
            noResultsRow.style.display = '';
        } else if (noResultsRow) {
            noResultsRow.style.display = 'none';
        }

        console.log(`Dashboard filter: ${visibleCount} listings visible`);
    };

    // Category filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.filter;
            filterTable();
        });
    });

    // Price sliders
    const updateSlider = () => {
        const min = parseInt(priceMin.value);
        const max = parseInt(priceMax.value);

        if (min > max - 1000000) {
            if (priceMin === document.activeElement) {
                priceMin.value = max - 1000000;
            } else {
                priceMax.value = min + 1000000;
            }
        }

        minPrice = parseInt(priceMin.value);
        maxPrice = parseInt(priceMax.value);

        const percentMin = (minPrice / 50000000) * 100;
        const percentMax = (maxPrice / 50000000) * 100;

        const sliderRange = document.querySelector('.slider-range-inline');
        if (sliderRange) {
            sliderRange.style.left = percentMin + '%';
            sliderRange.style.width = (percentMax - percentMin) + '%';
        }

        updatePriceDisplay();
        filterTable();
    };

    priceMin.addEventListener('input', updateSlider);
    priceMax.addEventListener('input', updateSlider);

    updateSlider();
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
            renderGalleryTable(gallery);
        } catch (e) {
            console.error("Gallery cache error", e);
        }
    }

    // 2. Listener
    activeGalleryListener = onSnapshot(collection(db, "Gallery"), (snapshot) => {
        const gallery = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify({
            gallery,
            timestamp: Date.now()
        }));
        renderGalleryTable(gallery);
    });
}

function renderGalleryTable(gallery) {
    const tbody = document.getElementById("galleryTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    gallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    gallery.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${item.image}" alt="gallery" style="width:60px; height:40px; object-fit:cover; border-radius:4px;"></td>
            <td><strong>${item.headline || "-"}</strong></td>
            <td><small>${item.sub_header || "-"}</small></td>
            <td><span class="status-badge" style="background:rgba(255,255,255,0.05);">${item.category?.toUpperCase()}</span></td>
            <td style="text-align:center;">${item.display ? '<i class="fas fa-check" style="color:var(--accent);"></i>' : '<i class="fas fa-times" style="opacity:0.3;"></i>'}</td>
            <td>
                <button class="action-btn edit-gallery" data-id="${item.id}"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete-gallery" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
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
    const tbody = document.getElementById('galleryTableBody');
    if (!filterBtns.length || !tbody) return;

    // Use current active filter or default to 'all'
    let activeFilter = filterContainer.querySelector('.filter.active')?.dataset.filter || 'all';

    const filterTable = () => {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const categoryCell = row.querySelector('td:nth-child(4)');
            if (!categoryCell) return;

            const category = categoryCell.textContent.trim().toLowerCase();
            const match = activeFilter === 'all' || category === activeFilter;
            row.style.display = match ? '' : 'none';
        });
    };

    filterBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            filterTable();
        };
    });

    filterTable(); // Run immediately
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
            const resizedBlob = await resizeImage(file, 1000);
            status.textContent = "Uploading optimized image...";
            const storageRef = ref(storage, `gallery/${Date.now()}_${file.name}`);
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

function resizeImage(file, maxWidth) {
    console.log("🛠️ [Resize] Starting resize for:", file.name, "Size:", file.size);
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.error("❌ [Resize] Timeout after 10s");
            reject(new Error("Image processing timed out"));
        }, 10000);

        const reader = new FileReader();
        reader.onerror = (err) => {
            clearTimeout(timeout);
            console.error("❌ [Resize] FileReader error:", err);
            reject(new Error("Failed to read file"));
        };
        reader.onload = (e) => {
            console.log("   ✅ [Resize] File read successfully");
            const img = new Image();
            img.onerror = (err) => {
                clearTimeout(timeout);
                console.error("❌ [Resize] Image load error:", err);
                reject(new Error("Failed to load image"));
            };
            img.onload = () => {
                console.log("   ✅ [Resize] Image loaded into memory. Original:", img.width, "x", img.height);
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                console.log("   ✅ [Resize] Canvas drawn. Final size:", width, "x", height);

                try {
                    canvas.toBlob((blob) => {
                        clearTimeout(timeout);
                        if (blob) {
                            console.log("   ✅ [Resize] Blob created successfully. Final Size:", blob.size);
                            resolve(blob);
                        } else {
                            console.error("❌ [Resize] toBlob returned null");
                            reject(new Error("Canvas toBlob failed"));
                        }
                    }, file.type || "image/jpeg", 0.85);
                } catch (blobErr) {
                    clearTimeout(timeout);
                    console.error("❌ [Resize] toBlob exception:", blobErr);
                    reject(blobErr);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
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
            renderPalawanGalleryTable(gallery);
        } catch (e) {
            console.error("Palawan gallery cache error", e);
        }
    }

    // 2. Real-time Listener
    activePalawanGalleryListener = onSnapshot(collection(db, "PalawanGallery"), (snapshot) => {
        const gallery = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        localStorage.setItem(PALAWAN_GALLERY_CACHE_KEY, JSON.stringify({
            gallery,
            timestamp: Date.now()
        }));
        renderPalawanGalleryTable(gallery);
    });
}

function renderPalawanGalleryTable(gallery) {
    const tbody = document.getElementById("palawanGalleryTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    gallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    gallery.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${item.image}" alt="palawan" style="width:60px; height:40px; object-fit:cover; border-radius:4px;"></td>
            <td><strong>${item.title || "-"}</strong></td>
            <td><small>${item.description || "-"}</small></td>
            <td style="text-align:center;">${item.display ? '<i class="fas fa-check" style="color:var(--accent);"></i>' : '<i class="fas fa-times" style="opacity:0.3;"></i>'}</td>
            <td>
                <button class="action-btn edit-palawan-gallery" data-id="${item.id}"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete-palawan-gallery" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
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
            const resizedBlob = await resizeImage(file, 1000);
            console.log("🚀 [Upload] Starting Firebase Storage upload...");
            status.textContent = "Uploading optimized image...";
            const storageRef = ref(storage, `palawan-gallery/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, resizedBlob);
            imageUrl = await getDownloadURL(storageRef);
            console.log("✅ [Upload] Image uploaded successfully. URL:", imageUrl);
        }

        if (!currentUserId) {
            throw new Error("User session not found. Please refresh page.");
        }

        const docData = {
            title: document.getElementById("palawanGalleryTitle").value,
            description: document.getElementById("palawanGalleryDescription").value,
            display: document.getElementById("palawanGalleryDisplay").checked,
            added_at: serverTimestamp(),
            added_by: doc(db, "Users", currentUserId)
        };

        if (imageUrl) docData.image = imageUrl;

        console.log("Saving document to Firestore:", docData);
        if (isPalawanGalleryEditMode) {
            await updateDoc(doc(db, "PalawanGallery", id), docData);
        } else {
            await addDoc(collection(db, "PalawanGallery"), docData);
        }
        console.log("Document saved successfully");

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
