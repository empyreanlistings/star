import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAu9fL7HRSouwBAvmi9SI4AomaHd7epvpY",
    authDomain: "empyrean-3da06.firebaseapp.com",
    projectId: "empyrean-3da06",
    storageBucket: "empyrean-3da06.firebasestorage.app",
    messagingSenderId: "973213.58906",
    appId: "1:973213.58906:web:5cfbee0541932e579403b3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let isLoggingOut = false;

const USER_CACHE_KEY = "star_user_profile";
const REMEMBER_KEY = "star_remember_me";

// --- HELPERS ---
const setLoading = (btn, isLoading) => {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
};

const applyAppsMenuVisibility = (isLoggedIn) => {
    const modal = document.getElementById("appsModal");
    if (modal) {
        if (isLoggedIn) {
            modal.classList.add("user-authenticated");
        } else {
            modal.classList.remove("user-authenticated");
        }
    }
};

const updateAvatarUI = (url, isProfilePage) => {
    const avatarLink = document.getElementById("navAvatarLink");
    const avatarImg = document.getElementById("navAvatarImg");
    const profileIcon = document.getElementById("navDashboardIcon");

    if (!avatarLink) return;

    if (isProfilePage) {
        avatarLink.style.display = "none";
        return;
    }

    avatarLink.style.display = "inline-flex";
    avatarLink.href = "profile.html";

    if (url) {
        if (avatarImg) {
            avatarImg.src = url;
            avatarImg.style.display = "block";
        }
        if (profileIcon) profileIcon.style.display = "none";
    } else {
        if (avatarImg) avatarImg.style.display = "none";
        if (profileIcon) {
            profileIcon.className = "fas fa-user-circle";
            profileIcon.style.display = "block";
        }
    }
};

const updateFooterAuthUI = (isLoggedIn) => {
    const footerBtn = document.getElementById("footerSignInBtn");
    if (footerBtn) {
        if (isLoggedIn) {
            footerBtn.textContent = "SIGN-OUT";
            footerBtn.href = "#";
            footerBtn.onclick = (e) => {
                e.preventDefault();
                window.handleLogout();
            };
        } else {
            footerBtn.textContent = "SIGN-IN";
            footerBtn.href = "login.html";
            footerBtn.onclick = null;
        }
    }
};

