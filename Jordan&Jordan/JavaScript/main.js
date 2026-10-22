
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Resend } = require("resend");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const siteRoot = path.join(__dirname, "..");

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use("/CSS", express.static(path.join(siteRoot, "CSS")));
app.use("/Images", express.static(path.join(siteRoot, "Images")));

app.get("/", (req, res) => {
  res.sendFile(path.join(siteRoot, "index.html"));
});
app.get(["/index.html", "/contact.html", "/testimonials.html"], (req, res) => {
  res.sendFile(path.join(siteRoot, req.path.slice(1)));
});

const estimateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many review submissions. Please try again later."
  }
});

const reviewServices = new Set([
  "Repairs & Maintenance",
  "Painting & Finishing",
  "Junk Removal",
  "Pressure Washing",
  "Other / Multiple Services"
]);

app.post("/api/reviews", reviewLimiter, async (req, res) => {
  const { name, service, rating, summary } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanService = typeof service === "string" ? service.trim() : "";
  const cleanSummary = typeof summary === "string" ? summary.trim() : "";
  const numericRating = Number(rating);

  if (
    !cleanName || cleanName.length > 100 ||
    !reviewServices.has(cleanService) ||
    !Number.isInteger(numericRating) ||
    numericRating < 1 || numericRating > 5 ||
    !cleanSummary || cleanSummary.length > 3000
  ) {
    return res.status(400).json({
      error: "Please provide a valid name, service, 1–5 star rating, and review."
    });
  }

  const review = {
    id: randomUUID(),
    name: cleanName,
    service: cleanService,
    rating: numericRating,
    summary: cleanSummary,
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  try {
    await fs.appendFile(
      path.join(__dirname, "pending-reviews.jsonl"),
      `${JSON.stringify(review)}\n`,
      "utf8"
    );
    return res.status(201).json({
      message: "Your review was submitted for approval."
    });
  } catch (error) {
    console.error("Review storage error:", error);
    return res.status(500).json({
      error: "We couldn't save your review. Please try again later."
    });
  }
});

app.post("/api/estimate", estimateLimiter, async (req, res) => {
  try {
    const { name, email, phone, service, details } = req.body || {};

    // Validate required fields.
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof service !== "string" ||
      typeof details !== "string"
    ) {
      return res.status(400).json({
        error: "Please complete all required fields."
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone =
      typeof phone === "string" ? phone.trim() : "";
    const cleanService = service.trim();
    const cleanDetails = details.trim();

    if (
      !cleanName || cleanName.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254 ||
      cleanPhone.length > 40 ||
      !cleanService || cleanService.length > 100 ||
      !cleanDetails || cleanDetails.length > 3000
    ) {
      return res.status(400).json({
        error: "Please check your information and try again."
      });
    }

    if (!resend) {
      console.error("Estimate submission unavailable: RESEND_API_KEY is not configured.");
      return res.status(503).json({
        error: "Estimate requests are temporarily unavailable. Please contact us directly."
      });
    }

    // Send the inquiry to the business.
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: [process.env.BUSINESS_EMAIL],
      replyTo: cleanEmail,
      subject: `Estimate Request: ${cleanService}`,
      text: [
        "New Jordan & Jordan Property Services estimate request",
        "",
        `Name: ${cleanName}`,
        `Email: ${cleanEmail}`,
        `Phone: ${cleanPhone || "Not provided"}`,
        `Service: ${cleanService}`,
        "",
        "Project details:",
        cleanDetails
      ].join("\n")
    });

    if (error) {
      console.error("Email provider error:", error);
      return res.status(502).json({
        error: "We couldn't send your request. Please try again later."
      });
    }

    return res.status(200).json({
      message: "Your estimate request was submitted successfully.",
      id: data?.id
    });

  } catch (err) {
    console.error("Estimate endpoint error:", err);
    return res.status(500).json({
      error: "Something went wrong. Please try again later."
    });
  }
});

// Start the server.
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Website running at http://localhost:${port}`);
});

if (typeof document !== "undefined") {
  const estimateForm = document.getElementById("estimateForm");
  const formMessage = document.getElementById("form-message");

  if (estimateForm && formMessage) {
    estimateForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = estimateForm.querySelector(
        'button[type="submit"]'
      );

      submitButton.disabled = true;
      submitButton.textContent = "Sending...";

      formMessage.style.display = "block";
      formMessage.textContent = "Submitting your estimate request...";

      const formData = new FormData(estimateForm);

      const request = {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        service: formData.get("service"),
        details: formData.get("details")
      };

      try {
        const response = await fetch("/api/estimate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(request)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to submit your request."
          );
        }

        formMessage.textContent =
          "Thank you! Your estimate request has been submitted.";

        formMessage.style.background = "#eaf4ed";
        formMessage.style.color = "#215c36";

        estimateForm.reset();

      } catch (error) {
        formMessage.textContent =
          error.message ||
          "Something went wrong. Please try again.";

        formMessage.style.background = "#fff0f0";
        formMessage.style.color = "#9b1c1c";

      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Prepare Request";
      }
    });
  }
}
