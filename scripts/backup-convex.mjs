import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const inputArgs = process.argv.slice(2);
const shouldIncludeStorage = !inputArgs.includes("--no-storage");
const passthroughArgs = inputArgs.filter(
	(arg) => arg !== "--no-storage" && arg !== "--",
);

const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
const outputDirectory = resolve(projectRoot, "backups", timestamp);

await mkdir(outputDirectory, { recursive: true });

const commandArgs = [
	"--filter",
	"@tayduong-pharma-erp/backend",
	"exec",
	"convex",
	"export",
	"--path",
	outputDirectory,
];

if (shouldIncludeStorage) {
	commandArgs.push("--include-file-storage");
}

commandArgs.push(...passthroughArgs);

console.log("Starting Convex backup...");
console.log(`Backup directory: ${outputDirectory}`);
console.log(
	shouldIncludeStorage
		? "Mode: full backup (tables + file storage)"
		: "Mode: data-only backup (tables only)",
);

await new Promise((resolvePromise, rejectPromise) => {
	const npmExecPath = process.env.npm_execpath;
	const command = npmExecPath ? process.execPath : "pnpm";
	const args = npmExecPath ? [npmExecPath, ...commandArgs] : commandArgs;

	const child = spawn(command, args, {
		cwd: projectRoot,
		stdio: "inherit",
	});

	child.on("error", rejectPromise);
	child.on("close", (code) => {
		if (code === 0) {
			resolvePromise();
			return;
		}

		rejectPromise(new Error(`Backup failed with exit code ${code ?? -1}`));
	});
});

console.log("Backup completed successfully.");
console.log(`Saved in: ${outputDirectory}`);
