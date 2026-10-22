const testimonialSlides = [
    ...document.querySelectorAll(".testimonial-slide")
];
const testimonialPosition = document.querySelector(
    ".testimonial-position"
);
const testimonialControls = document.querySelectorAll(
    ".testimonial-control"
);
let activeTestimonial = 0;

function showTestimonial(index) {
    activeTestimonial =
        (index + testimonialSlides.length) % testimonialSlides.length;

    testimonialSlides.forEach((slide, slideIndex) => {
        slide.hidden = slideIndex !== activeTestimonial;
    });

    testimonialPosition.textContent =
        `${activeTestimonial + 1} / ${testimonialSlides.length}`;
}

testimonialControls.forEach(control => {
    control.addEventListener("click", () => {
        showTestimonial(
            activeTestimonial + Number(control.dataset.direction)
        );
    });
});
