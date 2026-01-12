import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

const USER_CACHE_KEY = "kai_isla_user_profile";
let currentUid = null;

// Initialize Profile Page
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUid = user.uid;
        console.log("Profile page: User authenticated", user.email);
        await loadUserProfile(user.uid);
    } else {
        // Auth protection is handled in auth.js (redirects to login)
        console.log("Profile page: No user found");
    }
});

async function loadUserProfile(uid) {
    // 1. Load from Cache Instantly
    const cachedData = localStorage.getItem(USER_CACHE_KEY);
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            if (data.uid === uid) {
                renderProfileData(data);
                console.log("⚡ [Cache] Profile loaded instantly");
            }
        } catch (e) { console.warn("Cache parse error", e); }
    }

    // 2. Fetch from Firestore (Background Sync)
    try {
        const userDoc = await getDoc(doc(db, "Users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            renderProfileData({ ...data, uid });

            // Update Cache
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                photo_url: data.photo_url,
                uid: uid,
                role: data.role,
                display_name: data.display_name,
                phone_number: data.phone_number,
                timestamp: Date.now()
            }));
            console.log("✅ [Firestore] Profile synced");
        }
    } catch (err) {
        console.error("Error syncing profile:", err);
    }
}

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
        roleField.readOnly = true; // Always read-only as requested
    }
    if (emailField) emailField.value = data.email || (auth.currentUser ? auth.currentUser.email : '');

    if (topName) topName.textContent = data.display_name || 'User Profile';
    if (topRole) topRole.textContent = data.role || 'Member';

    if (profileImg) {
        profileImg.src = data.photo_url || (auth.currentUser ? auth.currentUser.photoURL : 'images/logo.png') || 'images/logo.png';
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
    btnText.style.display = 'none';
    loader.style.display = 'block';
    statusMsg.className = 'status-message';
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

        // Clear Cache to reflect changes site-wide
        localStorage.removeItem(USER_CACHE_KEY);

        if (window.showSnackbar) {
            showSnackbar("Profile updated successfully!", "success");
        } else {
            statusMsg.textContent = "Profile updated successfully!";
            statusMsg.classList.add('success');
        }

    } catch (err) {
        console.error("Error saving profile:", err);
        if (window.showSnackbar) {
            showSnackbar("Failed to update profile. Please try again.", "error");
        } else {
            statusMsg.textContent = "Failed to update profile. Please try again.";
            statusMsg.classList.add('error');
        }
    } finally {
        saveBtn.disabled = false;
        btnText.style.display = 'block';
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

        // Clear Cache to reflect changes site-wide
        localStorage.removeItem(USER_CACHE_KEY);

        if (window.showSnackbar) {
            showSnackbar("Photo updated successfully!", "success");
            statusMsg.textContent = "";
        } else {
            statusMsg.textContent = "Photo updated successfully!";
            statusMsg.classList.add('success');
        }

    } catch (err) {
        console.error("Upload failed:", err);
        profileImg.src = originalSrc;
        if (window.showSnackbar) {
            showSnackbar("Upload failed. Please try again.", "error");
            statusMsg.textContent = "";
        } else {
            statusMsg.textContent = "Upload failed. Please try again.";
            statusMsg.classList.add('error');
        }
    }
});
