
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");
const themeToggle = document.getElementById("themeToggle");
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

// Mobile navigation
menuToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");

  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Close navigation" : "Open navigation"
  );
  menuToggle.textContent = isOpen ? "✕" : "☰";
});

// Close mobile menu after selecting a link
nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    menuToggle.textContent = "☰";
  });
});

// Light and dark mode
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");

  const isLight = document.body.classList.contains("light-mode");

  themeToggle.textContent = isLight ? "☾" : "☀";
  themeToggle.setAttribute(
    "aria-label",
    isLight ? "Switch to dark theme" : "Switch to light theme"
  );
});

// Automatically update the copyright year
document.getElementById("year").textContent =
  new Date().getFullYear();

// Fill in the fitness goal when a program is selected
document.querySelectorAll("[data-program]").forEach((link) => {
  link.addEventListener("click", () => {
    const selectedProgram = link.dataset.program;
    const goalSelect = document.getElementById("goal");

    const matchingOption = Array.from(goalSelect.options).find(
      (option) => option.textContent === selectedProgram
    );

    if (matchingOption) {
      goalSelect.value = matchingOption.value;
    } else if (selectedProgram === "Performance Training") {
      goalSelect.value = "Strength and Performance";
    }

    formStatus.textContent = "";
  });
});

// Frontend contact form validation
contactForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!contactForm.checkValidity()) {
    contactForm.reportValidity();
    return;
  }

  const formData = new FormData(contactForm);

  const name = formData.get("name").trim();

  formStatus.textContent =
    `Thanks, ${name}! Your information is valid. ` +
    "Connect a form backend to send your inquiry.";

  formStatus.style.color = "var(--accent)";
});
