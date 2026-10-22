const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = process.env.WYZE_DATA_DIR || path.join(ROOT, "data");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");
const PHOTOS_DIR = path.join(DATA_DIR, "review-photos");
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const photoTypes = {
    jpeg: { mime: "image/jpeg", extension: "jpg" },
    png: { mime: "image/png", extension: "png" },
    gif: { mime: "image/gif", extension: "gif" },
    webp: { mime: "image/webp", extension: "webp" }
};

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        const contentLength = Number(request.headers["content-length"] || 0);
        if (contentLength > MAX_REQUEST_BYTES) {
            request.resume();
            reject(Object.assign(new Error("Request is too large."), { statusCode: 413 }));
            return;
        }

        const chunks = [];
        let size = 0;

        request.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_REQUEST_BYTES) {
                request.resume();
                reject(Object.assign(new Error("Request is too large."), { statusCode: 413 }));
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
            }
        });
        request.on("error", reject);
    });
}

function normalizeReview(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw Object.assign(new Error("Review data is required."), { statusCode: 400 });
    }

    const name = typeof input.name === "string" ? input.name.trim() : "";
    const comments = typeof input.comments === "string" ? input.comments.trim() : "";
    const rating = Number(input.rating);
    const tattooDate = typeof input.tattooDate === "string" ? input.tattooDate : "";
    const parsedDate = new Date(`${tattooDate}T00:00:00.000Z`);
    const today = new Date().toISOString().slice(0, 10);

    if (name.length < 2 || name.length > 80) {
        throw Object.assign(new Error("Name must be between 2 and 80 characters."), { statusCode: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw Object.assign(new Error("Rating must be from 1 to 5 stars."), { statusCode: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tattooDate) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== tattooDate ||
        tattooDate > today) {
        throw Object.assign(new Error("Enter a valid tattoo date that is not in the future."), { statusCode: 400 });
    }
    if (comments.length < 5 || comments.length > 2000) {
        throw Object.assign(new Error("Comments must be between 5 and 2,000 characters."), { statusCode: 400 });
    }
    if (input.consent !== true) {
        throw Object.assign(new Error("Please confirm that your review may be displayed publicly."), { statusCode: 400 });
    }

    return { name, comments, rating, tattooDate };
}

function decodePhoto(dataUrl) {
    if (dataUrl === undefined || dataUrl === null || dataUrl === "") {
        return null;
    }
    if (typeof dataUrl !== "string") {
        throw Object.assign(new Error("The selected photo is invalid."), { statusCode: 400 });
    }

    const match = dataUrl.match(/^data:image\/(jpeg|png|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) {
        throw Object.assign(new Error("Choose a JPEG, PNG, GIF, or WebP image."), { statusCode: 400 });
    }

    const [, type, encoded] = match;
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > MAX_PHOTO_BYTES || bytes.toString("base64") !== encoded) {
        throw Object.assign(new Error("Photo must be a valid image no larger than 4 MB."), { statusCode: 400 });
    }

    const signatures = {
        jpeg: bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
        png: bytes.length >= 8 && bytes.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ),
        gif: bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)),
        webp: bytes.length >= 12 &&
            bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
    };

    if (!signatures[type]) {
        throw Object.assign(new Error("The selected file does not match its image format."), { statusCode: 400 });
    }

    return { bytes, ...photoTypes[type] };
}

function readReviews() {
    if (!fs.existsSync(REVIEWS_FILE)) {
        return [];
    }
    const reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf8"));
    if (!Array.isArray(reviews)) {
        throw new Error("The local reviews file must contain a JSON array.");
    }
    return reviews;
}

