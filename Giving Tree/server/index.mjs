import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { createEmailProvider } from "./email.mjs";
import { createSheetsProvider } from "./sheets.mjs";
import { parseAdminUsers } from "./security.mjs";
import { purgeExpiredApplications } from "./database.mjs";
import { loadLocalEnv } from "./env.mjs";

await loadLocalEnv();
const isProduction = process.env.NODE_ENV === "production";
const retentionValue = process.env.RETENTION_DAYS;
const retentionDays = retentionValue ? Number(retentionValue) : null;
if (retentionValue && (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650)) {
  throw new Error("RETENTION_DAYS must be a whole number between 1 and 3650.");
}
if (isProduction && !retentionDays) {
  throw new Error("Pre-launch blocker: set the approved RETENTION_DAYS policy before production startup.");
}

const admins = parseAdminUsers(process.env.ADMIN_USERS_JSON || "");
if (isProduction && admins.length === 0) throw new Error("Configure at least one authenticated staff account before production startup.");

const adminUrl = process.env.ADMIN_URL || "http://127.0.0.1:3000/admin";
if (isProduction && !adminUrl.startsWith("https://")) throw new Error("Set ADMIN_URL to the HTTPS staff dashboard URL.");
const ageBands = (process.env.AGE_BANDS || "0–2,3–4,5–6,7–8,9–12,13+")
  .split(",").map((value) => value.trim()).filter(Boolean);

const emailProvider = createEmailProvider({
  endpoint: process.env.ACS_ENDPOINT,
  accessKey: process.env.ACS_ACCESS_KEY,
  senderAddress: process.env.ACS_SENDER_ADDRESS,
});
const sheetsProvider = createSheetsProvider({
  serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  range: process.env.GOOGLE_SHEET_RANGE || "GivingTree!A:S",
});
if (isProduction && !emailProvider.configured) throw new Error("Configure Azure Communication Services Email before production startup.");
if (isProduction && (!sheetsProvider.configured || !process.env.STAFF_NOTIFICATION_EMAIL)) {
  throw new Error("Configure the restricted Google Sheet and staff notification email before production startup.");
}
if (!emailProvider.configured) console.warn("Email provider is not configured; email notifications are skipped.");
if (!sheetsProvider.configured) console.warn("Google Sheets is not configured; operational sync is skipped.");
if (!retentionDays) console.warn("PRE-LAUNCH BLOCKER: application retention period is undecided. Configure RETENTION_DAYS before production.");

const app = await createApp({
  dbPath: process.env.DB_PATH || "./data/giving-tree.sqlite",
  admins,
  emailProvider,
  sheetsProvider,
  config: {
    nodeEnv: process.env.NODE_ENV,
    staffNotificationEmail: process.env.STAFF_NOTIFICATION_EMAIL,
    adminUrl,
    ageBands,
    retentionDays,
  },
});
const server = createServer(app.handle);
server.headersTimeout = 10_000;
server.requestTimeout = 20_000;
server.keepAliveTimeout = 5_000;

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => {
  console.log(`3-7FA Giving Tree running at http://${host}:${port}`);
});

const retentionTimer = retentionDays ? setInterval(() => {
  try { purgeExpiredApplications(app.db, retentionDays); } catch { console.error("Retention cleanup failed."); }
}, 24 * 60 * 60 * 1000) : null;
retentionTimer?.unref();

function shutdown() {
  if (retentionTimer) clearInterval(retentionTimer);
  server.close(() => {
    try { app.db.close(); } catch { /* Already closed. */ }
    process.exitCode = 0;
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
