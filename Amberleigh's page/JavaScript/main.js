// ---- DOM Elements ----

const yearEl = document.getElementById('year');
const menuBtn = document.getElementById('menuBtn');
const siteHeader = document.querySelector('.site-header');
const nav = document.getElementById('nav');
const mobileMenu = document.getElementById('mobileMenu');
const ctaBtn = document.getElementById('ctaBtn');
const callBtn = document.getElementById('callBtn');
const phoneLink = document.getElementById('phoneLink');
const heading = document.getElementById('heroHeading');
const featureGrid = document.getElementById('featureGrid');
const favoriteImage = document.getElementById('favoriteImage');
const favoriteCaption = document.getElementById('favoriteCaption');
const favoriteDots = document.getElementById('favoriteDots');
const favoritePrevious = document.getElementById('favoritePrevious');
const favoriteNext = document.getElementById('favoriteNext');
const favoriteBooks = [
    { title: "Agatha Christie: The A.B.C. Murders", image: "images/favorites/abc.jpg" },
    { title: "Agatha Christie: And Then There Were None", image: "images/favorites/andthentherewerenone.jpg" },
    { title: "Rebecca Ross: A River Enchanted", image: "images/favorites/ariverenchanted.jpg" },
    { title: "Sara Confino: Don't Forget to Write", image: "images/favorites/dontforget.jpg" },
    { title: "Stacy McEwan: Forbidden Alchemy", image: "images/favorites/forbiddenalchemy.jpg" },
    { title: "Rick Riordan: The Lightning Thief", image: "images/favorites/lightning.jpg" }
];
let activeFavorite = 0;

const showFavorite = (index) => {
    if (!favoriteImage || !favoriteCaption || !favoriteDots) return;
    activeFavorite = (index + favoriteBooks.length) % favoriteBooks.length;
    const favorite = favoriteBooks[activeFavorite];
    favoriteImage.src = favorite.image;
    favoriteImage.alt = `Favorite book: ${favorite.title}`;
    favoriteCaption.textContent = favorite.title;
    favoriteDots.querySelectorAll("button").forEach((dot, dotIndex) => {
        const isActive = dotIndex === activeFavorite;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-pressed", String(isActive));
    });
};

if (favoriteDots) {
    favoriteBooks.forEach((favorite, index) => {
        const dot = document.createElement("button");
        dot.className = "carousel-dot";
        dot.type = "button";
        dot.setAttribute("aria-label", `Show ${favorite.title}`);
        dot.setAttribute("aria-pressed", String(index === activeFavorite));
        dot.addEventListener("click", () => showFavorite(index));
        favoriteDots.appendChild(dot);
    });
}

if (favoritePrevious) {
    favoritePrevious.addEventListener("click", () => showFavorite(activeFavorite - 1));
}

if (favoriteNext) {
    favoriteNext.addEventListener("click", () => showFavorite(activeFavorite + 1));
}
showFavorite(activeFavorite);

// ---- Services Data (Array of Objects)
const services = [
    {
        title: "My Library!",
        text: "A look at the books, stacks, and cozy reading moments I love.",
        image: "images/header_books.jpg",
        link: "my-library.html",
    },
    {
        title: "Army Life!",
        text: "A little look into our Army life.",
        image: "images/cor.jpg",
        link: "army-life.html",
    },
    {
        title: "Thrift Treasures!",
        text: "Discover hidden gems and unique finds from thrift stores.",
        image: "images/Thrift/comingsoon.png",
        link: "thrift.html",
    },
    {
        title: "Family Time!",
        text: "The sweet moments, adventures, and memories that matter most.",
        image: "images/boats.jpg",
        link: "family-time.html",
    },
    {
        title: "Book Reviews!",
        text: "Fresh reads, honest thoughts, and the books worth sharing.",
        image: "images/Reviews/reviewscover.png",
        link: "bookreviews.html",
    }
];

//----Navigation Data (array of objects)
// add navigation section

const navLinks = [
    {label: "Home", href: "#hero"},
    {label: "Albums", href: "#features"},
    {label: "Books", href: "#cta"},
    {label: "Subscribe", href: "subscribe.html"},
];

//--Helpers / Functions ---
// Update footer year automatically
const setCurrentYear = () => {
  const now = new Date();
  yearEl.textContent = now.getFullYear();
};

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


// 5) call button: try to use the phone number in the footer

if (callBtn){
    callBtn.addEventListener("click", () => {
        //If you later set phoneLink, href to tel:, this will work perfectly.
        //for now, this is a beinnger-friendly placeholder
        if (phoneLink) {
            updateHeadingText("Call us at " + phoneLink.textContent);
        } else {
            updateHeadingText("Call feature coming next!");
        }
    });
}

window.addEventListener("scroll", handleHeaderOnScroll);
handleHeaderOnScroll();

//Render Features using forEach
//Add render features function
const renderFeatures = () => {
    if (!featureGrid) return;
    services.forEach((service) => {
        const card = document.createElement("article");
        card.classList.add("feature-card");
        card.innerHTML = `<img src="${service.image}" alt="${service.title}" class="feature-img" />
        <h3 class="feature-title">${service.title}</h3>
        <p class="feature-text">${service.text}</p>
        ${service.link ? `<a class="btn btn-primary feature-link" href="${service.link}">View ${service.title}</a>` : ""}`;
        featureGrid.appendChild(card);
    });
}

//render features with map() (teaching)

const renderFeaturesMap = () => {
    const cardHTML = services.map((service) => {
        return `
        <article class="feature-card">
            <img src="${service.image}" alt="${service.title}" class="feature-img" />
            <h3 class="feature-title">${service.title}</h3>
            <p class="feature-text">${service.text}</p>
            </article>`;
    })
            .join(""); //Join the array of strings into a single string
            featureGrid.innerHTML = cardHTML;
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
    renderFeatures(); //call feature render
    renderNavigation(); //call navigation render
