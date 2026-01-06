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

const app = initializeApp(firebaseConfig, "palawan-gallery-app");
const db = getFirestore(app);

const PALAWAN_GALLERY_CACHE_KEY = "kai_isla_palawan_gallery";

function initPalawanGallery() {
    const galleryContainer = document.querySelector(".palawan-gallery");
    if (!galleryContainer) return;

    // 1. Load from Cache
    const cachedData = localStorage.getItem(PALAWAN_GALLERY_CACHE_KEY);
    if (cachedData) {
        try {
            const { gallery } = JSON.parse(cachedData);
            console.log("🚀 [Cache] Loading initial Palawan gallery...");
            renderPalawanGallery(gallery);
        } catch (e) {
            console.error("Palawan gallery cache error", e);
        }
    }

    // 2. Real-time Listener
    console.log("📡 [Firebase] Syncing Palawan gallery...");
    const q = query(collection(db, "PalawanGallery"), where("display", "==", true));

    onSnapshot(q, (snapshot) => {
        const gallery = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update Cache
        localStorage.setItem(PALAWAN_GALLERY_CACHE_KEY, JSON.stringify({
            gallery,
            timestamp: Date.now()
        }));

        renderPalawanGallery(gallery);
    });
}

function renderPalawanGallery(gallery) {
    const container = document.querySelector(".palawan-gallery");
    if (!container) return;

    console.log(`🚀 [Palawan Gallery] Rendering ${gallery.length} dynamic items`);

    // Sort by added_at descending
    gallery.sort((a, b) => (b.added_at?.seconds || 0) - (a.added_at?.seconds || 0));

    container.innerHTML = "";

    gallery.forEach(item => {
        const div = document.createElement("div");
        div.className = "gallery-item";

        div.innerHTML = `
            <img src="${item.image}" alt="${item.title || "Palawan"}" loading="lazy">
            <div class="gallery-overlay">
                <h3>${item.title || ""}</h3>
                <p>${item.description || ""}</p>
            </div>
        `;
        container.appendChild(div);
    });

    // Re-initialize Palawan gallery scroll logic if it exists
    if (window.initPalawanGalleryScroll) {
        window.initPalawanGalleryScroll();
    }
}

document.addEventListener("DOMContentLoaded", initPalawanGallery);
