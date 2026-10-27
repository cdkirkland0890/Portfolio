"use strict";

const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";
const adminView = document.querySelector("#admin-view");
const form = document.querySelector("#application-form");
const applicationMessage = document.querySelector("#application-message");
const adminMessage = document.querySelector("#admin-message");
let csrfToken = "";
let currentRole = "";

function showMessage(element, message, isError) {
  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
}

async function request(path, options) {
  const requestOptions = options || {};
  const response = await fetch(path, {
    ...requestOptions,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(requestOptions.headers || {}) },
  });
  let body = {};
  try { body = await response.json(); } catch { /* Use the generic fallback below. */ }
  if (!response.ok) {
    const error = new Error(body.error || "That request could not be completed. Please try again.");
    error.status = response.status;
    throw error;
  }
  return body;
}

if (isAdminRoute) {
  document.querySelectorAll("[data-public-nav]").forEach((link) => { link.hidden = true; });
  document.querySelector(".hero").hidden = true;
  document.querySelector(".steps").hidden = true;
  document.querySelector(".application-section").hidden = true;
  adminView.hidden = false;
  document.querySelector("#logout-button").hidden = true;

  const loginPanel = document.querySelector("#login-panel");
  const dashboardPanel = document.querySelector("#dashboard-panel");
  const list = document.querySelector("#application-list");

  function appendDetail(card, label, value) {
    const row = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = `${label}: `;
    const content = document.createElement("span");
    content.className = "detail-value";
    content.textContent = value || "—";
    row.append(title, content);
    card.append(row);
  }

  async function loadApplications() {
    list.replaceChildren();
    const { applications } = await request("/api/admin/applications");
    if (!applications.length) {
      const empty = document.createElement("p");
      empty.className = "admin-intro";
      empty.textContent = "There are no applications to display.";
      list.append(empty);
      return;
    }

    for (const application of applications) {
      const card = document.createElement("article");
      card.className = "application-card";
      const heading = document.createElement("div");
      heading.className = "application-card-head";
      const name = document.createElement("h3");
      name.textContent = application.name;
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = application.status;
      heading.append(name, badge);
      card.append(heading);
      appendDetail(card, "Email", application.email);
      appendDetail(card, "Battery", application.battery);
      const childrenHeading = document.createElement("h4");
      childrenHeading.textContent = `Children (${application.children.length})`;
      card.append(childrenHeading);
      application.children.forEach((child, index) => {
        const childHeading = document.createElement("h4");
        childHeading.textContent = `Child ${index + 1}`;
        card.append(childHeading);
        appendDetail(card, "Age band", child.ageBand);
        appendDetail(card, "Gender", child.gender);
        if (child.shirtSize) appendDetail(card, "Shirt size", child.shirtSize);
        if (child.pantsSize) appendDetail(card, "Pants size", child.pantsSize);
        if (child.shoeSize) appendDetail(card, "Shoe size", child.shoeSize);
        appendDetail(card, "Interests", child.interests);
        appendDetail(card, "Sensory and Allergy Concerns", child.sensoryAllergyConcerns);
        child.wishListItems.forEach((item, itemIndex) => {
          if (item) appendDetail(card, `Wish list item ${itemIndex + 1}`, item);
        });
      });
      appendDetail(card, "Submitted", new Date(application.createdAt).toLocaleString());
      appendDetail(card, "Last updated", new Date(application.updatedAt).toLocaleString());

      if (currentRole === "admin") {
        const statusRow = document.createElement("label");
        statusRow.className = "field-help";
        statusRow.textContent = "Update status";
        const select = document.createElement("select");
        select.id = `status-${application.id}`;
        statusRow.htmlFor = select.id;
        select.setAttribute("aria-label", `Update status for ${application.name}`);
        for (const status of ["pending", "approved", "declined", "closed"]) {
          const option = document.createElement("option");
          option.value = status;
          option.textContent = status[0].toUpperCase() + status.slice(1);
          option.selected = status === application.status;
          select.append(option);
        }
        select.addEventListener("change", async () => {
          select.disabled = true;
          try {
            await request(`/api/admin/applications/${encodeURIComponent(application.id)}/status`, {
              method: "PATCH",
              headers: { "x-csrf-token": csrfToken },
              body: JSON.stringify({ status: select.value }),
            });
            showMessage(adminMessage, "Application status updated.", false);
            await loadApplications();
          } catch (error) {
            showMessage(adminMessage, error.message, true);
            select.disabled = false;
          }
        });
        card.append(statusRow, select);
      }
      list.append(card);
    }
  }

  function setSignedIn(user) {
    currentRole = user.role;
    csrfToken = user.csrfToken;
    loginPanel.hidden = true;
    dashboardPanel.hidden = false;
    document.querySelector("#logout-button").hidden = false;
    document.querySelector("#staff-role").textContent = `Signed in as ${user.email} · ${user.role}`;
    loadApplications().catch((error) => showMessage(adminMessage, error.message, true));
  }

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#login-message");
    showMessage(message, "Signing in…", false);
    try {
      const user = await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.querySelector("#login-email").value,
          password: document.querySelector("#login-password").value,
        }),
      });
      setSignedIn(user);
      showMessage(message, "", false);
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  document.querySelector("#refresh-button").addEventListener("click", () => {
    loadApplications().catch((error) => showMessage(adminMessage, error.message, true));
  });
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      await request("/api/admin/logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: "{}",
      });
    } finally {
      csrfToken = "";
      currentRole = "";
      dashboardPanel.hidden = true;
      loginPanel.hidden = false;
      document.querySelector("#logout-button").hidden = true;
      showMessage(adminMessage, "You have signed out.", false);
    }
  });

  request("/api/admin/me").then(setSignedIn).catch(() => { /* An unauthenticated visitor sees the login form. */ });
}

