import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const pgBin = "C:\\Program Files\\PostgreSQL\\17\\bin";
const dataDir = path.join(projectRoot, ".local", "postgres");
const dbName = "pintofruta_store";
const dbUser = "postgres";
const dbPort = "5434";

const commands = {
  initdb: path.join(pgBin, "initdb.exe"),
  pgCtl: path.join(pgBin, "pg_ctl.exe"),
  psql: path.join(pgBin, "psql.exe"),
};

const pgVersionFile = path.join(dataDir, "PG_VERSION");
const logFile = path.join(dataDir, "postgres.log");

function ensureWorkspacePath(targetPath) {
  const workspaceRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(workspaceRoot)) {
    throw new Error(`Refusing to touch path outside workspace: ${resolvedTarget}`);
  }
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

function isInitialized() {
  return fs.existsSync(pgVersionFile);
}

function initCluster() {
  if (isInitialized()) {
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  run(commands.initdb, ["-D", dataDir, "-U", dbUser, "-A", "trust", "-E", "UTF8"]);
}

function startCluster() {
  initCluster();
  run(commands.pgCtl, ["start", "-D", dataDir, "-l", logFile, "-o", `-p ${dbPort}`, "-w"]);
  ensureDatabase();
}

function stopCluster() {
  if (!isInitialized()) {
    console.log("Local PostgreSQL no está inicializado.");
    return;
  }

  try {
    run(commands.pgCtl, ["stop", "-D", dataDir, "-m", "fast", "-w"]);
  } catch {
    console.log("No pude detener el cluster desde pg_ctl. Puede que ya estuviera apagado.");
  }
}

function getStatus() {
  if (!isInitialized()) {
    console.log("Cluster local no inicializado.");
    return;
  }

  try {
    run(commands.pgCtl, ["status", "-D", dataDir]);
  } catch {
    console.log("Cluster local detenido.");
  }
}

function ensureDatabase() {
  const output = execFileSync(
    commands.psql,
    ["-p", dbPort, "-U", dbUser, "-d", "postgres", "-Atc", `select 1 from pg_database where datname = '${dbName}'`],
    { encoding: "utf8" },
  ).trim();

  if (output === "1") {
    return;
  }

  run(commands.psql, [
    "-p",
    dbPort,
    "-U",
    dbUser,
    "-d",
    "postgres",
    "-c",
    `create database ${dbName}`,
  ]);
}

function resetCluster() {
  stopCluster();
  ensureWorkspacePath(dataDir);
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log("Cluster local eliminado.");
}

const action = process.argv[2];

switch (action) {
  case "start":
    startCluster();
    break;
  case "stop":
    stopCluster();
    break;
  case "status":
    getStatus();
    break;
  case "reset":
    resetCluster();
    break;
  default:
    console.log("Uso: node scripts/local-postgres.mjs <start|stop|status|reset>");
    process.exitCode = 1;
}
