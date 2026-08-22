import { spawn } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = pnpmCli
  ? [pnpmCli, "exec", "tsx", "watch", "server/_core/index.ts"]
  : ["exec", "tsx", "watch", "server/_core/index.ts"];

const child = spawn(command, args, {
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "inherit",
});

child.on("exit", code => {
  process.exit(code ?? 0);
});
