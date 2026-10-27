import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { URL } from "node:url";
import {
  audit, getAuditEvents, getApplication, listApplications, openDatabase,
  purgeExpiredApplications, saveApplication, setApplicationStatus,
} from "./database.mjs";
import { hashSecret, secureEqual, verifyPassword, FixedWindowRateLimiter } from "./security.mjs";

const STATUSES = new Set(["pending", "approved", "declined", "closed"]);
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/Assets/3-7fa-insignia.png", ["Assets/3-7fa-insignia.png", "image/png"]],
  ["/CSS/styles.css", ["CSS/styles.css", "text/css; charset=utf-8"]],
  ["/JS/app.js", ["JS/app.js", "text/javascript; charset=utf-8"]],
]);
const DEFAULT_AGE_BANDS = ["0–2", "3–4", "5–6", "7–8", "9–12", "13+"];
const BATTERIES = new Set(["HHB", "A Btry", "B Btry", "C Btry", "F Btry"]);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024;
const MIME_TYPES = new Map([[".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".js", "text/javascript; charset=utf-8"]]);

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function cleanText(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
}

function validateApplication(body, ageBands) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Please review the form and try again." };
  const name = cleanText(body.name);
  const email = cleanText(body.email).toLowerCase();
  const battery = cleanText(body.battery);
  const children = Array.isArray(body.children)
    ? body.children
    : [{ ageBand: body.ageBand, gender: body.gender, interests: body.interests }];
  if (name.length < 1 || name.length > 120 || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !BATTERIES.has(battery)
    || children.length < 1 || children.length > 10
    || body.consent !== true) {
    return { error: "Please check each required field and your privacy acknowledgement." };
  }
  const validatedChildren = [];
  for (const child of children) {
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      return { error: "Please check each required field and your privacy acknowledgement." };
    }
    const ageBand = cleanText(child.ageBand);
    const gender = cleanText(child.gender);
    const shirtSize = cleanText(child.shirtSize);
    const pantsSize = cleanText(child.pantsSize);
    const shoeSize = cleanText(child.shoeSize);
    const interests = cleanText(child.interests);
    const sensoryAllergyConcerns = cleanText(child.sensoryAllergyConcerns);
    const wishListItems = Array.isArray(child.wishListItems) ? child.wishListItems : [];
    if (!ageBands.includes(ageBand) || gender.length < 1 || gender.length > 80
      || [child.shirtSize, child.pantsSize, child.shoeSize].some((size) => size != null && typeof size !== "string")
      || [shirtSize, pantsSize, shoeSize].some((size) => size.length < 1 || size.length > 40)
      || interests.length < 1 || interests.length > 1200
      || sensoryAllergyConcerns.length < 1 || sensoryAllergyConcerns.length > 1200
      || wishListItems.length > 4
      || wishListItems.some((item) => typeof item !== "string" || cleanText(item).length > 200)) {
      return { error: "Please check each required field and your privacy acknowledgement." };
    }
    validatedChildren.push({
      ageBand,
      gender,
      shirtSize,
      pantsSize,
      shoeSize,
      interests,
      wishListItems: Array.from({ length: 4 }, (_, index) => cleanText(wishListItems[index])),
      sensoryAllergyConcerns,
    });
  }
  return { value: { name, email, battery, children: validatedChildren } };
}

async function readJsonBody(req) {
  if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    const error = new Error("JSON is required.");
    error.status = 415;
    throw error;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      const error = new Error("Request too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {
    const error = new Error("Invalid JSON.");
    error.status = 400;
    throw error;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function setSessionCookie(res, token, production) {
  const name = production ? "__Host-gt_session" : "gt_session";
  res.setHeader("set-cookie", `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${production ? "; Secure" : ""}`);
}

function clearSessionCookie(res, production) {
  const name = production ? "__Host-gt_session" : "gt_session";
  res.setHeader("set-cookie", `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production ? "; Secure" : ""}`);
}

function requestIp(req) {
  return req.socket.remoteAddress || "unknown";
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  try {
    if (origin && new URL(origin).host !== req.headers.host) return false;
  } catch {
    return false;
  }
  return req.headers["sec-fetch-site"] !== "cross-site";
}

export async function createApp({
  db: suppliedDb,
  dbPath = process.env.DB_PATH || "./data/giving-tree.sqlite",
  admins = [],
  emailProvider = {
    configured: false,
    sendApplicationConfirmation: async () => ({ skipped: true }),
    sendStaffNotification: async () => ({ skipped: true }),
    sendFamilyUpdate: async () => ({ skipped: true }),
  },
  sheetsProvider = { configured: false, syncApplication: async () => ({ skipped: true }) },
  config = {},
  clock = () => new Date(),
  uuid = randomUUID,
  logger = console,
  root = resolve(import.meta.dirname, ".."),
} = {}) {
  const db = suppliedDb || await openDatabase(dbPath);
  const production = config.nodeEnv === "production";
  const ageBands = config.ageBands || DEFAULT_AGE_BANDS;
  const retentionDays = config.retentionDays || null;
  const loginLimiter = new FixedWindowRateLimiter({ limit: 8, windowMs: 15 * 60 * 1000 });
  const applyLimiter = new FixedWindowRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
  const sessionCookieName = production ? "__Host-gt_session" : "gt_session";

  function getSession(req, rotateCsrf = false) {
    const token = parseCookies(req.headers.cookie)[sessionCookieName];
    if (!token || token.length > 200) return null;
    const tokenHash = hashSecret(token);
    const session = db.prepare("SELECT token_hash AS tokenHash, csrf_hash AS csrfHash, email, role, expires_at AS expiresAt FROM admin_sessions WHERE token_hash = ?")
      .get(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= clock().getTime()) {
      db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
      return null;
    }
    let csrfToken;
    if (rotateCsrf) {
      csrfToken = randomBytes(32).toString("base64url");
      db.prepare("UPDATE admin_sessions SET csrf_hash = ? WHERE token_hash = ?").run(hashSecret(csrfToken), tokenHash);
    }
    return { ...session, tokenHash, csrfToken };
  }

  async function handle(req, res) {
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("content-security-policy", "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'");
    res.setHeader("cache-control", "no-store");
    if (production) res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");

    let pathname;
    try { pathname = new URL(req.url, "http://localhost").pathname; } catch {
      sendJson(res, 400, { error: "Invalid request." });
      return;
    }
    const method = req.method || "GET";

    if (pathname.startsWith("/api/") && ["POST", "PATCH", "PUT", "DELETE"].includes(method) && !requireSameOrigin(req)) {
      sendJson(res, 403, { error: "Request origin was not accepted." });
      return;
    }

    try {
      if (method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (method === "GET" && pathname === "/api/config") {
        sendJson(res, 200, { ageBands });
        return;
      }

      if (method === "POST" && pathname === "/api/applications") {
        if (!applyLimiter.allow(requestIp(req))) {
          sendJson(res, 429, { error: "Please wait before submitting another application." }, { "retry-after": "3600" });
          return;
        }
        const validation = validateApplication(await readJsonBody(req), ageBands);
        if (validation.error) {
          sendJson(res, 400, { error: validation.error });
          return;
        }
        const now = clock().toISOString();
        const application = {
          ...validation.value, id: uuid(), status: "pending",
          consentAt: now, createdAt: now, updatedAt: now,
        };
        saveApplication(db, application);
        audit(db, "system", "application.created", application.id, now);
        const sheetRow = application;
        const sideEffects = await Promise.allSettled([
          Promise.resolve().then(() => emailProvider.sendApplicationConfirmation(application.email)),
          Promise.resolve().then(() => emailProvider.sendStaffNotification(config.staffNotificationEmail, config.adminUrl || "/admin")),
          Promise.resolve().then(() => sheetsProvider.syncApplication(sheetRow)),
        ]);
        if (sideEffects[0].status === "rejected") logger.error("Application confirmation delivery failed.");
        if (sideEffects[1].status === "rejected") logger.error("Staff notification delivery failed.");
        if (sideEffects[2].status === "rejected") logger.error("Google Sheets sync failed.");
        sendJson(res, 202, { message: "Application received." });
        return;
      }

      if (pathname.startsWith("/api/admin/")) {
        if (pathname === "/api/admin/login" && method === "POST") {
          if (!loginLimiter.allow(requestIp(req))) {
            sendJson(res, 429, { error: "Too many sign-in attempts. Please wait and try again." }, { "retry-after": "900" });
            return;
          }
          const body = await readJsonBody(req);
          const email = cleanText(body?.email).toLowerCase();
          const password = typeof body?.password === "string" ? body.password : "";
          const admin = admins.find((user) => user.email === email);
          if (!admin || password.length > 1024 || !verifyPassword(password, admin.passwordHash)) {
            sendJson(res, 401, { error: "Email or password is not correct." });
            return;
          }
          const token = randomBytes(32).toString("base64url");
          const csrfToken = randomBytes(32).toString("base64url");
          const expiresAt = clock().getTime() + SESSION_TTL_MS;
          db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(clock().getTime());
          db.prepare("INSERT INTO admin_sessions (token_hash, csrf_hash, email, role, expires_at) VALUES (?, ?, ?, ?, ?)")
            .run(hashSecret(token), hashSecret(csrfToken), admin.email, admin.role, expiresAt);
          setSessionCookie(res, token, production);
          audit(db, admin.email, "admin.signed_in", null, clock().toISOString());
          sendJson(res, 200, { email: admin.email, role: admin.role, csrfToken });
          return;
        }

        const session = getSession(req);
        if (!session) {
          sendJson(res, 401, { error: "Staff sign-in is required." });
          return;
        }
        if (["POST", "PATCH", "PUT", "DELETE"].includes(method)
          && pathname !== "/api/admin/login" && pathname !== "/api/admin/logout") {
          const suppliedCsrf = req.headers["x-csrf-token"];
          if (!secureEqual(hashSecret(suppliedCsrf || ""), session.csrfHash)) {
            sendJson(res, 403, { error: "Security token is invalid. Refresh and sign in again." });
            return;
          }
        }

        if (pathname === "/api/admin/me" && method === "GET") {
          const refreshed = getSession(req, true);
          sendJson(res, 200, { email: session.email, role: session.role, csrfToken: refreshed.csrfToken });
          return;
        }

        if (pathname === "/api/admin/logout" && method === "POST") {
          if (!secureEqual(hashSecret(req.headers["x-csrf-token"] || ""), session.csrfHash)) {
            sendJson(res, 403, { error: "Security token is invalid." });
            return;
          }
          db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(session.tokenHash);
          audit(db, session.email, "admin.signed_out", null, clock().toISOString());
          clearSessionCookie(res, production);
          sendJson(res, 200, { message: "Signed out." });
          return;
        }

        if (pathname === "/api/admin/applications" && method === "GET") {
          const applications = listApplications(db);
          for (const application of applications) audit(db, session.email, "admin.application.viewed", application.id, clock().toISOString());
          sendJson(res, 200, { applications });
          return;
        }

        if (pathname === "/api/admin/audit" && method === "GET") {
          if (session.role !== "admin") {
            sendJson(res, 403, { error: "Administrator role is required." });
            return;
          }
          sendJson(res, 200, { events: getAuditEvents(db) });
          return;
        }

        const statusMatch = pathname.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})\/status$/i);
        if (statusMatch && method === "PATCH") {
          if (session.role !== "admin") {
            sendJson(res, 403, { error: "Administrator role is required to change application status." });
            return;
          }
          const body = await readJsonBody(req);
          if (!STATUSES.has(body?.status)) {
            sendJson(res, 400, { error: "Choose a valid application status." });
            return;
          }
          const id = statusMatch[1];
          const previous = getApplication(db, id);
          if (!previous) {
            sendJson(res, 404, { error: "Application was not found." });
            return;
          }
          const updatedAt = clock().toISOString();
          setApplicationStatus(db, id, body.status, updatedAt);
          audit(db, session.email, "admin.application.status_changed", id, updatedAt);
          const sheetRow = { ...previous, status: body.status, updatedAt };
          const sideEffects = await Promise.allSettled([
            Promise.resolve().then(() => sheetsProvider.syncApplication(sheetRow)),
            Promise.resolve().then(() => emailProvider.sendFamilyUpdate(previous.email)),
          ]);
          if (sideEffects[0].status === "rejected") logger.error("Google Sheets status sync failed.");
          if (sideEffects[1].status === "rejected") logger.error("Family update delivery failed.");
          sendJson(res, 200, { id, status: body.status, updatedAt });
          return;
        }

        sendJson(res, 404, { error: "Endpoint not found." });
        return;
      }

      if (method === "GET" && STATIC_FILES.has(pathname)) {
        const [relativePath, contentType] = STATIC_FILES.get(pathname);
        const file = await readFile(resolve(root, relativePath));
        res.writeHead(200, { "content-type": contentType, "content-length": file.length });
        res.end(file);
        return;
      }

      if (method === "GET" && pathname === "/admin") {
        const file = await readFile(resolve(root, "index.html"));
        res.writeHead(200, { "content-type": MIME_TYPES.get(extname("index.html")), "content-length": file.length });
        res.end(file);
        return;
      }
      sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      if (error.status) {
        sendJson(res, error.status, { error: error.status === 413 ? "Request is too large." : error.message });
        return;
      }
      logger.error("Request could not be completed.");
      sendJson(res, 500, { error: "The request could not be completed." });
    }
  }

  if (retentionDays) {
    purgeExpiredApplications(db, retentionDays, clock());
  }
  return { handle, db };
}
