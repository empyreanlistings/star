import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// Login Function
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorDiv = document.getElementById("loginError");

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
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout Failed", error);
    }
}

// Monitor Auth State
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        const path = window.location.pathname.toLowerCase();
        const isDashboard = path.includes("dashboard");
        const isLogin = path.includes("login");

        // Force body hide for dashboard until state is known
        if (isDashboard && !document.body.classList.contains('auth-verified')) {
            document.body.style.opacity = '0';
            document.body.style.pointerEvents = 'none';
        }

        if (user) {
            console.log("User logged in:", user.email);
            if (isLogin) {
                window.location.href = "dashboard.html";
            }
            // Update UI for dashboard if needed here
            const userEmailEl = document.getElementById("userEmail");
            if (userEmailEl) userEmailEl.textContent = user.email;

            if (isDashboard) {
                document.body.classList.add('auth-verified');
                document.body.style.opacity = '1';
                document.body.style.pointerEvents = 'auto';
            }

            // Update UI for public site (index.html)
            const avatarLink = document.getElementById("navAvatarLink");
            const avatarImg = document.getElementById("navAvatarImg");
            const dashboardIcon = document.getElementById("navDashboardIcon");
            if (avatarLink) {
                avatarLink.style.display = "inline-flex";
                if (user.photoURL) {
                    if (avatarImg) {
                        avatarImg.src = user.photoURL;
                        avatarImg.style.display = "block";
                    }
                    if (dashboardIcon) dashboardIcon.style.display = "none";
                } else {
                    if (avatarImg) avatarImg.style.display = "none";
                    if (dashboardIcon) dashboardIcon.style.display = "block";
                }
            }

        } else {
            console.log("User logged out");
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
                if (dashboardIcon) dashboardIcon.style.display = "block";
            }
        }
    });

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
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
