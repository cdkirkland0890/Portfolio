import { createSign } from "node:crypto";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createSheetsProvider(config, fetchImpl = fetch) {
  let tokenCache;
  const configured = Boolean(config.serviceAccountJson && config.spreadsheetId && config.range);

  async function accessToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value;
    const account = JSON.parse(config.serviceAccountJson);
    if (!account.client_email || !account.private_key) throw new Error("Google service account config is incomplete.");
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
      iss: account.client_email,
      scope: SHEETS_SCOPE,
      aud: config.tokenUrl || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }))}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
    const tokenResponse = await fetchImpl(config.tokenUrl || "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error(`Google OAuth token request failed with status ${tokenResponse.status}.`);
    const result = await tokenResponse.json();
    tokenCache = { value: result.access_token, expiresAt: Date.now() + (result.expires_in || 3600) * 1000 };
    return tokenCache.value;
  }

  return {
    configured,
    async syncApplication({ id, name, email, battery, children, status, createdAt, updatedAt }) {
      if (!configured) return { synced: false, skipped: true };
      const token = await accessToken();
      const url = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.range)}:append`,
      );
      url.searchParams.set("valueInputOption", "RAW");
      url.searchParams.set("insertDataOption", "INSERT_ROWS");
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          majorDimension: "ROWS",
          values: children.map((child, index) => [
            id,
            name,
            email,
            battery,
            index + 1,
            child.ageBand,
            child.gender,
            child.interests,
            ...child.wishListItems,
            child.sensoryAllergyConcerns,
            child.shirtSize,
            child.pantsSize,
            child.shoeSize,
            status,
            createdAt,
            updatedAt,
          ]),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Google Sheets append failed with status ${response.status}.`);
      return { synced: true };
    },
  };
}
