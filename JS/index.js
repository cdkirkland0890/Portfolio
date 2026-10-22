
/* =========================================
   1. DARK / LIGHT THEME
========================================= */

const root = document.documentElement;
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
    root.dataset.theme = theme;

    const isDark = theme === "dark";

    themeIcon.textContent = isDark ? "☀" : "☾";

    themeToggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
    );

    themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";

    themeMeta.setAttribute(
        "content",
        isDark ? "#191916" : "#f5f2eb"
    );
}

// Restore saved preference; otherwise use the system preference.
let savedTheme = null;

try {
    savedTheme = localStorage.getItem("portfolio-theme");
} catch (error) {
    // The page still works if browser storage is unavailable.
}

const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
).matches;

applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));

themeToggle.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);

    try {
        localStorage.setItem("portfolio-theme", nextTheme);
    } catch (error) {
        // Theme changes still work for the current page session.
    }
});


/* =========================================
   2. MOBILE NAVIGATION
========================================= */

const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

function closeMenu() {
    menuToggle.classList.remove("open");
    navLinks.classList.remove("open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
}

menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    menuToggle.classList.toggle("open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close menu" : "Open menu"
    );
});

navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMenu();
    }
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 720) {
        closeMenu();
    }
});


/* =========================================
   3. COPYRIGHT YEAR
========================================= */

document.getElementById("current-year").textContent =
    new Date().getFullYear();


/* =========================================
   4. REVEAL SECTIONS ON SCROLL
========================================= */

const revealItems = document.querySelectorAll(
    ".project, .service-row, .about-copy, " +
    ".about-image, .section-heading, .contact-copy, .contact-form"
);

const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
).matches;

if ("IntersectionObserver" in window && !reduceMotion) {
    document.body.classList.add("reveal-ready");

    revealItems.forEach((item) => item.classList.add("reveal"));

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12 }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
}


/* =========================================
   5. CONTACT FORM
   Requires a configured Formspree endpoint.
========================================= */

const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const submitButton = contactForm.querySelector('button[type="submit"]');
const submitText = document.getElementById("submit-text");

contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Run the browser's required-field and format checks.
    if (!contactForm.reportValidity()) {
        return;
    }

    const endpoint = contactForm.getAttribute("action");

    // Avoid pretending the form works before setup is complete.
    if (!endpoint || endpoint.includes("YOUR_FORM_ID")) {
        formStatus.textContent =
            "The form is not connected yet. Please configure your Formspree endpoint.";
        formStatus.className = "form-status error";
        return;
    }

    // Basic spam trap.
    const honeypot = contactForm.querySelector('[name="_gotcha"]');

    if (honeypot && honeypot.value.trim() !== "") {
        formStatus.textContent =
            "Thank you. If your inquiry is valid, it will be reviewed.";
        formStatus.className = "form-status success";
        contactForm.reset();
        return;
    }

    submitButton.disabled = true;
    submitText.textContent = "Sending inquiry...";
    formStatus.textContent = "";
    formStatus.className = "form-status";

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            body: new FormData(contactForm),
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("The form service returned an error.");
        }

        formStatus.textContent =
            "Thank you for reaching out. Your inquiry was sent successfully.";
        formStatus.className = "form-status success";

        contactForm.reset();
    } catch (error) {
        formStatus.textContent =
            "We couldn't send your inquiry. Please try again or email us directly.";
        formStatus.className = "form-status error";
    } finally {
        submitButton.disabled = false;
        submitText.textContent = "Send project inquiry ↗";
    }
});
