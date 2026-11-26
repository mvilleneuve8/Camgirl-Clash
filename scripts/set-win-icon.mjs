import { rcedit } from "rcedit";
import path from "node:path";
import { existsSync } from "node:fs";

const exe = path.resolve("release/win-unpacked/Camgirl Clash.exe");
const ico = path.resolve("build/icon.ico");

if (!existsSync(exe)) {
  console.error("Missing packed exe:", exe);
  process.exit(1);
}
if (!existsSync(ico)) {
  console.error("Missing icon:", ico);
  process.exit(1);
}

await rcedit(exe, { icon: ico });
console.log("Embedded icon into", exe);