function saveReview(review, photo) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    const photoFile = photo ? `${review.id}.${photo.extension}` : null;
    const temporaryFile = path.join(DATA_DIR, `reviews-${review.id}.tmp`);
    let photoSaved = false;

    try {
        if (photoFile) {
            fs.writeFileSync(path.join(PHOTOS_DIR, photoFile), photo.bytes, { flag: "wx" });
            photoSaved = true;
            review.photoUrl = `/api/review-photos/${photoFile}`;
        }

        const reviews = readReviews();
        reviews.unshift(review);
        fs.writeFileSync(temporaryFile, JSON.stringify(reviews, null, 2), "utf8");
        fs.renameSync(temporaryFile, REVIEWS_FILE);
    } catch (error) {
        fs.rmSync(temporaryFile, { force: true });
        if (photoSaved) {
            fs.rmSync(path.join(PHOTOS_DIR, photoFile), { force: true });
        }
        throw error;
    }
}

function serveStatic(request, response, pathname) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Method not allowed." });
        return;
    }

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        sendJson(response, 400, { error: "Invalid URL path." });
        return;
    }

    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
    const filePath = path.resolve(ROOT, relativePath);
    const relativeToRoot = path.relative(ROOT, filePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot) ||
        filePath === path.resolve(DATA_DIR) ||
        filePath.startsWith(`${path.resolve(DATA_DIR)}${path.sep}`) ||
        ["server.js", "package.json", "package-lock.json"].includes(relativeToRoot.toLowerCase())) {
        sendJson(response, 404, { error: "Not found." });
        return;
    }

    let stats;
    try {
        stats = fs.statSync(filePath);
    } catch {
        sendJson(response, 404, { error: "Not found." });
        return;
    }
    if (!stats.isFile()) {
        sendJson(response, 404, { error: "Not found." });
        return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4"
    };

    response.writeHead(200, {
        "Content-Type": contentTypes[extension] || "application/octet-stream",
        "Content-Length": stats.size,
        "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") {
        response.end();
    } else {
        fs.createReadStream(filePath).pipe(response);
    }
}

function createServer() {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    return http.createServer(async (request, response) => {
        const requestUrl = new URL(request.url, "http://127.0.0.1");
        const { pathname } = requestUrl;

        if (pathname === "/api/reviews" && request.method === "GET") {
            try {
                sendJson(response, 200, { reviews: readReviews() });
            } catch (error) {
                console.error("Could not read local reviews:", error);
                sendJson(response, 500, { error: "Could not load saved reviews." });
            }
            return;
        }

        if (pathname === "/api/reviews" && request.method === "POST") {
            try {
                const input = await readJsonBody(request);
                const fields = normalizeReview(input);
                const photo = decodePhoto(input.photo);
                const id = randomUUID();
                const review = {
                    id,
                    ...fields,
                    photoUrl: null,
                    createdAt: new Date().toISOString()
                };
                saveReview(review, photo);
                sendJson(response, 201, { review });
            } catch (error) {
                const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
                if (statusCode === 500) {
                    console.error("Could not save local review:", error);
                }
                sendJson(response, statusCode, {
                    error: statusCode === 500 ? "Could not save the review." : error.message
                });
            }
            return;
        }

        const photoMatch = pathname.match(/^\/api\/review-photos\/([a-f0-9-]+\.(?:jpg|png|gif|webp))$/i);
        if (photoMatch && (request.method === "GET" || request.method === "HEAD")) {
            const filePath = path.join(PHOTOS_DIR, photoMatch[1]);
            const extension = path.extname(filePath).toLowerCase();
            const mime = {
                ".jpg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp"
            }[extension];
            try {
                const stats = fs.statSync(filePath);
                response.writeHead(200, {
                    "Content-Type": mime,
                    "Content-Length": stats.size,
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff"
                });
                if (request.method === "HEAD") {
                    response.end();
                } else {
                    fs.createReadStream(filePath).pipe(response);
                }
            } catch {
                sendJson(response, 404, { error: "Photo not found." });
            }
            return;
        }

        serveStatic(request, response, pathname);
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000);
    const server = createServer();
    server.listen(port, "127.0.0.1", () => {
        const address = server.address();
        console.log(`Wyze Guyz local review server: http://127.0.0.1:${address.port}`);
    });
}

module.exports = { createServer };
