import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, addDoc, getDoc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// Init
document.addEventListener("DOMContentLoaded", () => {
    if (isInitialized) return;
    isInitialized = true;

    console.log("Admin Dashboard Initializing...");
    modal = document.getElementById("listingModal");

    // Use Firebase Auth to check user and fetch company
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("User authenticated:", user.email);

            // Fetch user's company first
            await getUserCompany(user.uid);

            // Then fetch listings filtered by company
            fetchAdminListings();
            initModalEvents();
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
// Persistent Caching: No expiry. Cache is manually cleared by admin actions.

// Fetch Listings
async function fetchAdminListings() {
    const tbody = document.getElementById("listingsTableBody");
    if (!tbody) return;

    // 1. Try Cache First
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            const { listings } = JSON.parse(cachedData);
            // Force refresh if the first listing is missing visits/likes (stale cache structure)
            if (listings.length > 0 && !('visits' in listings[0])) {
                console.log("Stale cache detected, forcing fetch...");
                localStorage.removeItem(CACHE_KEY);
            } else {
                console.log("Loading Dashboard listings from PERSISTENT CACHE");
                renderAdminTable(listings);
                return;
            }
        } catch (e) {
            console.error("Error parsing cache", e);
        }
    }

    // 2. Fetch from Firebase with company filter
    try {
        console.log("Fetching Dashboard listings from FIREBASE");

        let snapshot;
        if (currentUserCompany) {
            // Filter by company
            const q = query(
                collection(db, "Listings"),
                where("company", "==", currentUserCompany)
            );
            snapshot = await getDocs(q);
            console.log(`Filtered listings by company: ${currentUserCompany.id}`);
        } else {
            // Fallback: fetch all (for users without company)
            console.warn("No company filter applied - fetching all listings");
            snapshot = await getDocs(collection(db, "Listings"));
        }

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;">No listings found for your company.</td></tr>`;
            return;
        }

        const listings = [];
        snapshot.forEach(docSnap => {
            listings.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 3. Save to Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            listings,
            timestamp: Date.now()
        }));

        renderAdminTable(listings);

    } catch (error) {
        console.error("Error fetching listings:", error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:red;">Error loading listings.</td></tr>`;
    }
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
            fetchAdminListings();
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
        fetchAdminListings();
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
            document.getElementById("propSize").value = data.specs?.lot_size || "";
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
    modal.style.cssText = "";
    modal.style.display = "none";
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
    console.log("openModal called. Edit Mode:", edit);
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

    // Force direct style manipulation + Class
    // Force direct style manipulation + Class
    modal.classList.add("active");
    modal.style.cssText = "display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 2147483647 !important; opacity: 1 !important; visibility: visible !important; background-color: rgba(0,0,0,0.5) !important;";

    // console.log("--- NUCLEAR FORCE APPLIED ---");

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
        if (typeof closeModal === "function") {
            closeModal();
        } else {
            // Fallback if closeModal reference is lost
            modal.classList.remove("active");
            modal.style.cssText = "";
            modal.style.display = "none";
        }
        fetchAdminListings();

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
    const filterBtns = document.querySelectorAll('.property-gallery-filters .filter');
    const priceMin = document.getElementById('dashPriceMin');
    const priceMax = document.getElementById('dashPriceMax');
    const priceRangeValue = document.getElementById('dashPriceRangeValue');
    const tbody = document.getElementById('listingsTableBody');

    if (!filterBtns.length || !priceMin || !priceMax || !tbody) return;

    let activeCategory = 'all';
    let minPrice = 0;
    let maxPrice = 50000000;

    const formatPrice = (val) => {
        const num = parseInt(val);
        if (num >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `₱${(num / 1000).toFixed(0)}K`;
        return `₱${num}`;
    };

    const updatePriceDisplay = () => {
        if (minPrice === 0 && maxPrice === 50000000) {
            priceRangeValue.textContent = 'Any Price';
        } else if (minPrice === 0) {
            priceRangeValue.textContent = `Up to ${formatPrice(maxPrice)}`;
        } else if (maxPrice === 50000000) {
            priceRangeValue.textContent = `${formatPrice(minPrice)}+`;
        } else {
            priceRangeValue.textContent = `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
        }
    };

    const filterTable = () => {
        const rows = tbody.querySelectorAll('tr');
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
