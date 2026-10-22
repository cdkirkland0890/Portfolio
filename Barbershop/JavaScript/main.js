// ---- DOM Elements ----

const yearEl = document.getElementById('year');
const menuBtn = document.getElementById('menuBtn');
const siteHeader = document.querySelector('.site-header');
const nav = document.getElementById('nav');
const mobileMenu = document.getElementById('mobileMenu');
const ctaBtn = document.getElementById('ctaBtn');
const callBtn = document.getElementById('callBtn');
const phoneLink = document.getElementById('phoneLink');
const emailLink = document.getElementById('emailLink');
const heading = document.getElementById('heroHeading');
const featureGrid = document.getElementById('featureGrid');
const hoursList = document.getElementById('hoursList');
// add new dom elements
const heroSubtext = document.getElementById('heroSubtext');
const ctaText = document.getElementById('ctaText');


// ---- Services Data (Array of Objects)
const services = [
    {
        id: 1,
        title: "Classic Haircut",
        image: "Assets/Images/feature-1.jpg",
        description: "Timeless cuts with modern precision tailored to your style.",
        price: 25,        
        details: [
            "Consultation with your barber before the cut beings.",
            "Hair sectioning and shape-up based on your preferred style.",
            "Professional clippers, trimmers, and shears used for precision.",
            "Neckline cleanup and finishing touches included.",
            "Light styling product applied for a clean final look.",
    ],   
    },
    {    
        id: 2,
        title: "Beard Trim",
        image: "Assets/Images/feature-4.jpeg",
        alt: "Beard Trim",
        description: "Shape, line-up, and refine your beard for a clean finish.",
        price: 20,
        popular: false,
        details:[
            "Bear assessment and shaping based on face structure.",
            "Line-up around cheeks, jawline, and neckline.",
            "Trimmers and detail tools used for crisp edges.",
            "Conditioning beard product may be applied for softness.",
            "Final symmetry check for a polished finish.",
        ],
},
    {
        id: 3,
        title: "Straight Razor Shave",
        image: "Assets/Images/feature-3.jpg",
        alt: "Straight Razor Shave",
        description: "Hot towel, smooth shave, and classic barbershop experience.",
        price: 30,
        popular: true,
        details: [
            "Hot towel prep to soften facial hair and open pores.",
            "Premium shaving cream or leatcher applied to protect the skin.",
            "Straight razor shave preformed with careful detailing.",
            "Second hot towl may be used for comfrot cleanup.",
        ],
    },
    {
        id: 4,
        title: "Fade & Style",
        image: "Assets/Images/feature-2.jpg",
        alt: "Fade haircut",
        description: "A clean fade with finishing detail for a sharp, modern, look.",
        price: 35,
        popular: false,
        details: [
            "Style consultation before clipper work begins.",
            "Fade blended to your preferred level and finish.",
            "Detailing around temples, neckline, and beard area if needed.",
            "Scissors and clipper-over-comb may be used for texture.",
            "Styling product added to copmlete the final look.",
        ],
    },
    {
        id: 5,
        title: "Kids Haircut",
        image: "Assets/Images/feature-1.jpg",
        alt: "Kids Haircut",
        description: "Gentle, patient, and fun haircut experience for kids.",
        price: 20,
        popular: false,
        details: [
            "Friendly consultation to understand the child's preferences.",
            "Gentle handling and patience throughout the haircut.",
            "Clippers and scissors used based on the desired style.",
            "Light cleanup around the neckline and ears.",
            "Styled neatly before leaving the char.",
        ],
    },
    {
        id: 6,
        title: "Head Shave",
        image: "Assets/Images/feature-4.jpeg",
        alt: "Head shave",
        description: "Smooth, clean head shave with care and precision.",
        price: 28,
        popular: true,
        details: [
            "Scalp assessment to ensure skin is healthy for shaving.",
            "Hot towel prep to soften hair and open pores.",
            "Close shave performed for a smooth finish.",
            "Scalp cleaned and checked for even consistency.",
            "Moisturizing product applied to soothe the skin post-shave.",
        ],
    },

];

//----Navigation Data (array of objects)
// add navigation section

const navLinks = [
    {label: "Home", href: "#hero"},
    {label: "Services", href: "#features"},
    {label: "Book", href: "#cta"},
    {label: "Contact", href: "#footer"},
];

//---Hours Data -----
//Add business hours
const businessHours = [
    { day: "Monday", open: 9, close: 19 },
    { day: "Tuesday", open: 9, close: 19 },
    { day: "Wednesday", open: 9, close: 19 },
    { day: "Thursday", open: 9, close: 19 },
    { day: "Friday", open: 9, close: 19 },
    { day: "Saturday", open: 10, close: 17 },
    { day: "Sunday", open: 0, close: 0 }
];

