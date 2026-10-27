import { createHash, createHmac } from "node:crypto";

function requestAuthHeaders({ method, url, body, accessKey, now = new Date() }) {
  const date = now.toUTCString();
  const host = url.host;
  const contentHash = createHash("sha256").update(body).digest("base64");
  const stringToSign = `${method}\n${url.pathname}${url.search}\n${date};${host};${contentHash}`;
  const signature = createHmac("sha256", Buffer.from(accessKey, "base64"))
    .update(stringToSign).digest("base64");
  return {
    "content-type": "application/json",
    "x-ms-date": date,
    "x-ms-content-sha256": contentHash,
    authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
}

export function createEmailProvider(config, fetchImpl = fetch) {
  return {
    configured: Boolean(config.endpoint && config.accessKey && config.senderAddress),
    async sendApplicationConfirmation(recipient) {
      if (!config.endpoint || !config.accessKey || !config.senderAddress) return { sent: false, skipped: true };
      return send(config, fetchImpl, {
        to: [recipient],
        subject: "We received your 3-7FA Giving Tree application",
        plainText: "Thank you for contacting the 3-7FA Giving Tree. We received your application. Program staff will contact you if there is an update.",
      });
    },
    async sendStaffNotification(recipient, adminUrl) {
      if (!config.endpoint || !config.accessKey || !config.senderAddress || !recipient) return { sent: false, skipped: true };
      return send(config, fetchImpl, {
        to: [recipient],
        subject: "A new 3-7FA Giving Tree application is ready for review",
        plainText: `A new family application is ready for authorized review. Sign in securely to the staff dashboard: ${adminUrl}`,
      });
    },
    async sendFamilyUpdate(recipient) {
      if (!config.endpoint || !config.accessKey || !config.senderAddress) return { sent: false, skipped: true };
      return send(config, fetchImpl, {
        to: [recipient],
        subject: "There is an update from the 3-7FA Giving Tree",
        plainText: "There is an update regarding your 3-7FA Giving Tree application. Please contact program staff if you need more information.",
      });
    },
  };
}

async function send(config, fetchImpl, message) {
  const endpoint = new URL("/emails:send?api-version=2023-03-31", config.endpoint);
  const payload = JSON.stringify({
    senderAddress: config.senderAddress,
    recipients: { to: message.to.map((address) => ({ address })) },
    content: { subject: message.subject, plainText: message.plainText },
  });
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: requestAuthHeaders({ method: "POST", url: endpoint, body: payload, accessKey: config.accessKey }),
    body: payload,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Azure Communication Services email request failed with status ${response.status}.`);
  return { sent: true };
}
