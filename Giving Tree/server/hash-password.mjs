import { stdin, stdout } from "node:process";
import { hashPassword } from "./security.mjs";

async function readHiddenPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    const lines = [];
    for await (const chunk of stdin) lines.push(chunk);
    return Buffer.concat(lines).toString("utf8").replace(/[\r\n]+$/, "");
  }
  stdout.write("Password (input hidden): ");
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      const character = chunk.toString("utf8");
      if (character === "\u0003") {
        stdin.setRawMode(false);
        stdin.off("data", onData);
        reject(new Error("Cancelled."));
        return;
      }
      if (character === "\r" || character === "\n") {
        stdin.setRawMode(false);
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (character === "\u007f" || character === "\b") {
        value = Array.from(value).slice(0, -1).join("");
        return;
      }
      if (character >= " ") value += character;
    };
    stdin.on("data", onData);
  });
}

const password = await readHiddenPassword();
if (password.length < 14 || password.length > 1024) {
  console.error("Use a password between 14 and 1024 characters.");
  process.exitCode = 1;
} else {
  console.log(hashPassword(password));
}
