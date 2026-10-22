const reviewForm = document.getElementById("reviewForm");
const reviewPhoto = document.getElementById("reviewPhoto");
const reviewPhotoPreview = document.getElementById("reviewPhotoPreview");
const reviewStatus = document.getElementById("reviewStatus");
const tattooDateInput = document.getElementById("tattooDate");
let reviewPhotoPreviewUrl = "";

function setReviewStatus(message, linkHref) {
    reviewStatus.replaceChildren(document.createTextNode(message));
    if (linkHref) {
        const link = document.createElement("a");
        link.href = linkHref;
        link.textContent = " View the review on the homepage.";
        reviewStatus.append(link);
    }
}

function clearPhotoPreview() {
    reviewPhotoPreview.hidden = true;
    reviewPhotoPreview.removeAttribute("src");
    if (reviewPhotoPreviewUrl) {
        URL.revokeObjectURL(reviewPhotoPreviewUrl);
        reviewPhotoPreviewUrl = "";
    }
}

function readPhotoAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("The selected photo could not be read."));
            }
        });
        reader.addEventListener("error", () => {
            reject(reader.error || new Error("The selected photo could not be read."));
        });
        reader.readAsDataURL(file);
    });
}

const now = new Date();
tattooDateInput.max = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
].join("-");

reviewPhoto.addEventListener("change", () => {
    const [file] = reviewPhoto.files;

    clearPhotoPreview();
    setReviewStatus("");
    if (!file) {
        return;
    }

    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supportedTypes.includes(file.type)) {
        reviewPhoto.value = "";
        setReviewStatus("Choose a JPEG, PNG, GIF, or WebP image.");
        return;
    }
    if (file.size > 4 * 1024 * 1024) {
        reviewPhoto.value = "";
        setReviewStatus("Photo must be no larger than 4 MB.");
        return;
    }

    reviewPhotoPreviewUrl = URL.createObjectURL(file);
    reviewPhotoPreview.src = reviewPhotoPreviewUrl;
    reviewPhotoPreview.hidden = false;
});

reviewForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submitButton = reviewForm.querySelector('button[type="submit"]');
    const photo = reviewPhoto.files[0];
    submitButton.disabled = true;
    setReviewStatus("Submitting your review...");

    try {
        const formData = new FormData(reviewForm);
        const payload = {
            name: formData.get("name"),
            tattooDate: formData.get("tattooDate"),
            comments: formData.get("comments"),
            rating: Number(formData.get("rating")),
            consent: formData.get("consent") === "on",
            photo: photo ? await readPhotoAsDataUrl(photo) : null
        };
        const response = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "The review could not be submitted.");
        }

        reviewForm.reset();
        clearPhotoPreview();
        setReviewStatus(
            "Your review was saved and is now visible on the local homepage.",
            "../index.html#testimonials"
        );
    } catch (error) {
        console.error("Could not submit review:", error);
        setReviewStatus(
            error.message || "Could not submit your review. Make sure the local server is running."
        );
    } finally {
        submitButton.disabled = false;
    }
});
