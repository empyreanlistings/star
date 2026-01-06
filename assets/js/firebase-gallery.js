import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    onSnapshot,
    query,
    where
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

const GALLERY_CACHE_KEY = "kai_isla_gallery";

function initDynamicGallery() {
    const galleryContainer = document.querySelector(".mixed-gallery");
    if (!galleryContainer) return;

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
    const displayGallery = isIndexPage ? gallery.slice(0, 12) : gallery;

    console.log(`🚀 [Gallery] Rendering ${displayGallery.length} dynamic items${isIndexPage ? ' (limited to 12 for index)' : ''}`);

    // Sort by added_at descending
    displayGallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    container.innerHTML = "";

    displayGallery.forEach(item => {
        const div = document.createElement("div");
        div.className = "gallery-item";
        div.dataset.category = item.category || "all";

        div.innerHTML = `
            <div class="img-wrap">
                <img src="${item.image}" alt="${item.headline || "Gallery Image"}" loading="lazy">
            </div>
            <div class="gallery-overlay">
                <h3>${item.headline || ""}</h3>
                <p>${item.sub_header || ""}</p>
            </div>
        `;
        container.appendChild(div);
    });

    // Re-initialize gallery logic (filters, animations, lightbox)
    if (window.initGallery) {
        window.initGallery();
    }
}

document.addEventListener("DOMContentLoaded", initDynamicGallery);