// --- AUTH ACTIONS ---
window.handleLogout = async () => {
    isLoggingOut = true;
    try {
        localStorage.removeItem(USER_CACHE_KEY);
        // Clear admin caches too
        localStorage.removeItem("star_listings");
        localStorage.removeItem("star_gallery");
        localStorage.removeItem("star_palawan_gallery");

        await signOut(auth);
        console.log("Logged out successfully.");
    } catch (error) {
        console.error("Logout Error:", error);
        isLoggingOut = false;
    }
};
window.logoutUser = window.handleLogout;

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("rememberMe")?.checked;
    const errorDiv = document.getElementById("loginError");
    const submitBtn = e.target.querySelector("button[type='submit']");

    if (errorDiv) errorDiv.style.display = "none";
    setLoading(submitBtn, true);

    try {
        if (rememberMe) {
            await setPersistence(auth, browserLocalPersistence);
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }));
        } else {
            await setPersistence(auth, browserSessionPersistence);
            localStorage.removeItem(REMEMBER_KEY);
        }

        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Failed", error);
        setLoading(submitBtn, false);
        if (errorDiv) {
            errorDiv.textContent = "Invalid email or password.";
            errorDiv.style.display = "block";
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const avatarFile = document.getElementById("avatarUpload")?.files[0];
    const errorDiv = document.getElementById("signupError");
    const successDiv = document.getElementById("signupSuccess");
    const submitBtn = e.target.querySelector("button[type='submit']");

    if (password !== confirmPassword) {
        if (errorDiv) {
            errorDiv.textContent = "Passwords do not match.";
            errorDiv.style.display = "block";
        }
        return;
    }

    if (errorDiv) errorDiv.style.display = "none";
    setLoading(submitBtn, true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let photoURL = "";
        if (avatarFile) {
            const storageRef = ref(storage, `avatars/${user.uid}/${avatarFile.name}`);
            const snapshot = await uploadBytes(storageRef, avatarFile);
            photoURL = await getDownloadURL(snapshot.ref);
        }

        await updateProfile(user, { displayName: fullName, photoURL: photoURL });

        await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            email: email,
            display_name: fullName,
            photo_url: photoURL,
            role: "user",
            created_at: new Date().toISOString()
        });

        if (successDiv) {
            successDiv.textContent = "Account created successfully! Redirecting...";
            successDiv.style.display = "block";
        }
        // Redirect handled by onAuthStateChanged
    } catch (error) {
        console.error("Signup Failed", error);
        setLoading(submitBtn, false);
        if (errorDiv) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = "block";
        }
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const errorDiv = document.getElementById("resetError");
    const successDiv = document.getElementById("resetSuccess");
    const submitBtn = e.target.querySelector("button[type='submit']");

    if (errorDiv) errorDiv.style.display = "none";
    setLoading(submitBtn, true);

    try {
        await sendPasswordResetEmail(auth, email);
        if (successDiv) {
            successDiv.textContent = "Reset link sent! Please check your email.";
            successDiv.style.display = "block";
        }
        setLoading(submitBtn, false);
    } catch (error) {
        console.error("Reset Failed", error);
        setLoading(submitBtn, false);
        if (errorDiv) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = "block";
        }
    }
}

