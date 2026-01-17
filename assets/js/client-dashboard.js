/* ================================================================
   CLIENT DASHBOARD - INSPECTIONS GALLERY SYSTEM
   ================================================================ */

import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAu9fL7HRSouwBAvmi9SI4AomaHd7epvpY",
    authDomain: "empyrean-3da06.firebaseapp.com",
    projectId: "empyrean-3da06",
    storageBucket: "empyrean-3da06.firebasestorage.app",
    messagingSenderId: "973213656906",
    appId: "1:973213656906:web:5cfbee0541932e579403b3"
};

// Initialize or Get App
let app;
try {
    app = getApp();
} catch (e) {
    app = initializeApp(firebaseConfig);
}

const db = getFirestore(app);

const INSPECTIONS_CACHE_KEY = "star_inspections";
let inspectionsList = [];
let currentLightboxIndex = 0;

/**
 * Format date as: Monday, 14th Jan 2026 (9:52am)
 */
function formatInspectionDate(dateObj) {
    if (!dateObj) return "";

    // Handle Firestore Timestamp or Date string
    const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const dayName = days[date.getDay()];
    const dayOfMonth = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;

    const ordinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return `${dayName}, ${ordinal(dayOfMonth)} ${monthName} ${year} (${hours}:${minutes}${ampm})`;
}

// --- Lightbox Functions ---
function openLightbox(index) {
    const lightbox = document.getElementById("inspections-lightbox");
    const img = document.getElementById("inspections-lightbox-img");
    const caption = lightbox?.querySelector(".lightbox-caption");

    if (!lightbox || !img || !inspectionsList[index]) return;

    currentLightboxIndex = index;
    const item = inspectionsList[index];

    // Smooth transition
    img.style.opacity = '0';
    img.src = item.url;
    img.onload = () => img.style.opacity = '1';

    if (caption) {
        caption.innerHTML = `
            <div class="caption-content">
                <h3>${item.description || "Construction Update"}</h3>
                <p class="inspection-notes">${item.notes || "No additional notes provided."}</p>
                <span class="inspection-date">${item.dateFormatted}</span>
            </div>
        `;
    }

    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    lightbox.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeLightbox() {
    const lightbox = document.getElementById("inspections-lightbox");
    if (!lightbox) return;

    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    setTimeout(() => {
        if (!lightbox.classList.contains("open")) {
            lightbox.style.display = "none";
        }
    }, 400);
    document.body.style.overflow = "";
}

function navigateLightbox(dir) {
    const newIndex = (currentLightboxIndex + dir + inspectionsList.length) % inspectionsList.length;
    openLightbox(newIndex);
}

// --- Data Rendering ---
function renderInspections(inspections) {
    const container = document.getElementById("inspectionsGallery");
    if (!container) return;

    // Flatten media_gallery lists from each inspection doc
    inspectionsList = [];
    inspections.forEach(doc => {
        const media = doc.media_gallery || [];
        const dateFormatted = formatInspectionDate(doc.created_at);

        media.forEach(imageUrl => {
            inspectionsList.push({
                url: imageUrl,
                description: doc.description || doc.project_name || "Daily Progress update",
                notes: doc.notes || "",
                dateFormatted: dateFormatted,
                created_at: doc.created_at
            });
        });
    });

    // Sort flattened list by created_at descending (newest first)
    inspectionsList.sort((a, b) => {
        const timeA = a.created_at?.seconds || new Date(a.created_at).getTime() || 0;
        const timeB = b.created_at?.seconds || new Date(b.created_at).getTime() || 0;
        return timeB - timeA;
    });

    container.innerHTML = "";

    if (inspectionsList.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; opacity: 0.5;">
                <i class="fas fa-camera-retro" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <p>No inspection updates have been posted yet.</p>
            </div>
        `;
        return;
    }

    inspectionsList.forEach((item, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "gallery-item";
        itemDiv.setAttribute("role", "button");
        itemDiv.setAttribute("aria-label", `View construction update from ${item.dateFormatted}`);
        itemDiv.onclick = () => openLightbox(index);

        itemDiv.innerHTML = `
            <div class="img-wrap">
                <img src="${item.url}" alt="Construction Update" loading="lazy">
            </div>
            <div class="gallery-overlay">
                <h3>${item.description}</h3>
                <p>${item.dateFormatted}</p>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

// --- Core Logic ---
function initInspections() {
    const container = document.getElementById("inspectionsGallery");
    if (!container) return;

    // 1. Instantly Render from Cache
    const cached = localStorage.getItem(INSPECTIONS_CACHE_KEY);
    if (cached) {
        try {
            const { inspections } = JSON.parse(cached);
            console.log("⚡ [Cache] Rendering inspections instantly...");
            renderInspections(inspections);
        } catch (e) {
            console.error("Cache parsing failed", e);
        }
    }

    // 2. Real-time Firebase Sync
    console.log("📡 [Firebase] Syncing inspections...");
    const q = query(collection(db, "Inspections"), orderBy("created_at", "desc"));

    onSnapshot(q, (snapshot) => {
        const inspections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update Cache
        localStorage.setItem(INSPECTIONS_CACHE_KEY, JSON.stringify({
            inspections,
            timestamp: Date.now()
        }));

        renderInspections(inspections);
        console.log("✅ [Firestore] Inspections synced");
    }, (error) => {
        console.error("Inspections sync error:", error);
    });

    // 3. Lightbox Global Controls
    const lightbox = document.getElementById("inspections-lightbox");
    if (lightbox) {
        // Prevent lightbox close when clicking arrows or caption
        const arrows = lightbox.querySelectorAll(".lightbox-arrow");
        const caption = lightbox.querySelector(".lightbox-caption");

        lightbox.onclick = (e) => {
            if (e.target === lightbox || e.target.id === "inspections-lightbox-img") {
                closeLightbox();
            }
        };

        lightbox.querySelector(".lightbox-prev")?.addEventListener("click", (e) => {
            e.stopPropagation();
            navigateLightbox(-1);
        });

        lightbox.querySelector(".lightbox-next")?.addEventListener("click", (e) => {
            e.stopPropagation();
            navigateLightbox(1);
        });

        // Keyboard Support
        document.addEventListener("keydown", (e) => {
            if (!lightbox.classList.contains("open")) return;
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowLeft") navigateLightbox(-1);
            if (e.key === "ArrowRight") navigateLightbox(1);
        });
    }
}

// Initial Run
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInspections);
} else {
    initInspections();
}
