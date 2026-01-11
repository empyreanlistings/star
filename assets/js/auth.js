import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyArViUzMduVitt8FJDrSVPC_IQTeQrDFX4",
    authDomain: "kaiandisla-rulryn.firebaseapp.com",
    projectId: "kaiandisla-rulryn",
    storageBucket: "kaiandisla-rulryn.firebasestorage.app",
    messagingSenderId: "155934228174",
    appId: "1:155934228174:web:a4bcdc4b9702980c4e1a9f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let isLoggingOut = false;

const USER_CACHE_KEY = "kai_isla_user_profile";
const REMEMBER_KEY = "kai_isla_remember_me";

// Login Function
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("rememberMe")?.checked;
    const errorDiv = document.getElementById("loginError");

    // Handle Remember Me (Email only for security)
    if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }));
    } else {
        localStorage.removeItem(REMEMBER_KEY);
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Auth state listener handles redirect
    } catch (error) {
        console.error("Login Failed", error);
        if (errorDiv) {
            errorDiv.textContent = "Invalid email or password.";
            errorDiv.style.display = "block";
        }
    }
}

// Logout Function
async function handleLogout() {
    try {
        isLoggingOut = true;

        // Clear sensitive admin caches
        localStorage.removeItem("kai_isla_listings");
        localStorage.removeItem("kai_isla_gallery");
        localStorage.removeItem("kai_isla_palawan_gallery");
        localStorage.removeItem(USER_CACHE_KEY);
        // Let's keep theme but definitely clear the data.

        await signOut(auth);
        // Redirect handled in onAuthStateChanged
    } catch (error) {
        console.error("Logout Failed", error);
        isLoggingOut = false;
    }
}

// Monitor Auth State
function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname.toLowerCase();
        const isDashboard = document.body.classList.contains('dashboard-page');
        const isLogin = document.body.classList.contains('login-page') || path.includes("login");

        // Force body hide for dashboard until state is known
        if (isDashboard && !document.body.classList.contains('auth-verified')) {
            document.body.style.opacity = '0';
            document.body.style.pointerEvents = 'none';
        }

        if (user) {
            console.log("User logged in:", user.email);

            // 1. Handle Redirects & Static UI immediately
            if (isLogin) {
                window.location.replace("dashboard.html");
                return;
            }

            const userEmailEl = document.getElementById("userEmail");
            if (userEmailEl) userEmailEl.textContent = user.email;

            if (isDashboard) {
                document.body.classList.add('auth-verified');
                document.body.style.opacity = '1';
                document.body.style.pointerEvents = 'auto';
            }

            // 2. Avatar UI Logic
            const avatarLink = document.getElementById("navAvatarLink");
            const avatarImg = document.getElementById("navAvatarImg");
            const dashboardIcon = document.getElementById("navDashboardIcon");

            const updateAvatarUI = (url) => {
                if (!avatarLink) return;
                avatarLink.style.display = "inline-flex";
                if (url) {
                    if (avatarImg) {
                        avatarImg.src = url;
                        avatarImg.style.display = "block";
                        avatarImg.onerror = () => {
                            avatarImg.style.display = "none";
                            if (dashboardIcon) {
                                dashboardIcon.className = "fas fa-user-circle";
                                dashboardIcon.style.display = "block";
                            }
                        };
                    }
                    if (dashboardIcon) dashboardIcon.style.display = "none";
                } else {
                    if (avatarImg) avatarImg.style.display = "none";
                    if (dashboardIcon) {
                        dashboardIcon.className = "fas fa-user-circle";
                        dashboardIcon.style.display = "block";
                    }
                }
            };

            // 3. Render from Cache Instantly
            let currentProfileUrl = user.photoURL;
            const cachedUser = localStorage.getItem(USER_CACHE_KEY);
            if (cachedUser) {
                try {
                    const { photo_url, uid } = JSON.parse(cachedUser);
                    if (uid === user.uid && photo_url) {
                        currentProfileUrl = photo_url;
                        console.log("⚡ [Cache] Rendering instantly...");
                    }
                } catch (e) {
                    console.error("User cache parse error", e);
                }
            }
            updateAvatarUI(currentProfileUrl);

            // 4. Background Sync with Firestore (Non-blocking)
            (async () => {
                try {
                    const userDoc = await getDoc(doc(db, "Users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const remoteUrl = userData.photo_url || user.photoURL;

                        if (remoteUrl && remoteUrl !== currentProfileUrl) {
                            console.log("🔄 [Firestore] Updating avatar from remote...");
                            updateAvatarUI(remoteUrl);
                        }

                        // Always ensure cache is up to date if we have a remote URL
                        if (remoteUrl) {
                            localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                                photo_url: remoteUrl,
                                uid: user.uid,
                                timestamp: Date.now()
                            }));
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user avatar from Firestore:", err);
                }
            })();

        } else {
            console.log("User logged out");
            localStorage.removeItem(USER_CACHE_KEY);

            if (isLoggingOut) {
                window.location.replace("index.html");
                isLoggingOut = false;
                return;
            }

            if (isDashboard) {
                window.location.replace("login.html");
                return;
            }

            // Show dashboard icon, hide avatar on public site
            const avatarLink = document.getElementById("navAvatarLink");
            const avatarImg = document.getElementById("navAvatarImg");
            const dashboardIcon = document.getElementById("navDashboardIcon");
            if (avatarLink) {
                avatarLink.style.display = "inline-flex";
                if (avatarImg) avatarImg.style.display = "none";
                if (dashboardIcon) {
                    dashboardIcon.className = "fas fa-th-large"; // Reset to dashboard icon when logged out
                    dashboardIcon.style.display = "block";
                }
            }
        }
    });

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        // Pre-fill Remembered Email
        const remembered = localStorage.getItem(REMEMBER_KEY);
        if (remembered) {
            try {
                const { email } = JSON.parse(remembered);
                const emailInput = document.getElementById("email");
                const rememberCheckbox = document.getElementById("rememberMe");
                if (emailInput) emailInput.value = email;
                if (rememberCheckbox) rememberCheckbox.checked = true;
            } catch (e) {
                console.warn("Failed to parse remember cache", e);
            }
        }
        loginForm.addEventListener("submit", handleLogin);
    }

    // Use delegation or specific IDs for multiple logout buttons if they exist
    document.addEventListener('click', e => {
        if (e.target.closest('#logoutBtn') || e.target.closest('.btn-logout')) {
            handleLogout();
        }
    });
}

initAuth();
