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
        const isClientDashboard = document.body.classList.contains('client-dashboard-page') || path.includes("clientdashboard");
        const isLogin = document.body.classList.contains('login-page') || path.includes("login");
        const isProfile = document.body.classList.contains('profile-page') || path.includes("profile");

        // Force body hide for dashboards until state is known
        if ((isDashboard || isClientDashboard) && !document.body.classList.contains('auth-verified')) {
            document.body.style.opacity = '0';
            document.body.style.pointerEvents = 'none';
        }

        if (user) {
            console.log("User logged in:", user.email);

            // 1. Static UI immediately
            const userEmailEl = document.getElementById("userEmail");
            if (userEmailEl) userEmailEl.textContent = user.email;

            if (isDashboard || isClientDashboard) {
                // We'll show body after role check
            }

            // 2. Avatar UI Logic
            const updateAvatarUI = (url) => {
                const avatarLink = document.getElementById("navAvatarLink");
                const avatarImg = document.getElementById("navAvatarImg");
                const profileIcon = document.getElementById("navDashboardIcon");

                if (!avatarLink) return;

                // Rule: On profile page, do not show avatar in header
                if (isProfile) {
                    avatarLink.style.display = "none";
                    return;
                }

                avatarLink.style.display = "inline-flex";
                avatarLink.href = "profile.html";

                if (url) {
                    if (avatarImg) {
                        avatarImg.src = url;
                        avatarImg.style.display = "block";
                        avatarImg.onerror = () => {
                            avatarImg.style.display = "none";
                            if (profileIcon) {
                                profileIcon.className = "fas fa-user-circle";
                                profileIcon.style.display = "block";
                            }
                        };
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

            // 3. Render from Cache Instantly
            let currentProfileUrl = user.photoURL;
            let currentRole = 'user';
            const cachedUser = localStorage.getItem(USER_CACHE_KEY);
            if (cachedUser) {
                try {
                    const { photo_url, uid, role } = JSON.parse(cachedUser);
                    if (uid === user.uid) {
                        if (photo_url) currentProfileUrl = photo_url;
                        if (role) currentRole = role;
                        console.log(`⚡ [Cache] Rendering instantly... (Role: ${currentRole})`);
                    }
                } catch (e) {
                    console.error("User cache parse error", e);
                }
            }
            updateAvatarUI(currentProfileUrl);

            // Initial Dashboard visibility from cache or default
            if (dashLink) {
                if (isProfile) {
                    dashLink.style.display = "none";
                } else {
                    dashLink.style.display = "inline-flex";
                    // Update dashLink destination based on cached role if available
                    if (cachedUser) {
                        try {
                            const { role } = JSON.parse(cachedUser);
                            dashLink.href = role === "owner" ? "clientdashboard.html" : "dashboard.html";
                        } catch (e) { }
                    }
                }
            }

            // 4. Background Sync with Firestore (Non-blocking)
            (async () => {
                try {
                    const userDoc = await getDoc(doc(db, "Users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const remoteUrl = userData.photo_url || user.photoURL;
                        const role = userData.role || 'user';
                        const displayName = userData.display_name || user.displayName || '';
                        const phoneNumber = userData.phone_number || '';

                        if (remoteUrl && remoteUrl !== currentProfileUrl) {
                            console.log("🔄 [Firestore] Updating avatar from remote...");
                            updateAvatarUI(remoteUrl);
                        }

                        // Always ensure cache is up to date with full profile
                        localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
                            photo_url: remoteUrl,
                            uid: user.uid,
                            role: role,
                            display_name: displayName,
                            phone_number: phoneNumber,
                            timestamp: Date.now()
                        }));

                        // 5. Intelligent Redirection & Protection
                        if (isLogin) {
                            if (role === "admin") window.location.replace("dashboard.html");
                            else if (role === "owner") window.location.replace("clientdashboard.html");
                            else window.location.replace("profile.html");
                            return;
                        }

                        if (isDashboard) {
                            if (role === "admin") {
                                document.body.classList.add('auth-verified');
                                document.body.style.opacity = '1';
                                document.body.style.pointerEvents = 'auto';
                            } else {
                                // Not admin, but on admin dashboard
                                window.location.replace(role === "owner" ? "clientdashboard.html" : "profile.html");
                            }
                        }

                        if (isClientDashboard) {
                            if (role === "owner" || role === "admin") { // Allow admin to see client dash too
                                document.body.classList.add('auth-verified');
                                document.body.style.opacity = '1';
                                document.body.style.pointerEvents = 'auto';
                            } else {
                                window.location.replace("profile.html");
                            }
                        }

                        // Update dashLink again if profile synced
                        const dashLink = document.getElementById("navDashboardLink");
                        if (dashLink && !isProfile) {
                            dashLink.href = role === "owner" ? "clientdashboard.html" : "dashboard.html";
                        }
                    } else {
                        // User exists in Auth but not in Firestore -> Profile page for setup
                        if (isDashboard || isClientDashboard) window.location.replace("profile.html");
                        if (isLogin) window.location.replace("profile.html");
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

            if (isDashboard || isClientDashboard) {
                window.location.replace("login.html");
                return;
            }

            // Reset Nav on Logout 
            const dashLink = document.getElementById("navDashboardLink");
            const avatarLink = document.getElementById("navAvatarLink");
            const avatarImg = document.getElementById("navAvatarImg");
            const profileIcon = document.getElementById("navDashboardIcon");

            if (dashLink) {
                dashLink.style.display = "inline-flex"; // Show as login entry
                dashLink.href = "dashboard.html";
            }
            if (avatarLink) {
                avatarLink.style.display = "none"; // Hide avatar when out
            }
            if (avatarImg) avatarImg.style.display = "none";
            if (profileIcon) profileIcon.style.display = "none";
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
