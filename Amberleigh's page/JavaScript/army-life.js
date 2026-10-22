const gallery = document.querySelector(".gallery-grid");
const lightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const closeButton = document.querySelector(".lightbox-close");

gallery.addEventListener("click", (event) => {
    const button = event.target.closest(".gallery-item");
    if (!button) return;

    const image = button.querySelector("img");
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxImage.style.objectFit = "contain";
    lightboxImage.style.objectPosition = button.matches(".gallery-item:first-child")
        ? "center top"
        : "center";
    lightbox.showModal();
    closeButton.focus();
});

closeButton.addEventListener("click", () => {
    lightbox.close();
});

lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
        lightbox.close();
    }
});