if (form) {
  const childrenList = document.querySelector("#children-list");
  const childTemplate = document.querySelector("#child-template");
  const addChildButton = document.querySelector("#add-child-button");
  const maxChildren = 10;

  function updateChildEntries() {
    const entries = [...childrenList.querySelectorAll("[data-child-entry]")];
    entries.forEach((entry, index) => {
      const number = index + 1;
      entry.querySelector(".child-entry-title").textContent = `Child ${number}`;
      const removeButton = entry.querySelector(".remove-child-button");
      removeButton.hidden = entries.length === 1;
      removeButton.setAttribute("aria-label", `Remove child ${number}`);
      for (const field of entry.querySelectorAll("[data-child-field]")) {
        const oldId = field.id;
        const id = `child-${number}-${field.dataset.childField.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        const label = field.closest("label") || entry.querySelector(`label[for="${oldId}"]`);
        field.id = id;
        if (label) label.htmlFor = id;
      }
    });
    addChildButton.disabled = entries.length >= maxChildren;
    addChildButton.textContent = entries.length >= maxChildren
      ? `Maximum of ${maxChildren} children`
      : "+ Add another child";
  }

  function populateAgeBandSelect(select, ageBands) {
    const selected = select.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose an age band";
    select.replaceChildren(placeholder);
    for (const ageBand of ageBands) {
      const option = document.createElement("option");
      option.value = ageBand;
      option.textContent = ageBand;
      select.append(option);
    }
    if (ageBands.includes(selected)) select.value = selected;
  }

  addChildButton.addEventListener("click", () => {
    if (childrenList.querySelectorAll("[data-child-entry]").length >= maxChildren) return;
    childrenList.append(childTemplate.content.cloneNode(true));
    updateChildEntries();
  });

  childrenList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-child-button");
    if (!removeButton) return;
    removeButton.closest("[data-child-entry]").remove();
    updateChildEntries();
  });

  request("/api/config").then(({ ageBands }) => {
    if (!Array.isArray(ageBands)) return;
    for (const select of form.querySelectorAll('[data-child-field="ageBand"]')) populateAgeBandSelect(select, ageBands);
    populateAgeBandSelect(childTemplate.content.querySelector('[data-child-field="ageBand"]'), ageBands);
  }).catch(() => { /* Keep the default options if the config endpoint is temporarily unavailable. */ });

  updateChildEntries();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage(applicationMessage, "Submitting securely…", false);
    const values = new FormData(form);
    const payload = {
      name: values.get("name"),
      email: values.get("email"),
      battery: values.get("battery"),
      children: [...childrenList.querySelectorAll("[data-child-entry]")].map((entry) => ({
        ageBand: entry.querySelector('[data-child-field="ageBand"]').value,
        gender: entry.querySelector('[data-child-field="gender"]').value,
        shirtSize: entry.querySelector('[data-child-field="shirtSize"]').value,
        pantsSize: entry.querySelector('[data-child-field="pantsSize"]').value,
        shoeSize: entry.querySelector('[data-child-field="shoeSize"]').value,
        interests: entry.querySelector('[data-child-field="interests"]').value,
        wishListItems: [...entry.querySelectorAll('[data-child-field^="wishListItem"]')]
          .map((field) => field.value),
        sensoryAllergyConcerns: entry.querySelector('[data-child-field="sensoryAllergyConcerns"]').value,
      })),
      consent: values.get("consent") === "on",
    };
    try {
      await request("/api/applications", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      childrenList.querySelectorAll("[data-child-entry]:not(:first-child)").forEach((entry) => entry.remove());
      updateChildEntries();
      showMessage(applicationMessage, "Thank you. Your application was received. A general confirmation will be sent if email delivery is configured.", false);
    } catch (error) {
      showMessage(applicationMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}
