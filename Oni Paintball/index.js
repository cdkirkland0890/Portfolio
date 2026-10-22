
/* =========================================
   AUSTIN ONI PAINTBALL
   Interactive functionality
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const navItems = navLinks.querySelectorAll("a");
  const year = document.getElementById("year");

  // Automatically update the copyright year.
  year.textContent = new Date().getFullYear();

  // Mobile navigation.
  function closeMenu() {
    navLinks.classList.remove("open");
    menuToggle.classList.remove("active");
    document.body.classList.remove("menu-open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
  }

  function openMenu() {
    navLinks.classList.add("open");
    menuToggle.classList.add("active");
    document.body.classList.add("menu-open");

    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation menu");
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.contains("open");

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close the mobile menu after selecting a section.
  navItems.forEach((item) => {
    item.addEventListener("click", closeMenu);
  });

  // About section photo carousel.
  const carousel = document.getElementById("aboutCarousel");
  const carouselImage = carousel.querySelector(".carousel-image");
  const carouselStatus = carousel.querySelector(".carousel-status");
  const carouselIndicators = Array.from(
    carousel.querySelectorAll("[data-carousel-slide]")
  );
  const carouselPhotos = [
    {
      src: "assets/carousell1.jpg",
      alt: "Austin Oni players competing on the paintball field"
    },
    {
      src: "assets/carousell2.jpg",
      alt: "Austin Oni players advancing across the paintball field"
    },
    {
      src: "assets/carousell3.jpg",
      alt: "Austin Oni player aiming during a paintball match"
    }
  ];
  let activePhoto = 0;

  function showPhoto(index) {
    activePhoto = (index + carouselPhotos.length) % carouselPhotos.length;
    const photo = carouselPhotos[activePhoto];

    carouselImage.src = photo.src;
    carouselImage.alt = photo.alt;
    carouselStatus.textContent = `${activePhoto + 1} / ${carouselPhotos.length}`;

    carouselIndicators.forEach((indicator, indicatorIndex) => {
      const isActive = indicatorIndex === activePhoto;
      indicator.classList.toggle("active", isActive);

      if (isActive) {
        indicator.setAttribute("aria-current", "true");
      } else {
        indicator.removeAttribute("aria-current");
      }
    });
  }

  carousel.querySelector("[data-carousel-previous]").addEventListener("click", () => {
    showPhoto(activePhoto - 1);
  });

  carousel.querySelector("[data-carousel-next]").addEventListener("click", () => {
    showPhoto(activePhoto + 1);
  });

  carouselIndicators.forEach((indicator) => {
    indicator.addEventListener("click", () => {
      showPhoto(Number(indicator.dataset.carouselSlide));
    });
  });

  // Close the menu with Escape.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  // Scroll reveal animations.
  const revealElements = document.querySelectorAll(".reveal");

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if ("IntersectionObserver" in window && !reducedMotion) {
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            currentObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -35px 0px"
      }
    );

    revealElements.forEach((element) => {
      observer.observe(element);
    });
  } else {
    revealElements.forEach((element) => {
      element.classList.add("visible");
    });
  }

  // If the viewport changes from mobile to desktop,
  // ensure the mobile menu does not remain open.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 780) {
      closeMenu();
    }
  });
});
