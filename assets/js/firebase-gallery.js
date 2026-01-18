import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    onSnapshot,
    query,
    where,
    deleteDoc,
    doc,
    getDoc,
    updateDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, deleteObject, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ... existing config ...

// ... existing initDynamicGallery ...

// ... existing renderGalleryItems ...

// ... existing deleteGalleryItem ...

// ... existing openEditGalleryModal ...

// UPDATE / SAVE LOGIC
async function handleGallerySubmit(e) {
    e.preventDefault();
    if (!currentUser) return alert("You must be logged in.");

    const btn = document.getElementById("gallerySubmitBtn");
    const status = document.getElementById("galleryUploadStatus");
    const id = document.getElementById("galleryItemId").value;

    // Form Data
    const headline = document.getElementById("galleryHeadline").value;
    const sub_header = document.getElementById("gallerySubHeader").value;
    const activeChip = document.querySelector("#galleryCategoryChips .chip.active");
    const category = activeChip ? activeChip.dataset.value : "structural";
    const display = document.getElementById("galleryDisplay").checked;
    const imageFile = document.getElementById("galleryImage").files[0];

    btn.disabled = true;
    btn.textContent = "Saving...";
    status.textContent = "Processing...";

    try {
        let imageUrl = null;
        let imageRefPath = null;

        // If new image selected, upload it
        if (imageFile) {
            const fileRef = ref(storage, `gallery/${Date.now()}_${imageFile.name}`);
            const snapshot = await uploadBytes(fileRef, imageFile);
            imageUrl = await getDownloadURL(snapshot.ref);
            imageRefPath = snapshot.ref.fullPath;
        }

        if (id) {
            // UPDATE EXISTING
            const updateData = {
                headline,
                sub_header,
                category,
                display,
                updated_at: new Date()
            };
            if (imageUrl) {
                updateData.image = imageUrl;
                updateData.imageRef = imageRefPath;
                // Note: We could delete the old image here if we fetched the old ref.
            }

            await updateDoc(doc(db, "Gallery", id), updateData);
            alert("Gallery item updated successfully!");
        } else {
            // CREATE NEW (If we use this modal for creation too)
            if (!imageFile) throw new Error("Image required for new items.");

            await addDoc(collection(db, "Gallery"), {
                headline,
                sub_header,
                category,
                display,
                image: imageUrl,
                imageRef: imageRefPath,
                added_at: new Date()
            });
            alert("Gallery item created successfully!");
        }

        // Close Modal
        document.getElementById("galleryModal").style.display = "none";
        document.body.style.overflow = "";
        document.getElementById("galleryForm").reset();

    } catch (error) {
        console.error("Error saving gallery item:", error);
        status.textContent = "Error: " + error.message;
        alert("Error saving: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = id ? "Save Changes" : "Upload Gallery Item";
        status.textContent = "";
    }
}

// Bind Submit Listener (Event Delegation or Direct if Element Exists)
// Since modal is loaded dynamically, we should use delegation on document or wait for load.
document.addEventListener("submit", (e) => {
    if (e.target && e.target.id === "galleryForm") {
        handleGallerySubmit(e);
    }
});

const firebaseConfig = {
    apiKey: "AIzaSyAu9fL7HRSouwBAvmi9SI4AomaHd7epvpY",
    authDomain: "empyrean-3da06.firebaseapp.com",
    projectId: "empyrean-3da06",
    storageBucket: "empyrean-3da06.firebasestorage.app",
    messagingSenderId: "973213656906",
    appId: "1:973213656906:web:5cfbee0541932e579403b3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const GALLERY_CACHE_KEY = "star_gallery";

let currentUser = null;

function initDynamicGallery() {
    const galleryContainer = document.querySelector(".mixed-gallery");
    if (!galleryContainer) return;

    // Monitor Auth State for Admin Actions
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        // Re-render to show/hide buttons
        const cachedData = localStorage.getItem(GALLERY_CACHE_KEY);
        if (cachedData) {
            const { gallery } = JSON.parse(cachedData);
            renderGalleryItems(gallery);
        }
    });

    // 1. Load from Cache
    const cachedData = localStorage.getItem(GALLERY_CACHE_KEY);
    if (cachedData) {
        try {
            const { gallery } = JSON.parse(cachedData);
            console.log("🚀 [Cache] Loading initial gallery...");
            renderGalleryItems(gallery);
        } catch (e) {
            console.error("Gallery cache error", e);
        }
    }

    // 2. Real-time Listener
    console.log("📡 [Firebase] Syncing gallery...");
    const q = query(collection(db, "Gallery"), where("display", "==", true));

    onSnapshot(q, (snapshot) => {
        const gallery = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update Cache
        localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify({
            gallery,
            timestamp: Date.now()
        }));

        renderGalleryItems(gallery);
    });
}

