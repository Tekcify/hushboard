import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") process.exit(0);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = resolve(root, process.env.CARGO_TARGET_DIR || "target");
const host = execFileSync("rustc", ["-vV"], { encoding: "utf8" }).match(/^host: (.+)$/m)[1];
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || host;
const identity = process.env.APPLE_SIGNING_IDENTITY || "-";
const name = "hushboard-keyhelper";
const out = join(targetDir, "mac-helper");
const bundle = join(out, "Hushboard Keyboard Helper.app");

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });

const build = (target) => {
  run("cargo", ["build", "--release", "-p", "keylock", "--bin", name, "--target", target]);
  return join(targetDir, target, "release", name);
};

mkdirSync(out, { recursive: true });
let exe;
if (triple === "universal-apple-darwin") {
  const parts = ["aarch64-apple-darwin", "x86_64-apple-darwin"].map(build);
  exe = join(out, name);
  run("lipo", ["-create", "-output", exe, ...parts]);
} else {
  exe = build(triple);
}

rmSync(bundle, { recursive: true, force: true });
run(exe, ["--keyhelper-write-bundle", bundle]);

const sign = ["--force", "--sign", identity, "--identifier", "app.hushboard.keyhelper"];
if (identity !== "-") sign.push("--options", "runtime", "--timestamp");
run("codesign", [...sign, bundle]);
run("codesign", ["--verify", "--strict", bundle]);

console.log(`Keyboard helper for ${triple} signed ${identity === "-" ? "ad-hoc" : `with ${identity}`}: ${bundle}`);