// --- INITIALIZATION & STATE ---
function initAuth() {
    const path = window.location.pathname.toLowerCase();
    const isDashboard = path.includes("dashboard") && !path.includes("clientdashboard");
    const isClientDashboard = path.includes("clientdashboard");
    const isLogin = path.includes("login");
    const isProfile = path.includes("profile");

    // Pre-flight protection
    if (isDashboard || isClientDashboard || isProfile) {
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (!cachedUser) {
            console.warn("🔐 No cached session. Bouncing to login...");
            window.location.replace("login.html");
            return;
        } else {
            // Fast role check
            try {
                const { role } = JSON.parse(cachedUser);
                if (isDashboard && role !== "admin") { window.location.replace("profile.html"); return; }
                if (isClientDashboard && role !== "owner" && role !== "admin") { window.location.replace("profile.html"); return; }
                // If it passes, stay hidden until confirmed by Firebase (or show if you trust cache)
                document.body.style.opacity = '0';
            } catch (e) {
                window.location.replace("login.html");
                return;
            }
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Logged in:", user.email);
            updateFooterAuthUI(true);
            applyAppsMenuVisibility(true);

            // Display basic info immediately
            const userEmailEl = document.getElementById("userEmail");
            if (userEmailEl) userEmailEl.textContent = user.email;

            // Cache-first UI
            let role = 'user';
            let photoUrl = user.photoURL;
            const cached = localStorage.getItem(USER_CACHE_KEY);
            if (cached) {
                try {
                    const c = JSON.parse(cached);
                    if (c.uid === user.uid) {
                        role = c.role || 'user';
                        photoUrl = c.photo_url || user.photoURL;
                    }
                } catch (e) { }
            }

            updateAvatarUI(photoUrl, isProfile);
            const userRoleEl = document.getElementById("userRole");
            if (userRoleEl) userRoleEl.textContent = role;

            // Nav link updates
            const dashLink = document.getElementById("navDashboardLink");
            if (dashLink) {
                dashLink.style.display = isProfile ? "none" : "inline-flex";
                dashLink.href = role === "owner" ? "clientdashboard.html" : "dashboard.html";
            }
            const navSignInLink = document.getElementById("navSignInLink");
            const navSignInMobile = document.querySelector(".navSignInLinkMobile");
            if (navSignInLink) navSignInLink.style.display = "none";
            if (navSignInMobile) navSignInMobile.style.display = "none";

            // Background Refetch Profile
            try {
                const userDoc = await getDoc(doc(db, "Users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const newRole = data.role || 'user';
                    const newPhoto = data.photo_url || user.photoURL;

                    if (newRole !== role || newPhoto !== photoUrl) {
                        localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                            uid: user.uid, role: newRole, photo_url: newPhoto, email: user.email
                        }));
                        updateAvatarUI(newPhoto, isProfile);
                        if (userRoleEl) userRoleEl.textContent = newRole;
                        if (dashLink) dashLink.href = newRole === "owner" ? "clientdashboard.html" : "dashboard.html";
                    }

                    // Protect pages
                    if (isDashboard && newRole !== "admin") { window.location.replace("profile.html"); return; }
                    if (isClientDashboard && newRole !== "owner" && newRole !== "admin") { window.location.replace("profile.html"); return; }
                    if (isLogin) {
                        if (newRole === "admin") { window.location.replace("dashboard.html"); return; }
                        else if (newRole === "owner") { window.location.replace("clientdashboard.html"); return; }
                        else { window.location.replace("profile.html"); return; }
                    }
                }
            } catch (err) {
                console.error("Profile sync error", err);
            }

            document.body.classList.add('auth-verified');
            document.body.style.opacity = '1';

        } else {
            console.log("Logged out");
            updateFooterAuthUI(false);
            applyAppsMenuVisibility(false);
            localStorage.removeItem(USER_CACHE_KEY);

            if (isLoggingOut) {
                window.location.replace("index.html");
                return;
            }

            if (isDashboard || isClientDashboard || isProfile) {
                window.location.replace("login.html");
                return;
            }

            // Public Nav Resets
            const dashLink = document.getElementById("navDashboardLink");
            if (dashLink) dashLink.style.display = "none";
            const avatarLink = document.getElementById("navAvatarLink");
            if (avatarLink) avatarLink.style.display = "none";
            const navSignInLink = document.getElementById("navSignInLink");
            const navSignInMobile = document.querySelector(".navSignInLinkMobile");
            if (navSignInLink) navSignInLink.style.display = "inline-flex";
            if (navSignInMobile) navSignInMobile.style.display = "block";
        }
    });

    // DOM Interaction Listeners
    document.addEventListener('DOMContentLoaded', () => {
        // Form submissions
        const loginForm = document.getElementById("loginForm");
        if (loginForm) {
            loginForm.addEventListener("submit", handleLogin);
            // Prefill Remember Me
            const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY));
            if (saved && saved.email) {
                const emailInput = document.getElementById("email");
                if (emailInput) emailInput.value = saved.email;
                const remBox = document.getElementById("rememberMe");
                if (remBox) remBox.checked = true;
            }
        }

        const signupForm = document.getElementById("signupForm");
        if (signupForm) signupForm.addEventListener("submit", handleSignup);

        const resetForm = document.getElementById("resetForm");
        if (resetForm) resetForm.addEventListener("submit", handleResetPassword);

        // Apps Menu Load Sync
        document.addEventListener('appsMenuLoaded', () => {
            applyAppsMenuVisibility(auth.currentUser !== null);
        });

        // Global manual apps toggle listener
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#navAppsBtn');
            if (btn) {
                console.log("[Auth] Apps Button Clicked - Syncing State");
                applyAppsMenuVisibility(auth.currentUser !== null);
            }

            // Unified Logout Listener
            const logoutBtn = e.target.closest('#appsLogoutBtn, #appsLogoutBtnDash, #logoutBtn, .btn-logout');
            if (logoutBtn) {
                console.log("[Auth] Logout requested via:", logoutBtn.id || logoutBtn.className);
                window.handleLogout();
            }
        });
    });
}

initAuth();