function renderGalleryItems(gallery) {
    const container = document.querySelector(".mixed-gallery");
    if (!container) return;

    // Check if we're on index.html - limit to 12 images
    const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

    // Performance Check: Has data changed?
    const currentIds = Array.from(container.querySelectorAll('.gallery-item')).map(el => el.dataset.id || '').join(',');
    const newIds = (isIndexPage ? gallery.slice(0, 12) : gallery).map(i => i.id).join(',');

    if (currentIds === newIds && container.children.length > 0) {
        console.log("⚡ [Performance] Skipping redundant gallery render");
        return;
    }

    const displayGallery = isIndexPage ? gallery.slice(0, 12) : gallery;

    console.log(`🚀 [Gallery] Rendering ${displayGallery.length} dynamic items${isIndexPage ? ' (limited to 12 for index)' : ''}`);

    // Sort by added_at descending
    displayGallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    container.innerHTML = "";

    displayGallery.forEach(item => {
        const div = document.createElement("div");
        div.className = "gallery-item";
        div.dataset.category = item.category || "all";

        let adminActions = "";
        if (currentUser) {
            adminActions = `
                <div class="admin-actions-overlay">
                    <button class="admin-btn edit" onclick="event.preventDefault(); event.stopImmediatePropagation(); window.openEditGalleryModal('${item.id}')" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="admin-btn delete" onclick="event.preventDefault(); event.stopImmediatePropagation(); window.deleteGalleryItem('${item.id}', '${item.imageRef || ''}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="img-wrap">
                <img src="${item.image}" alt="${item.headline || "Gallery Image"}" loading="lazy">
            </div>
            <div class="gallery-overlay">
                <h3>${item.headline || ""}</h3>
                <p>${item.sub_header || ""}</p>
            </div>
            ${adminActions}
        `;
        container.appendChild(div);
    });

    // Re-initialize gallery logic (filters, animations, lightbox)
    if (window.initGallery) {
        window.initGallery();
    }
}

// Global functions for Admin Actions
window.deleteGalleryItem = async (id, imageRefPath) => {
    if (!confirm("Are you sure you want to delete this image? This cannot be undone.")) return;

    try {
        // 1. Delete from Firestore
        await deleteDoc(doc(db, "Gallery", id));

        // 2. Delete from Storage (if ref exists)
        if (imageRefPath) {
            const imageRef = ref(storage, imageRefPath);
            await deleteObject(imageRef).catch(e => console.warn("Storage delete failed", e));
        }

        alert("Gallery item deleted.");
        // Rerender handled by onSnapshot
    } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item: " + error.message);
    }
};


// Open Edit Modal
window.openEditGalleryModal = async (id) => {
    const modal = document.getElementById("galleryModal");
    if (!modal) {
        alert("Edit modal not found.");
        return;
    }

    console.log("Opening edit modal for:", id);

    // Use .active class to trigger CSS transitions (opacity/visibility)
    // AND set display property to ensure it exists in layout
    modal.classList.add("active");
    modal.style.display = "flex"; // Force flex to match CSS requirement
    document.body.style.overflow = "hidden"; // Lock scroll

    // Explicitly bind close handlers to ensure they work
    const closeBtn = document.getElementById("closeGalleryModal");
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove("active");
            setTimeout(() => {
                modal.style.display = "none";
                document.body.style.overflow = "";
            }, 300); // Wait for transition
        };
    }

    // Check background click
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.classList.remove("active");
            setTimeout(() => {
                modal.style.display = "none";
                document.body.style.overflow = "";
            }, 300);
        }
    };

    // Set ID
    document.getElementById("galleryItemId").value = id;

    // Fetch Data
    try {
        const docRef = doc(db, "Gallery", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById("galleryHeadline").value = data.headline || "";
            document.getElementById("gallerySubHeader").value = data.sub_header || "";
            document.getElementById("galleryDisplay").checked = data.display !== false; // Default true

            // Set Category Chips
            const chips = document.querySelectorAll("#galleryCategoryChips .chip");
            chips.forEach(chip => {
                if (chip.dataset.value === data.category) {
                    chip.classList.add("active");
                } else {
                    chip.classList.remove("active");
                }
            });

            // Chip click logic (simple inline for now)
            chips.forEach(chip => {
                chip.onclick = () => {
                    chips.forEach(c => c.classList.remove("active"));
                    chip.classList.add("active");
                };
            });

        } else {
            console.log("No such document!");
        }
    } catch (e) {
        console.error("Error fetching doc:", e);
    }
};

// Close logic global handler
document.addEventListener("click", (e) => {
    if (e.target.id === "closeGalleryModal") {
        const modal = document.getElementById("galleryModal");
        if (modal) {
            modal.classList.remove("active");
            setTimeout(() => {
                modal.style.display = "none";
                document.body.style.overflow = "";
            }, 300);
        }
    }
});

// Expose globally for main.js
window.initDynamicGallery = initDynamicGallery;
