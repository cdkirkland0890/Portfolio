
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

// Open and close the mobile menu
menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    menuToggle.setAttribute(
        "aria-expanded",
        String(isOpen)
    );
});

// Close the menu after clicking a navigation link
navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    });
});

// Display the current year in the footer
document.getElementById("year").textContent =
    new Date().getFullYear();

// Appointment inquiry form
document.getElementById("bookingForm").addEventListener(
    "submit",
    event => {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        const subject = encodeURIComponent(
            "Tattoo Appointment Inquiry"
        );

        const body = encodeURIComponent(
            `Name: ${form.get("name")}\n` +
            `Email: ${form.get("email")}\n` +
            `Service: ${form.get("service")}\n\n` +
            `Details: ${form.get("details")}`
        );

        // Replace with the shop's confirmed email address
        window.location.href =
            `mailto:wyzeguyztat2@gmail.com?subject=${subject}&body=${body}`;
    }
);
