// Runs the PHP backend (public/api) and Vite together. Ctrl+C stops both.
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit" });
const php = run("php", ["-S", "127.0.0.1:8787", "-t", "public"]);
const vite = run("npx", ["vite", "--host", ...process.argv.slice(2)]);
const stop = () => { php.kill(); vite.kill(); process.exit(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
php.on("exit", (c) => { if (c) { console.error("PHP server stopped. Is PHP 8.1+ installed?"); vite.kill(); } });
vite.on("exit", stop);
