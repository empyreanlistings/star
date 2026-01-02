import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, addDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

console.log("Admin Dashboard Script Loaded");
// alert("Admin Script Loaded"); // Uncomment if needed for visible check

// Globals
let isEditMode = false;
let isInitialized = false;
let modal;

// Init
document.addEventListener("DOMContentLoaded", () => {
    if (isInitialized) return;
    isInitialized = true;

    console.log("Admin Dashboard Initializing...");
    modal = document.getElementById("listingModal");

    // Check Auth State before fetching
    const auth = (window.firebase && window.firebase.auth) ? window.firebase.auth() : null;
    // Since we use ES modules, we should wait for onAuthStateChanged in auth.js
    // Alternatively, we can export the auth check or just check currentUser after a short delay
    // Best practice: auth.js handles the redirect, admin-dashboard.js should just fetch if possible.

    // To be safe, we'll fetch only if we see the auth-verified class on body
    const checkAuthAndFetch = () => {
        if (document.body.classList.contains('auth-verified')) {
            fetchAdminListings();
            initModalEvents();
        } else {
            // Wait up to 2 seconds for auth.js to verify
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (document.body.classList.contains('auth-verified')) {
                    clearInterval(interval);
                    fetchAdminListings();
                    initModalEvents();
                } else if (attempts > 20) {
                    clearInterval(interval);
                    console.warn("Auth verification timed out.");
                }
            }, 100);
        }
    };

    checkAuthAndFetch();
});



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
            console.log("Loading Dashboard listings from PERSISTENT CACHE");
            renderAdminTable(listings);
            return;
        } catch (e) {
            console.error("Error parsing cache", e);
        }
    }

    // 2. Fetch from Firebase
    try {
        console.log("Fetching Dashboard listings from FIREBASE");
        const snapshot = await getDocs(collection(db, "Listings"));

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;">No listings found.</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Error loading listings.</td></tr>`;
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
                lot_size: document.getElementById("propSize").value
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
            await updateDoc(docRef, docData);
            // Invalidate cache
            localStorage.removeItem("kai_isla_listings");
            alert("Listing updated successfully!");
        } else {
            // CREATE
            if (!docData.media) {
                throw new Error("Image is required for new listings.");
            }
            docData.created_at = new Date().toISOString();
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
