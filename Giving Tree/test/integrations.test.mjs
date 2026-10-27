import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createEmailProvider } from "../server/email.mjs";
import { createSheetsProvider } from "../server/sheets.mjs";

test("Azure email payloads contain generic messages and no application details", async () => {
  const requests = [];
  const provider = createEmailProvider({
    endpoint: "https://acs.example.test",
    accessKey: Buffer.from("local-test-key").toString("base64"),
    senderAddress: "noreply@example.test",
  }, async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response("{}", { status: 202 });
  });

  await provider.sendApplicationConfirmation("family.private@example.test");
  await provider.sendStaffNotification("program.staff@example.test", "https://giving.example.test/admin");
  assert.equal(requests.length, 2);
  for (const { options } of requests) {
    assert.match(options.headers.authorization, /^HMAC-SHA256 /);
    const message = JSON.parse(options.body);
    const text = `${message.content.subject} ${message.content.plainText}`;
    for (const privateValue of ["Sensitive Family Name", "private.family@example.test", "7–8", "Gender", "interest details"]) {
      assert.equal(text.includes(privateValue), false);
    }
  }
  const familyMail = JSON.parse(requests[0].options.body);
  assert.equal(familyMail.recipients.to[0].address, "family.private@example.test");
  const staffMail = JSON.parse(requests[1].options.body);
  assert.match(staffMail.content.plainText, /https:\/\/giving\.example\.test\/admin/);
});

test("Google Sheets adapter writes guardian name/email and each child's details", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const calls = [];
  const provider = createSheetsProvider({
    serviceAccountJson: JSON.stringify({
      client_email: "giving-tree@example.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    }),
    spreadsheetId: "restricted-sheet-id",
    range: "GivingTree!A:S",
    tokenUrl: "https://oauth.example.test/token",
  }, async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("oauth.example.test")) {
      return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ updates: { updatedRows: 1 } }), { status: 200 });
  });

  await provider.syncApplication({
    id: "00000000-0000-4000-8000-000000000001",
    status: "pending",
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
    name: "Guardian Example",
    email: "guardian@example.test",
    battery: "B Btry",
    children: [
      {
        ageBand: "5–6",
        gender: "Child gender",
        shirtSize: "Youth M",
        pantsSize: "10",
        shoeSize: "3",
        interests: "Child interests",
        wishListItems: ["Blocks", "", "", ""],
        sensoryAllergyConcerns: "Avoids loud sounds",
      },
      {
        ageBand: "9–12",
        gender: "Another gender",
        shirtSize: "Youth L",
        pantsSize: "12",
        shoeSize: "5",
        interests: "Another interest",
        wishListItems: ["", "Art set", "", ""],
        sensoryAllergyConcerns: "Tree nut allergy",
      },
    ],
  });
  assert.equal(calls.length, 2);
  const tokenRequest = new URLSearchParams(calls[0].options.body);
  const assertion = tokenRequest.get("assertion").split(".");
  const claims = JSON.parse(Buffer.from(assertion[1], "base64url").toString("utf8"));
  assert.equal(claims.scope, "https://www.googleapis.com/auth/spreadsheets");
  const sheetRequest = calls[1];
  assert.match(sheetRequest.options.headers.authorization, /^Bearer /);
  const payload = JSON.parse(sheetRequest.options.body);
  assert.deepEqual(payload.values, [[
    "00000000-0000-4000-8000-000000000001",
    "Guardian Example",
    "guardian@example.test",
    "B Btry",
    1,
    "5–6",
    "Child gender",
    "Child interests",
    "Blocks",
    "",
    "",
    "",
    "Avoids loud sounds",
    "Youth M",
    "10",
    "3",
    "pending",
    "2026-01-02T03:04:05.000Z",
    "2026-01-02T03:04:05.000Z",
  ], [
    "00000000-0000-4000-8000-000000000001",
    "Guardian Example",
    "guardian@example.test",
    "B Btry",
    2,
    "9–12",
    "Another gender",
    "Another interest",
    "",
    "Art set",
    "",
    "",
    "Tree nut allergy",
    "Youth L",
    "12",
    "5",
    "pending",
    "2026-01-02T03:04:05.000Z",
    "2026-01-02T03:04:05.000Z",
  ]]);
});
