const subscribeForm = document.getElementById("subscribeForm");
const subscribeStatus = document.getElementById("subscribeStatus");

if (subscribeForm && subscribeStatus) {
    subscribeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        subscribeStatus.textContent = "Thanks for your interest! A mailing-list service must be connected before subscriptions can be received.";
    });
}
