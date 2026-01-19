import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAu9fL7HRSouwBAvmi9SI4AomaHd7epvpY",
    authDomain: "empyrean-3da06.firebaseapp.com",
    projectId: "empyrean-3da06",
    storageBucket: "empyrean-3da06.firebasestorage.app",
    messagingSenderId: "973213.57906",
    appId: "1:973213.57906:web:5cfbee0541932e579403b3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ENQUIRY_CACHE_KEY = "star_enquiry_submitted";

/**
 * Checks if the user has already submitted an enquiry from this browser.
 * @returns {boolean}
 */
export function hasSubmittedEnquiry() {
    return localStorage.getItem(ENQUIRY_CACHE_KEY) === "true";
}

/**
 * Marks the user as having submitted an enquiry.
 */
function markAsSubmitted() {
    localStorage.setItem(ENQUIRY_CACHE_KEY, "true");
}

/**
 * Submits a basic enquiry from the Website (Frontend).
 * Hardcodes specific fields as per requirements.
 * @param {string} email
 * @returns {Promise<string>} Document ID
 */
export async function submitWebsiteEnquiry(email) {
    if (hasSubmittedEnquiry()) {
        throw new Error("You have already subscribed!");
    }

    const enquiryData = {
        email: email,
        created_at: serverTimestamp(),
        responded: false,
        off_plan: true,
        custom_build: false,
        via_website: true,
        via_facebook: false,
        via_instagram: false,
        via_tiktok: false,
        via_word_of_mouth: false,
        via_direct_contact: false,
        name: "", // Not collected on front-end form
        phone_number: "", // Not collected on front-end form
        comments: [], // Initialize empty
        source: "website_early_bird" // Internal tracker
    };

    try {
        const docRef = await addDoc(collection(db, "Enquiries"), enquiryData);
        markAsSubmitted();
        console.log("✅ Enquiry submitted:", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding enquiry: ", e);
        throw e;
    }
}

/**
 * Submits a manual enquiry from the Admin Dashboard.
 * Allows full control over all fields.
 * @param {Object} data - Form data object
 * @returns {Promise<string>} Document ID
 */
export async function submitManualEnquiry(data) {
    // Validate required
    if (!data.name && !data.email) {
        throw new Error("Name or Email is required.");
    }

    const enquiryData = {
        created_at: serverTimestamp(),
        name: data.name || "",
        email: data.email || "",
        phone_number: data.phone || "",
        responded: data.responded === true,
        off_plan: data.off_plan !== false,
        custom_build: data.custom_build === true,

        // New Detailed Fields
        listing_for_sale: data.listing_for_sale === true,
        listing_for_lease: data.listing_for_lease === true,
        property_type: data.property_type || "",
        has_parking: data.has_parking === true,
        parking_spaces: parseInt(data.parking_spaces) || 0,
        furnished: data.furnished === true,
        balcony: data.balcony === true,
        floor_number: data.floor_number || "",
        unit_number: data.unit_number || "",
        area: data.area || "",
        selling_price: parseFloat(data.selling_price) || 0,
        lease_price: parseFloat(data.lease_price) || 0,

        // Source Logic
        source: data.source || "manual",
        telegram_link: data.telegram_link || "",

        // Legacy compatibility / defaults for frontend filters if any
        via_website: data.source === "website",
        via_facebook: data.source === "facebook",
        via_instagram: data.source === "instagram",
        via_tiktok: data.source === "tiktok",

        comments: data.comments ? [{
            text: data.comments,
            timestamp: new Date().toISOString(),
            author: "admin_initial"
        }] : []
    };

    try {
        const docRef = await addDoc(collection(db, "Enquiries"), enquiryData);
        console.log("✅ Manual enquiry submitted:", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding manual enquiry: ", e);
        throw e;
    }
}

// Global exposure for non-module usage if needed (though we'll try to use modules)
window.submitWebsiteEnquiry = submitWebsiteEnquiry;
window.submitManualEnquiry = submitManualEnquiry;
window.hasSubmittedEnquiry = hasSubmittedEnquiry;

/**
 * Validates email format
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Initializes the frontend enquiry form.
 * Should be called after the component is loaded.
 */
export function initWebsiteEnquiryLogic() {
    console.log("🛠️ [Enquiry] Initializing website enquiry logic...");
    const form = document.getElementById("websiteEnquiryForm");
    const container = document.getElementById("enquiryFormContainer");
    const successMsg = document.getElementById("enquirySuccessMsg");
    const btn = document.getElementById("websiteSubmitBtn");

    // 1. Check if already submitted
    if (hasSubmittedEnquiry()) {
        if (form) form.style.display = "none";
        if (successMsg) successMsg.style.display = "block";
        return;
    }

    if (!form || !btn) {
        // If not found, it might be because the component hasn't loaded yet.
        // The event listener in index.html should handle this retry/wait.
        // console.warn("Enquiry form not found in DOM");
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("websiteEmail");
        const email = emailInput ? emailInput.value.trim() : "";

        if (!email || !isValidEmail(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = "Submitting...";

            await submitWebsiteEnquiry(email);

            // Show Success
            form.style.display = "none";
            if (successMsg) successMsg.style.display = "block";

        } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.textContent = "Subscribe";
            if (err.message.includes("already subscribed")) {
                form.style.display = "none";
                if (successMsg) successMsg.style.display = "block";
            } else {
                alert("Something went wrong. Please try again.");
            }
        }
    });
}

