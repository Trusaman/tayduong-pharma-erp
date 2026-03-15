import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const usage = [
	"Usage:",
	"  pnpm run backup:restore",
	"  pnpm run backup:restore -- backups/<timestamp>",
	"  pnpm run backup:restore -- --path backups/<timestamp>/snapshot.zip --replace",
].join("\n");

const flagsRequiringValue = new Set([
	"--table",
	"--format",
	"--component",
	"--env-file",
	"--preview-name",
	"--deployment-name",
]);

const parseArgs = () => {
	const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
	const passthroughArgs = [];
	const positionalArgs = [];
	let helpRequested = false;
	let pathArg;

	for (let index = 0; index < rawArgs.length; index += 1) {
		const currentArg = rawArgs[index];
		const nextArg = rawArgs[index + 1];

		if (currentArg === "--help" || currentArg === "-h") {
			helpRequested = true;
			passthroughArgs.push(currentArg);
			continue;
		}

		if (
			(currentArg === "--path" ||
				currentArg === "--file" ||
				currentArg === "--snapshot") &&
			nextArg
		) {
			pathArg = nextArg;
			index += 1;
			continue;
		}

		if (
			currentArg === "--path" ||
			currentArg === "--file" ||
			currentArg === "--snapshot"
		) {
			throw new Error(`Missing value for ${currentArg}.\n${usage}`);
		}

		if (flagsRequiringValue.has(currentArg)) {
			if (!nextArg || nextArg.startsWith("-")) {
				throw new Error(`Missing value for ${currentArg}.\n${usage}`);
			}

			passthroughArgs.push(currentArg, nextArg);
			index += 1;
			continue;
		}

		if (!currentArg.startsWith("-")) {
			positionalArgs.push(currentArg);
			continue;
		}

		passthroughArgs.push(currentArg);
	}

	if (positionalArgs.length > 1) {
		throw new Error(
			`Too many positional arguments: ${positionalArgs.join(" ")}. Use --path <snapshot>.\n${usage}`,
		);
	}

	if (!pathArg && positionalArgs.length === 1) {
		[pathArg] = positionalArgs;
	}

	return { helpRequested, pathArg, passthroughArgs };
};

const resolveLatestSnapshot = async () => {
	const backupsDirectory = resolve(projectRoot, "backups");
	const backupEntries = await readdir(backupsDirectory, {
		withFileTypes: true,
	});
	const snapshotDirectories = backupEntries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((left, right) => right.localeCompare(left));

	for (const directory of snapshotDirectories) {
		const directoryPath = resolve(backupsDirectory, directory);
		const files = await readdir(directoryPath, { withFileTypes: true });
		const zipFile = files
			.filter(
				(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"),
			)
			.map((entry) => entry.name)
			.sort((left, right) => right.localeCompare(left))[0];

		if (zipFile) {
			return resolve(directoryPath, zipFile);
		}
	}

	throw new Error("No backup snapshot (.zip) found in backups/ directory");
};

const resolveSnapshotPath = async (inputPath) => {
	if (!inputPath) {
		return resolveLatestSnapshot();
	}

	const absolutePath = resolve(projectRoot, inputPath);
	const pathStat = await stat(absolutePath);

	if (pathStat.isFile()) {
		return absolutePath;
	}

	if (pathStat.isDirectory()) {
		const files = await readdir(absolutePath, { withFileTypes: true });
		const zipFile = files
			.filter(
				(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"),
			)
			.map((entry) => entry.name)
			.sort((left, right) => right.localeCompare(left))[0];

		if (!zipFile) {
			throw new Error(`No .zip snapshot found in directory: ${absolutePath}`);
		}

		return resolve(absolutePath, zipFile);
	}

	throw new Error(`Invalid snapshot path: ${absolutePath}`);
};

const { helpRequested, pathArg, passthroughArgs } = parseArgs();
const shouldSkipSnapshotResolution = helpRequested && !pathArg;
const snapshotPath = shouldSkipSnapshotResolution
	? undefined
	: await resolveSnapshotPath(pathArg);

console.log("Starting Convex restore...");
if (snapshotPath) {
	console.log(`Snapshot: ${snapshotPath}`);
}

if (shouldSkipSnapshotResolution) {
	console.log("Mode: help");
} else if (!pathArg) {
	console.log("Mode: auto-detect latest snapshot from backups/");
} else {
	console.log("Mode: restore from provided snapshot path");
}

const commandArgs = [
	"--filter",
	"@tayduong-pharma-erp/backend",
	"exec",
	"convex",
	"import",
	...(snapshotPath ? [snapshotPath] : []),
	...passthroughArgs,
];

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

		rejectPromise(new Error(`Restore failed with exit code ${code ?? -1}`));
	});
});

console.log("Restore completed successfully.");
