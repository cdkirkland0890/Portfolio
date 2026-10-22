const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

test("local server saves, validates, and serves customer reviews", async t => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wyze-guyz-reviews-"));
    const serverProcess = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        cwd: path.join(__dirname, ".."),
        env: {
            ...process.env,
            PORT: "0",
            WYZE_DATA_DIR: dataDirectory
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let errors = "";
    serverProcess.stdout.setEncoding("utf8");
    serverProcess.stderr.setEncoding("utf8");
    serverProcess.stdout.on("data", chunk => { output += chunk; });
    serverProcess.stderr.on("data", chunk => { errors += chunk; });

    t.after(() => {
        serverProcess.kill();
        fs.rmSync(dataDirectory, { recursive: true, force: true });
    });

    const baseUrl = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Server did not start. ${errors}`)), 5000);
        const onOutput = () => {
            const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
            if (match) {
                clearTimeout(timeout);
                serverProcess.stdout.off("data", onOutput);
                resolve(match[0]);
            }
        };
        serverProcess.stdout.on("data", onOutput);
        onOutput();
        serverProcess.once("exit", code => {
            clearTimeout(timeout);
            reject(new Error(`Server exited with code ${code}. ${errors}`));
        });
    });

    const homeResponse = await fetch(baseUrl);
    assert.equal(homeResponse.status, 200);
    assert.match(await homeResponse.text(), /Customer Reviews/);

    const invalidResponse = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Test Customer",
            tattooDate: "2024-05-10",
            comments: "A local test review",
            rating: 5,
            consent: false
        })
    });
    assert.equal(invalidResponse.status, 400);

    const pngDataUrl = `data:image/png;base64,${Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]).toString("base64")}`;
    const createResponse = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Test Customer",
            tattooDate: "2024-05-10",
            comments: "A local test review",
            rating: 5,
            consent: true,
            photo: pngDataUrl
        })
    });
    assert.equal(createResponse.status, 201);
    const { review } = await createResponse.json();
    assert.equal(review.name, "Test Customer");
    assert.equal(review.rating, 5);
    assert.equal(review.comments, "A local test review");
    assert.ok(review.photoUrl);

    const listResponse = await fetch(`${baseUrl}/api/reviews`);
    const { reviews } = await listResponse.json();
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].id, review.id);

    const photoResponse = await fetch(new URL(review.photoUrl, baseUrl));
    assert.equal(photoResponse.status, 200);
    assert.equal(photoResponse.headers.get("content-type"), "image/png");
    assert.deepEqual(
        Buffer.from(await photoResponse.arrayBuffer()),
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
});
