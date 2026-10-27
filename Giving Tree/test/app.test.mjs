import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../server/app.mjs";
import { openDatabase, getApplication } from "../server/database.mjs";
import { hashPassword } from "../server/security.mjs";

const password = "Correct horse battery staple!";

async function fixture(admins = [], config = {}, sheetsProvider) {
  const db = await openDatabase(":memory:");
  const app = await createApp({ db, admins, config, sheetsProvider, logger: { error() {} } });
  const server = createServer(app.handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    db,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

async function jsonRequest(baseUrl, route, { method = "GET", body, cookie, csrf } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (csrf) headers["x-csrf-token"] = csrf;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  return { response, result };
}

const application = {
  name: "Sensitive Family Name",
  email: "private.family@example.test",
  battery: "A Btry",
  children: [
    {
      ageBand: "5–6",
      gender: "Prefer to self-describe",
      shirtSize: "Youth M",
      pantsSize: "10",
      shoeSize: "3",
      interests: "Sensitive interest details",
      wishListItems: ["Building blocks", "Picture book", "", ""],
      sensoryAllergyConcerns: "Avoids flashing lights",
    },
    {
      ageBand: "9–12",
      gender: "Prefer not to say",
      shirtSize: "Youth L",
      pantsSize: "12",
      shoeSize: "5",
      interests: "Another sensitive interest",
      wishListItems: ["", "", "", ""],
      sensoryAllergyConcerns: "Peanut allergy",
    },
  ],
  consent: true,
};

test("public application validates, saves privately, and returns no application details", async () => {
  const env = await fixture();
  try {
    const invalid = await jsonRequest(env.baseUrl, "/api/applications", {
      method: "POST", body: { ...application, consent: false },
    });
    assert.equal(invalid.response.status, 400);

    const accepted = await jsonRequest(env.baseUrl, "/api/applications", { method: "POST", body: application });
    assert.equal(accepted.response.status, 202);
    const serialized = JSON.stringify(accepted.result);
    for (const privateValue of [
      application.name, application.email,
      ...application.children.flatMap((child) => [child.ageBand, child.gender, child.interests]),
    ]) {
      assert.equal(serialized.includes(privateValue), false);
    }

    const stored = { ...env.db.prepare("SELECT name, email, battery, age_band, gender, interests, status FROM applications").get() };
    assert.deepEqual(stored, {
      name: application.name,
      email: application.email,
      battery: application.battery,
      age_band: application.children[0].ageBand,
      gender: application.children[0].gender,
      interests: application.children[0].interests,
      status: "pending",
    });
    const storedChildren = env.db.prepare(`
      SELECT age_band AS ageBand, gender, interests,
        wish_list_item_1 AS item1, wish_list_item_2 AS item2,
        wish_list_item_3 AS item3, wish_list_item_4 AS item4,
        sensory_allergy_concerns AS sensoryAllergyConcerns,
        shirt_size AS shirtSize, pants_size AS pantsSize, shoe_size AS shoeSize
      FROM application_children ORDER BY id
    `)
      .all().map((child) => ({ ...child }));
    assert.deepEqual(storedChildren, application.children.map((child) => ({
      ageBand: child.ageBand,
      gender: child.gender,
      interests: child.interests,
      item1: child.wishListItems[0],
      item2: child.wishListItems[1],
      item3: child.wishListItems[2],
      item4: child.wishListItems[3],
      sensoryAllergyConcerns: child.sensoryAllergyConcerns,
      shirtSize: child.shirtSize,
      pantsSize: child.pantsSize,
      shoeSize: child.shoeSize,
    })));
    const invalidBattery = await jsonRequest(env.baseUrl, "/api/applications", {
      method: "POST", body: { ...application, battery: "Other" },
    });
    assert.equal(invalidBattery.response.status, 400);
    const invalidWishListItem = await jsonRequest(env.baseUrl, "/api/applications", {
      method: "POST",
      body: {
        ...application,
        children: [{
          ...application.children[0],
          wishListItems: ["x".repeat(201), "", "", ""],
        }],
      },
    });
    assert.equal(invalidWishListItem.response.status, 400);
    const missingSensoryConcerns = await jsonRequest(env.baseUrl, "/api/applications", {
      method: "POST",
      body: {
        ...application,
        children: [{ ...application.children[0], sensoryAllergyConcerns: "" }],
      },
    });
    assert.equal(missingSensoryConcerns.response.status, 400);
    const publicList = await jsonRequest(env.baseUrl, "/api/admin/applications");
    assert.equal(publicList.response.status, 401);
    const config = await jsonRequest(env.baseUrl, "/api/config");
    assert.deepEqual(config.result.ageBands, ["0–2", "3–4", "5–6", "7–8", "9–12", "13+"]);
  } finally {
    await env.close();
  }
});

test("public application requires each child's clothing sizes", async () => {
  const env = await fixture();
  try {
    for (const sizeField of ["shirtSize", "pantsSize", "shoeSize"]) {
      const missingSize = await jsonRequest(env.baseUrl, "/api/applications", {
        method: "POST",
        body: {
          ...application,
          children: [{ ...application.children[0], [sizeField]: "" }],
        },
      });
      assert.equal(missingSize.response.status, 400);
    }
  } finally {
    await env.close();
  }
});

test("public application endpoint enforces the per-IP submission limit", async () => {
  const env = await fixture();
  try {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { response } = await jsonRequest(env.baseUrl, "/api/applications", {
        method: "POST",
        body: { ...application, email: `family${attempt}@example.test` },
      });

      responses.push(response.status);
    }
    assert.deepEqual(responses, [202, 202, 202, 202, 202, 429]);
  } finally {
    await env.close();
  }
});

test("family submission sends guardian and child details to the configured Sheets adapter", async () => {
  const syncedApplications = [];
  const sheetsProvider = {
    syncApplication: async (applicationDetails) => {
      syncedApplications.push(applicationDetails);
      return { synced: true };
    },
  };
  const env = await fixture([], {}, sheetsProvider);
  try {
    const { response } = await jsonRequest(env.baseUrl, "/api/applications", { method: "POST", body: application });
    assert.equal(response.status, 202);
    assert.equal(syncedApplications.length, 1);
    assert.deepEqual(syncedApplications[0], {
      id: env.db.prepare("SELECT id FROM applications").get().id,
      name: application.name,
      email: application.email,
      battery: application.battery,
      children: application.children,
      status: "pending",
      consentAt: env.db.prepare("SELECT consent_at AS consentAt FROM applications").get().consentAt,
      createdAt: env.db.prepare("SELECT created_at AS createdAt FROM applications").get().createdAt,
      updatedAt: env.db.prepare("SELECT updated_at AS updatedAt FROM applications").get().updatedAt,
    });
  } finally {
    await env.close();
  }
});

test("role-based staff access requires a session and restricts reviewer status changes", async () => {
  const reviewer = {
    email: "reviewer@example.test",
    role: "reviewer",
    passwordHash: hashPassword(password),
  };
  const env = await fixture([reviewer]);
  try {
    await jsonRequest(env.baseUrl, "/api/applications", { method: "POST", body: application });
    const badLogin = await jsonRequest(env.baseUrl, "/api/admin/login", {
      method: "POST", body: { email: reviewer.email, password: "wrong-password" },
    });
    assert.equal(badLogin.response.status, 401);

    const login = await jsonRequest(env.baseUrl, "/api/admin/login", {
      method: "POST", body: { email: reviewer.email, password },
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.result.role, "reviewer");
    const cookie = login.response.headers.get("set-cookie").split(";")[0];
    const list = await jsonRequest(env.baseUrl, "/api/admin/applications", { cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.result.applications.length, 1);
    assert.equal(list.result.applications[0].name, application.name);
    assert.equal(list.result.applications[0].battery, application.battery);
    assert.equal(list.result.applications[0].children.length, 2);
    assert.equal(
      list.result.applications[0].children[0].sensoryAllergyConcerns,
      application.children[0].sensoryAllergyConcerns,
    );
    assert.deepEqual(list.result.applications[0].children[0].wishListItems, application.children[0].wishListItems);
    assert.equal(list.result.applications[0].children[0].shirtSize, application.children[0].shirtSize);
    assert.equal(list.result.applications[0].children[0].pantsSize, application.children[0].pantsSize);
    assert.equal(list.result.applications[0].children[0].shoeSize, application.children[0].shoeSize);

    const appId = list.result.applications[0].id;
    const noCsrf = await jsonRequest(env.baseUrl, `/api/admin/applications/${appId}/status`, {
      method: "PATCH", cookie, body: { status: "approved" },
    });
    assert.equal(noCsrf.response.status, 403);
    const forbidden = await jsonRequest(env.baseUrl, `/api/admin/applications/${appId}/status`, {
      method: "PATCH", cookie, csrf: login.result.csrfToken, body: { status: "approved" },
    });
    assert.equal(forbidden.response.status, 403);
    assert.equal(getApplication(env.db, appId).status, "pending");
  } finally {
    await env.close();
  }
});

test("administrator can update status with CSRF protection and audit is recorded", async () => {
  const administrator = {
    email: "admin@example.test",
    role: "admin",
    passwordHash: hashPassword(password),
  };
  const env = await fixture([administrator]);
  try {
    await jsonRequest(env.baseUrl, "/api/applications", { method: "POST", body: application });
    const login = await jsonRequest(env.baseUrl, "/api/admin/login", {
      method: "POST", body: { email: administrator.email, password },
    });
    const cookie = login.response.headers.get("set-cookie").split(";")[0];
    const list = await jsonRequest(env.baseUrl, "/api/admin/applications", { cookie });
    const id = list.result.applications[0].id;
    const updated = await jsonRequest(env.baseUrl, `/api/admin/applications/${id}/status`, {
      method: "PATCH", cookie, csrf: login.result.csrfToken, body: { status: "approved" },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(getApplication(env.db, id).status, "approved");
    const events = await jsonRequest(env.baseUrl, "/api/admin/audit", { cookie });
    assert.equal(events.response.status, 200);
    assert.ok(events.result.events.some((event) => event.eventType === "admin.application.viewed" && event.applicationId === id));
    assert.ok(events.result.events.some((event) => event.eventType === "admin.application.status_changed" && event.applicationId === id));
  } finally {
    await env.close();
  }
});

test("only allowlisted static assets are served and security headers are set", async () => {
  const env = await fixture([], { ageBands: ["3–7"] });
  try {
    const homepage = await fetch(`${env.baseUrl}/`);
    assert.equal(homepage.status, 200);
    assert.equal(homepage.headers.get("content-security-policy").includes("frame-ancestors 'none'"), true);
    const config = await jsonRequest(env.baseUrl, "/api/config");
    assert.deepEqual(config.result.ageBands, ["3–7"]);
    const photo = await fetch(`${env.baseUrl}/Assets/3-7fa-insignia.png`);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get("content-type"), "image/png");
    const traversal = await fetch(`${env.baseUrl}/server/database.mjs`);
    assert.equal(traversal.status, 404);
  } finally {
    await env.close();
  }
});