//----Modal Elements ----
//Add modal elements
const serviceModal = document.getElementById('serviceModal');
const serviceModalOverlay = document.getElementById('serviceModalOverlay');
const serviceModalClose = document.getElementById('serviceModalClose');
const serviceModalTitle = document.getElementById('serviceModalTitle');
const serviceModalPrice = document.getElementById('serviceModalPrice');
const serviceModalList = document.getElementById('serviceModalList');

//----Main Shop Object -----
const shopInfo = {
    name: "Vintage Barbershop",
    address: "123 Main St, Wahiawa, HI",
    phoneDisplay: "(808) 123-4567",
    phoneRaw: "8081234567",
    email: "hello@vintagebarbershop.com",
}

// ----- Open/Closed Logic -----
// Add open/closed Logic
const checkIfOpen = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

let schedule;
if (currentDay === 0) {
    schedule = businessHours[6];
} else {
    schedule = businessHours[currentDay -1];
}

if (schedule.open === 0 && schedule.close === 0) {
    updateSubtext("We are closed today. Book now for your next sharp look.");
    return;
}

if (currentHour >= schedule.open && currentHour < schedule.close) {
    updateSubtext ("We're open right now - walk-ins welcome, appointments recommended.");
} else {
    updateSubtext("We're currently closed, but you can still book your next appointment.");
}
};

//-----Modal Logic-----
//Add modal logic
const openServiceModal = (serviceId) => {
    if (
        !serviceModal ||
        !serviceModalTitle ||
        !serviceModalPrice ||
        !serviceModalList 
    )
    return;
    const selectedService = services.find(
        (service) => service.id === Number(serviceId),
    );
    if (!selectedService) return;
    serviceModalTitle.textContent = selectedService.title;
    serviceModalPrice.textContent = `$${selectedService.price}`;
    serviceModalList.innerHTML = selectedService.details
        .map((detail) => `<li>${detail}</li>`)
        .join("");
    serviceModal.classList.add("is-open");
    serviceModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
};
const closeServiceModal = () => {
    if (!serviceModal) return;
    serviceModal.classList.remove("is-open");
    serviceModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
};

//--Helpers / Functions ---
// Update footer year automatically
const setCurrentYear = () => {
  const now = new Date();
  if (yearEl) yearEl.textContent = now.getFullYear();
};

const formatHour = (hour) => {
    if (hour === 0) return "12am";
    if (hour === 12) return "12pm";
    if (hour > 12) return `${hour - 12}pm`;
    return `${hour}am`;
};

const renderBusinessHours = () => {
    if (!hoursList) return;
    hoursList.innerHTML = businessHours.map(({ day, open, close }) => {
        const hours = open === 0 && close === 0
            ? "Closed"
            : `${formatHour(open)} - ${formatHour(close)}`;
        return `<li>${day}: ${hours}</li>`;
    }).join("");
};

//Header Scroll
//And scroll handling for scroll effects

const handleHeaderOnScroll = () => {
    if (!siteHeader) return;
    if (window.scrollY > 10) {
        siteHeader.classList.add("is-scrolled");
    } else {
        siteHeader.classList.remove("is-scrolled");
    }
};
// Toggle mobile menu open/close
let isMenuOpen = false;
const toggleMobileMenu = () => {
    if (!mobileMenu) return;
    if (isMenuOpen === false){
        mobileMenu.classList.add("is-open");
        isMenuOpen = true;
    } else {
        mobileMenu.classList.remove("is-open");
        isMenuOpen = false;
    }
};

// Close mobile menu (used when a link is clicked)
const closeMobileMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    isMenuOpen = false;
};

   
// Reusable function with parameters
const updateHeadingText = (newText) => {
    if (!heading) return;
    heading.textContent = newText;
};

const updateSubtext = (newText) => {
    if (!heroSubtext) return;
    heroSubtext.textContent = newText;
};

// ---- Event Listeners ----
// 1) set year on page load
setCurrentYear();

// 2) Hamburger menu toggle
if (menuBtn) {
    menuBtn.addEventListener("click", () => {
        toggleMobileMenu();
    });
}

// 3) Close mobile menu when a link is clicked
if (mobileMenu) {
    mobileMenu.addEventListener("click", (event) => {
        //if they clicked on <a> inside the menu, close it
        if (event.target.tagName === "A"){
            closeMobileMenu();
        }
    });
}

