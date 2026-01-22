import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
            errorDiv.textContent = error.message.includes("auth/") ? "Invalid email or password." : error.message;
            errorDiv.style.display = "block";
        }
    }
}

// Signup Function
async function handleSignup(e) {
    e.preventDefault();
    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const avatarFile = document.getElementById("avatarUpload")?.files[0];
    const errorDiv = document.getElementById("signupError");
    const successDiv = document.getElementById("signupSuccess");

    if (password !== confirmPassword) {
        errorDiv.textContent = "Passwords do not match.";
        errorDiv.style.display = "block";
        return;
    }

    try {
        errorDiv.style.display = "none";
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let photoURL = "";
        if (avatarFile) {
            const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${avatarFile.name}`);
            const snapshot = await uploadBytes(storageRef, avatarFile);
            photoURL = await getDownloadURL(snapshot.ref);
        }

        // Update Auth Profile
        await updateProfile(user, {
            displayName: fullName,
            photoURL: photoURL
        });

        // Create Firestore User Doc
        await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            email: email,
            display_name: fullName,
            photo_url: photoURL,
            role: "user", // Default role
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
        });

        if (successDiv) {
            successDiv.textContent = "Account created successfully! Redirecting...";
            successDiv.style.display = "block";
        }

        setTimeout(() => window.location.replace("profile.html"), 1500);

    } catch (error) {
        console.error("Signup Failed", error);
        if (errorDiv) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = "block";
        }
    }
}

// Reset Password Function
async function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const errorDiv = document.getElementById("resetError");
    const successDiv = document.getElementById("resetSuccess");

    try {
        errorDiv.style.display = "none";
        await sendPasswordResetEmail(auth, email);
        if (successDiv) {
            successDiv.textContent = "Reset link sent! Please check your email.";
            successDiv.style.display = "block";
        }
    } catch (error) {
        console.error("Reset Failed", error);
        if (errorDiv) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = "block";
        }
    }
}

// Logout Function
async function handleLogout() {
    try {
        isLoggingOut = true;

        // Clear sensitive admin caches
        localStorage.removeItem("star_listings");
        localStorage.removeItem("star_gallery");
        localStorage.removeItem("star_palawan_gallery");
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
    const path = window.location.pathname.toLowerCase();
    const isDashboard = document.body.classList.contains('dashboard-page') || path.includes("dashboard.html") && !path.includes("clientdashboard");
    const isClientDashboard = document.body.classList.contains('client-dashboard-page') || path.includes("clientdashboard");
    const isLogin = document.body.classList.contains('login-page') || path.includes("login");
    const isProfile = document.body.classList.contains('profile-page') || path.includes("profile");

    // --- IMMEDIATE PRE-FLIGHT PROTECTION ---
    // If we're on a protected page, hide the body instantly before Firebase even initializes
    if (isDashboard || isClientDashboard || isProfile) {
        document.body.style.opacity = '0';
        document.body.style.transition = 'none';

        // Fast redirection check using cached role
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (cachedUser) {
            try {
                const { role } = JSON.parse(cachedUser);
                if (isDashboard && role !== "admin") {
                    window.location.replace(role === "owner" ? "clientdashboard.html" : "profile.html");
                } else if (isClientDashboard && role !== "owner" && role !== "admin") {
                    window.location.replace("profile.html");
                }
            } catch (e) { }
        } else {
            // No cached user but on a protected page? This is likely a direct link access.
            // We keep body hidden and wait for onAuthStateChanged to bounce if not logged in.
        }
    }

    // --- FOOTER & NAV AUTH UI SYNC ---
    const updateFooterAuthUI = (isLoggedIn) => {
        const footerBtn = document.getElementById("footerSignInBtn");
        if (footerBtn) {
            if (isLoggedIn) {
                footerBtn.textContent = "SIGN-OUT";
                footerBtn.href = "#"; // Handled by listener
                footerBtn.onclick = (e) => {
                    e.preventDefault();
                    handleLogout();
                };
            } else {
                footerBtn.textContent = "SIGN-IN";
                footerBtn.href = "dashboard.html";
                footerBtn.onclick = null;
            }
        }
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User logged in:", user.email);
            updateFooterAuthUI(true);

            // 1. Static UI immediately
            const userEmailEl = document.getElementById("userEmail");
            if (userEmailEl) userEmailEl.textContent = user.email;

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
                        // Removed delayed fade-in logic for instant cache rendering
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

                // Show/Hide Apps Button
                const appsBtn = document.getElementById("navAppsBtn");
                if (appsBtn) {
                    appsBtn.style.display = "flex";
                }

                // Show Core Apps & Logout in Apps Menu
                const coreApps = document.querySelectorAll(".apps-core-section");
                const coreDividers = document.querySelectorAll(".apps-core-divider");
                const logoutBtns = document.querySelectorAll(".apps-footer");

                coreApps.forEach(el => el.classList.add("show-auth"));
                coreDividers.forEach(el => el.classList.add("show-auth"));
                logoutBtns.forEach(el => el.classList.add("show-auth"));
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
                    }
                } catch (e) { }
            }
            // Render Cache Role immediately
            const userRoleEl = document.getElementById("userRole");
            if (userRoleEl) userRoleEl.textContent = currentRole;

            updateAvatarUI(currentProfileUrl);

            // Initial Dashboard visibility from cache or default
            const dashLink = document.getElementById("navDashboardLink");
            const navSignInLink = document.getElementById("navSignInLink");
            const navSignInMobile = document.querySelector(".navSignInLinkMobile");

            if (navSignInLink) navSignInLink.style.display = "none";
            if (navSignInMobile) navSignInMobile.style.display = "none";

            if (dashLink) {
                if (isProfile) {
                    dashLink.style.display = "none";
                } else {
                    dashLink.style.display = "inline-flex";
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
                            updateAvatarUI(remoteUrl);
                        }

                        // Update Role in Header
                        const userRoleEl = document.getElementById("userRole");
                        if (userRoleEl) userRoleEl.textContent = role;

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
                                window.location.replace(role === "owner" ? "clientdashboard.html" : "profile.html");
                                return;
                            }
                        }

                        if (isClientDashboard) {
                            if (role === "owner" || role === "admin") {
                                document.body.classList.add('auth-verified');
                                document.body.style.opacity = '1';
                                document.body.style.pointerEvents = 'auto';
                            } else {
                                window.location.replace("profile.html");
                                return;
                            }
                        }

                        if (isProfile) {
                            document.body.classList.add('auth-verified');
                            document.body.style.opacity = '1';
                            document.body.style.pointerEvents = 'auto';
                        }

                        // Update dashLink again if profile synced
                        const dashLink = document.getElementById("navDashboardLink");
                        if (dashLink && !isProfile) {
                            dashLink.href = role === "owner" ? "clientdashboard.html" : "dashboard.html";
                        }
                    } else {
                        // User exists in Auth but not in Firestore
                        if (isDashboard || isClientDashboard) {
                            window.location.replace("profile.html");
                        } else {
                            // On profile page, show it so they can set up
                            document.body.classList.add('auth-verified');
                            document.body.style.opacity = '1';
                            document.body.style.pointerEvents = 'auto';
                        }
                    }
                } catch (err) {
                    console.error("Auth sync error:", err);
                }
            })();

        } else {
            console.log("User logged out");
            localStorage.removeItem(USER_CACHE_KEY);
            updateFooterAuthUI(false);

            // Show Core Apps & Logout in Apps Menu
            const coreApps = document.querySelectorAll(".apps-core-section");
            const coreDividers = document.querySelectorAll(".apps-core-divider");
            const logoutBtns = document.querySelectorAll(".apps-footer");

            coreApps.forEach(el => el.classList.remove("show-auth"));
            coreDividers.forEach(el => el.classList.remove("show-auth"));
            logoutBtns.forEach(el => el.classList.remove("show-auth"));

            if (isLoggingOut) {
                window.location.replace("index.html");
                isLoggingOut = false;
                return;
            }

            if (isDashboard || isClientDashboard || isProfile) {
                window.location.replace("login.html");
                return;
            }

            // Reset Nav on Logout 
            const dashLink = document.getElementById("navDashboardLink");
            const avatarLink = document.getElementById("navAvatarLink");
            const navSignInLink = document.getElementById("navSignInLink");
            const navSignInMobile = document.querySelector(".navSignInLinkMobile");

            if (navSignInLink) navSignInLink.style.display = "inline-flex";
            if (navSignInMobile) navSignInMobile.style.display = "block";

            if (dashLink) {
                dashLink.style.display = "none";
            }
            if (avatarLink) avatarLink.style.display = "none";

            // Keep Apps button visible (so they can access Theme/Services)
            const appsBtn = document.getElementById("navAppsBtn");
            if (appsBtn) appsBtn.style.display = "flex";
        }
    });

    // Globals for external access
    window.logoutUser = handleLogout;

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

    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        signupForm.addEventListener("submit", handleSignup);
    }

    const resetForm = document.getElementById("resetForm");
    if (resetForm) {
        resetForm.addEventListener("submit", handleResetPassword);
    }

    // Use delegation or specific IDs for multiple logout buttons if they exist
    document.addEventListener('click', e => {
        if (e.target.closest('#logoutBtn') || e.target.closest('.icon-button-default .fa-sign-out-alt') || e.target.closest('.icon-button-default i.fa-sign-out-alt')) {
            handleLogout();
        }
    });
}

initAuth();
