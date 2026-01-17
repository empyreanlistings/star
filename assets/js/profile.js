import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const storage = getStorage(app);
const auth = getAuth(app);

const USER_CACHE_KEY = "star_user_profile";
let currentUid = null;

/**
 * Renders user data to the DOM fields.
 * Extracted into a named function for early cache loading.
 */
function renderProfileData(data) {
    const displayNameField = document.getElementById('display_name');
    const phoneField = document.getElementById('phone_number');
    const roleField = document.getElementById('role');
    const emailField = document.getElementById('profileEmail');
    const topName = document.getElementById('topDisplayName');
    const topRole = document.getElementById('topUserRole');
    const profileImg = document.getElementById('profileDisplayImg');

    if (displayNameField) displayNameField.value = data.display_name || '';
    if (phoneField) phoneField.value = data.phone_number || '';
    if (roleField) {
        roleField.value = data.role || '';
        roleField.readOnly = true;
    }
    if (emailField) emailField.value = data.email || (auth.currentUser ? auth.currentUser.email : '');

    if (topName) topName.textContent = data.display_name || 'User Profile';
    if (topRole) topRole.textContent = data.role || 'Member';

    if (profileImg) {
        profileImg.src = data.photo_url || (auth.currentUser ? auth.currentUser.photoURL : 'images/logo.png') || 'images/logo.png';
    }
}

// ⚡ [IMPROVEMENT] Try Early Cache Load IMMEDIATELY before auth initialization
(() => {
    const cachedData = localStorage.getItem(USER_CACHE_KEY);
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            renderProfileData(data);
            console.log("⚡ [Early Cache] Rendered profile data instantly");
        } catch (e) {
            console.warn("Early cache parse error", e);
        }
    }
})();

// Initialize Profile Page
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUid = user.uid;
        console.log("Profile page: User authenticated", user.email);
        await loadUserProfile(user.uid);
    } else {
        console.log("Profile page: No user found");
    }
});

async function loadUserProfile(uid) {
    // Background Sync with Firestore
    try {
        const userDoc = await getDoc(doc(db, "Users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            renderProfileData({ ...data, uid });

            // Ensure cache is updated with latest from server
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                photo_url: data.photo_url,
                uid: uid,
                role: data.role,
                display_name: data.display_name,
                phone_number: data.phone_number,
                timestamp: Date.now()
            }));
            console.log("✅ [Firestore] Profile synced and cached");
        }
    } catch (err) {
        console.error("Error syncing profile:", err);
    }
}

// Handle Form Submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUid) return;

    const saveBtn = document.getElementById('saveProfileBtn');
    const btnText = saveBtn.querySelector('.btn-text');
    const loader = saveBtn.querySelector('.loader');
    const statusMsg = document.getElementById('saveMessage');

    // Loading State
    saveBtn.disabled = true;
    btnText.style.visibility = 'hidden'; // Keep width
    loader.style.display = 'block';
    statusMsg.textContent = '';

    const updatedData = {
        display_name: document.getElementById('display_name').value,
        phone_number: document.getElementById('phone_number').value,
        role: document.getElementById('role').value,
        edited_at: serverTimestamp(),
        edited_by: doc(db, "Users", currentUid)
    };

    try {
        await updateDoc(doc(db, "Users", currentUid), updatedData);

        // Update Local UI
        document.getElementById('topDisplayName').textContent = updatedData.display_name;
        document.getElementById('topUserRole').textContent = updatedData.role;

        // Update Cache instead of removing it for instant persistence
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (cachedUser) {
            const data = JSON.parse(cachedUser);
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                ...data,
                display_name: updatedData.display_name,
                phone_number: updatedData.phone_number,
                role: updatedData.role,
                timestamp: Date.now()
            }));
        }

        if (window.showSnackbar) {
            console.log("Calling snackbar: Profile updated successfully!");
            window.showSnackbar("Profile updated successfully!", "success");
        } else {
            console.warn("Snackbar function not found!");
            statusMsg.textContent = "Profile updated successfully!";
            statusMsg.classList.add('success');
        }

    } catch (err) {
        console.error("Error saving profile:", err);
        if (window.showSnackbar) {
            window.showSnackbar("Failed to update profile. Please try again.", "error");
        } else {
            statusMsg.textContent = "Failed to update profile. Please try again.";
            statusMsg.classList.add('error');
        }
    } finally {
        saveBtn.disabled = false;
        btnText.style.visibility = 'visible';
        loader.style.display = 'none';
    }
});

// Handle Image Upload
document.getElementById('avatarInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUid) return;

    const statusMsg = document.getElementById('saveMessage');
    const profileImg = document.getElementById('profileDisplayImg');
    const originalSrc = profileImg.src;

    // Fast preview
    const reader = new FileReader();
    reader.onload = (event) => { profileImg.src = event.target.result; };
    reader.readAsDataURL(file);

    statusMsg.className = 'status-message';
    statusMsg.textContent = "Uploading new photo...";

    try {
        const fileRef = ref(storage, `users/${currentUid}/avatar_${Date.now()}`);
        const snapshot = await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        // Update Firestore
        await updateDoc(doc(db, "Users", currentUid), {
            photo_url: downloadUrl,
            edited_at: serverTimestamp()
        });

        // Update UI
        profileImg.src = downloadUrl;

        // Update Cache instead of removing it
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (cachedUser) {
            const data = JSON.parse(cachedUser);
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                ...data,
                photo_url: downloadUrl,
                timestamp: Date.now()
            }));
        }

        if (window.showSnackbar) {
            window.showSnackbar("Photo updated successfully!", "success");
            statusMsg.textContent = "";
        } else {
            statusMsg.textContent = "Photo updated successfully!";
            statusMsg.classList.add('success');
        }

    } catch (err) {
        console.error("Upload failed:", err);
        profileImg.src = originalSrc;
        if (window.showSnackbar) {
            window.showSnackbar("Upload failed. Please try again.", "error");
            statusMsg.textContent = "";
        } else {
            statusMsg.textContent = "Upload failed. Please try again.";
            statusMsg.classList.add('error');
        }
    }
});
