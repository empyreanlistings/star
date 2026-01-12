/**
 * Global Snackbar Utility for Kai & Isla
 * 
 * Usage: 
 * showSnackbar("Message", "success");
 * showSnackbar("Something went wrong", "error");
 * showSnackbar("Tip: You can edit your profile", "info");
 * showSnackbar("Warning: Unsaved changes", "warning");
 */

function showSnackbar(message, type = 'info', duration = 1500) {
    let container = document.getElementById('snackbar-container');

    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'snackbar-container';
        container.className = 'snackbar-container';
        document.body.appendChild(container);
    }

    // Create snackbar element
    const snackbar = document.createElement('div');
    snackbar.className = `snackbar ${type}`;

    // Add content and close button
    snackbar.innerHTML = `
        <div class="snackbar-content">${message}</div>
        <button class="snackbar-close" aria-label="Close" title="Close">&times;</button>
    `;

    // Append to container (prefixed for top-down list appearance)
    container.appendChild(snackbar);

    // Auto-remove after duration
    const removeTimer = setTimeout(() => {
        removeSnackbar(snackbar);
    }, duration);

    // Manual close button
    const closeBtn = snackbar.querySelector('.snackbar-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearTimeout(removeTimer);
        removeSnackbar(snackbar);
    });

    /**
     * Internal removal logic with fade-out animation
     */
    function removeSnackbar(el) {
        if (!el.parentNode) return; // Already removed

        el.classList.add('fade-out');

        // Wait for CSS transition to finish before removing from DOM
        el.addEventListener('transitionend', () => {
            if (el.parentNode) {
                el.remove();
            }
        }, { once: true });

        // Fallback for browsers that don't trigger transitionend
        setTimeout(() => {
            if (el.parentNode) {
                el.remove();
            }
        }, 500);
    }
}

// Make globally accessible
window.showSnackbar = showSnackbar;
