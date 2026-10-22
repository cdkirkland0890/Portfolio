const gallery = document.querySelector(".gallery-grid");
const lightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const closeButton = document.querySelector(".lightbox-close");
const lightboxRating = document.getElementById("lightboxRating");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxBlurb = document.getElementById("lightboxBlurb");

if (gallery) {
    gallery.addEventListener("click", (event) => {
        const button = event.target.closest(".gallery-item");
        if (!button || !lightbox || !lightboxImage) return;

        const image = button.querySelector("img");
        if (!image) return;

        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxImage.style.objectFit = "contain";
        lightboxImage.style.objectPosition = button.matches(".gallery-item:first-child")
            ? "center top"
            : "center";

        const reviewContent = button.querySelector(".review-content");
        if (reviewContent && lightboxRating && lightboxTitle && lightboxBlurb) {
            lightboxRating.textContent = reviewContent.querySelector(".review-rating")?.textContent ?? "";
            lightboxTitle.textContent = reviewContent.querySelector("h2")?.textContent ?? "";
            lightboxBlurb.textContent = reviewContent.querySelector(".review-full")?.textContent
                ?? reviewContent.querySelector(".review-blurb")?.textContent
                ?? "";
        }

        lightbox.showModal();
        if (closeButton) {
            closeButton.focus();
        }
    });
}

if (closeButton && lightbox) {
    closeButton.addEventListener("click", () => {
        lightbox.close();
    });
}

if (lightbox) {
    lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) {
            lightbox.close();
        }
    });
}
