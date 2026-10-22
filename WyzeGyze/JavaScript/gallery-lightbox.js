const lightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = lightbox.querySelector(".lightbox-close");

document.querySelectorAll(
    ".gallery-item, .testimonial-photo-trigger"
).forEach(item => {
    item.addEventListener("click", () => {
        const image = item.querySelector("img");
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt;
        lightbox.showModal();
    });
});

lightboxClose.addEventListener("click", () => {
    lightbox.close();
});

lightbox.addEventListener("click", event => {
    if (event.target === lightbox) {
        lightbox.close();
    }
});
