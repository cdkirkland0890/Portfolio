const customerReviewStatus = document.getElementById("customerReviewStatus");
const customerReviewGrid = document.getElementById("customerReviewGrid");

function createReviewCard(review) {
    const card = document.createElement("article");
    card.className = "customer-review-card";

    const heading = document.createElement("div");
    heading.className = "customer-review-heading";

    const name = document.createElement("h4");
    name.textContent = review.name;

    const rating = document.createElement("p");
    rating.className = "customer-review-rating";
    rating.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} ${review.rating}/5`;
    rating.setAttribute("aria-label", `${review.rating} out of 5 stars`);
    heading.append(name, rating);

    const comments = document.createElement("p");
    comments.className = "customer-review-comments";
    comments.textContent = review.comments;

    const tattooDate = document.createElement("time");
    tattooDate.className = "customer-review-date";
    tattooDate.dateTime = review.tattooDate;
    const [year, month, day] = review.tattooDate.split("-").map(Number);
    tattooDate.textContent = `Tattoo date: ${new Date(year, month - 1, day).toLocaleDateString()}`;

    card.append(heading, comments, tattooDate);

    if (review.photoUrl) {
        const photo = document.createElement("img");
        photo.className = "customer-review-photo";
        photo.src = review.photoUrl;
        photo.alt = `Tattoo photo shared by ${review.name}`;
        photo.loading = "lazy";
        card.append(photo);
    }

    return card;
}

async function loadCustomerReviews() {
    try {
        const response = await fetch("/api/reviews", { headers: { Accept: "application/json" } });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "The review service returned an error.");
        }

        if (!Array.isArray(payload.reviews)) {
            throw new Error("The review service returned an invalid response.");
        }

        customerReviewGrid.replaceChildren(
            ...payload.reviews.map(createReviewCard)
        );
        customerReviewStatus.textContent = payload.reviews.length
            ? ""
            : "No customer reviews have been submitted yet.";
    } catch (error) {
        console.error("Could not load customer reviews:", error);
        customerReviewStatus.textContent =
            "Could not load customer reviews. Start the local site with npm start and refresh this page.";
    }
}

loadCustomerReviews();