// 4) CTA Button: "Book now" (placeholder behavior)
if (ctaBtn) {
    ctaBtn.addEventListener("click", () => {
        const bookingSection = document.getElementById("cta");

        if (bookingSection) {
            bookingSection.scrollIntoView({behavior: "smooth" });
        }
        updateHeadingText("Choose your date and time below.");
    });
}

// 5) Call button

if (callBtn) {
    callBtn.addEventListener("click", () => {
        window.location.href = `tel:${shopInfo.phoneRaw}`;
    });
}

window.addEventListener("scroll", handleHeaderOnScroll);
handleHeaderOnScroll();

const renderFeatures = () => {
    if (!featureGrid) return;
    const servicesHTML = services.map((service) => {
        const badgeHTML = service.popular
            ? '<p class="service-badge">Popular Choice</p>'
            : '<p class="service-badge alt-badge">Barber Favorite</p>';
        return `
        <article class="feature-card">
            <img src="${service.image}" alt="${service.alt || service.title}" class="feature-img" />
            <h3 class="feature-title">${service.title}</h3>
            <p class="feature-text">${service.description}</p>
            ${badgeHTML}
            <p class="service-price">$${service.price}</p>
            <div class="service-action">
                <button class="service-details-btn" type="button" data-service-id="${service.id}">
                    View Details
                </button>
            </div>
        </article>`;
    })
        .join("");
    featureGrid.innerHTML = servicesHTML;
};

const renderNavigation = () => {
    //desktop view
    if (nav) {
        const navHTML = navLinks.map((link) => {
        return `<a href="${link.href}" class="nav-link"> ${link.label} </a>`;
    })
.join ("");
 nav.innerHTML = navHTML;
}

//Mobile Nav
 if (mobileMenu) {
 const mobileHTML = navLinks.map((link) => {
     return `<a href="${link.href}" class="mobile-link"> ${link.label} </a>`;
 })
 .join("");
 mobileMenu.innerHTML = mobileHTML;
 }
};
renderFeatures();
renderNavigation();
renderBusinessHours();
checkIfOpen();

if (featureGrid) {
    featureGrid.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const detailsButton = event.target.closest(".service-details-btn");
        if (!detailsButton) return;
        openServiceModal(detailsButton.dataset.serviceId);
    });
}

if (serviceModalClose) {
    serviceModalClose.addEventListener("click", closeServiceModal);
}

if (serviceModalOverlay) {
    serviceModalOverlay.addEventListener("click", closeServiceModal);
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && serviceModal?.classList.contains("is-open")) {
        closeServiceModal();
    }
});


//Add Contact Render
const renderContactInfo = () => {
    if(phoneLink) {
        phoneLink.textContent = shopInfo.phoneDisplay;
        phoneLink.href = `tel:${shopInfo.phoneRaw}`;
    }
    if (emailLink) {
        emailLink.textContent = shopInfo.email;
        emailLink.href = `mailto:${shopInfo.email}`;
    }
};
renderContactInfo();

// // Optional scroll shift effect
// const setupScrollShiftCards = () => {
//   if (!featureGrid) return;
//   let lastScrollY = window.scrollY;
//   let currentX = 0;
//   let ticking = false;
//   const getVisibleWidth = () => {
//     const parent = featureGrid.parentElement;
//     return parent ? parent.clientWidth : window.innerWidth;
//   };
//   const getMaxShift = () => {
//     return Math.max(0, featureGrid.scrollWidth - getVisibleWidth());
//   };
//   const updateCardTrack = () => {
//     const currentScrollY = window.scrollY;
//     const scrollDelta = currentScrollY - lastScrollY;
//     if (scrollDelta === 0) {
//       ticking = false;
//       return;
//     }
//     currentX -= scrollDelta * 0.5;
//     const maxShift = getMaxShift();
//     if (currentX < -maxShift) currentX = -maxShift;
//     if (currentX > 0) currentX = 0;
//     featureGrid.style.transform = `translateX(${currentX}px)`;
//     lastScrollY = currentScrollY;
//     ticking = false;
//   };
//   window.addEventListener("scroll", () => {
//     if (!ticking) {
//       window.requestAnimationFrame(updateCardTrack);
//       ticking = true;
//     }
//   });
//   window.addEventListener("resize", () => {
//     const maxShift = getMaxShift();
//     if (currentX < -maxShift) currentX = -maxShift;
//     if (currentX > 0) currentX = 0;
//     featureGrid.style.transform = `translateX(${currentX}px)`;
//   });
// };
 
// renderFeatures();
// renderNavigation();
// renderHours();
// checkIfOpen();
// renderContactInfo();