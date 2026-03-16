import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type DeploymentTarget = "development" | "production";

export interface BackupSnapshot {
	path: string;
	directory: string;
	fileName: string;
}

interface CommandResult {
	output: string;
}

interface CommandLauncher {
	command: string;
	prefixArgs: string[];
}

const hasProjectRootMarkers = (directory: string) =>
	existsSync(resolve(directory, "scripts", "backup-convex.mjs")) &&
	existsSync(resolve(directory, "package.json"));

const findProjectRoot = () => {
	const searchRoots = [process.cwd(), dirname(fileURLToPath(import.meta.url))];

	for (const root of searchRoots) {
		let currentDirectory = resolve(root);

		while (true) {
			if (hasProjectRootMarkers(currentDirectory)) {
				return currentDirectory;
			}

			const parentDirectory = dirname(currentDirectory);
			if (parentDirectory === currentDirectory) {
				break;
			}

			currentDirectory = parentDirectory;
		}
	}

	throw new Error("Không thể xác định thư mục gốc của dự án.");
};

const projectRoot = findProjectRoot();
const backupsRoot = resolve(projectRoot, "backups");

const ensureSuccess = (code: number | null, output: string, action: string) => {
	if (code === 0) {
		return;
	}

	const suffix = output.trim().length > 0 ? `\n${output}` : "";
	throw new Error(`${action} failed with exit code ${code ?? -1}.${suffix}`);
};

const getCommandLaunchers = (): CommandLauncher[] => {
	const launchers: CommandLauncher[] = [];
	const seen = new Set<string>();
	const addLauncher = (command: string, prefixArgs: string[] = []) => {
		const key = `${command}::${prefixArgs.join("|")}`;
		if (seen.has(key)) {
			return;
		}

		seen.add(key);
		launchers.push({ command, prefixArgs });
	};

	if (process.env.npm_execpath) {
		addLauncher(process.execPath, [process.env.npm_execpath]);
	}

	if (process.platform === "win32") {
		const candidatePaths = [
			process.env.PNPM_HOME
				? resolve(process.env.PNPM_HOME, "pnpm.cmd")
				: undefined,
			process.env.APPDATA
				? resolve(process.env.APPDATA, "npm", "pnpm.cmd")
				: undefined,
			process.env.LOCALAPPDATA
				? resolve(process.env.LOCALAPPDATA, "pnpm", "pnpm.cmd")
				: undefined,
		].filter((value): value is string => typeof value === "string");

		for (const candidatePath of candidatePaths) {
			if (existsSync(candidatePath)) {
				addLauncher(candidatePath);
			}
		}

		addLauncher("pnpm.cmd");
	}

	addLauncher("pnpm");

	return launchers;
};

const executeCommand = async (
	launcher: CommandLauncher,
	args: string[],
	actionLabel: string,
): Promise<CommandResult> => {
	const combinedOutput: string[] = [];

	return await new Promise<CommandResult>((resolvePromise, rejectPromise) => {
		const child = spawn(launcher.command, [...launcher.prefixArgs, ...args], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
		});

		child.stdout.on("data", (chunk) => {
			combinedOutput.push(String(chunk));
		});

		child.stderr.on("data", (chunk) => {
			combinedOutput.push(String(chunk));
		});

		child.on("error", (error) => {
			rejectPromise(
				new Error(`${actionLabel} failed to start: ${error.message}`),
			);
		});

		child.on("close", (code) => {
			const output = combinedOutput.join("");
			try {
				ensureSuccess(code, output, actionLabel);
				resolvePromise({ output });
			} catch (error) {
				rejectPromise(error);
			}
		});
	});
};

const runPnpmCommand = async (
	args: string[],
	actionLabel: string,
): Promise<CommandResult> => {
	let lastError: Error | null = null;

	for (const launcher of getCommandLaunchers()) {
		try {
			return await executeCommand(launcher, args, actionLabel);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("failed to start") &&
				error.message.includes("ENOENT")
			) {
				lastError = error;
				continue;
			}

			throw error;
		}
	}

	throw (
		lastError ??
		new Error(`${actionLabel} failed to start: no pnpm launcher was available.`)
	);
};

const withTargetArgs = (target: DeploymentTarget): string[] =>
	target === "production" ? ["--prod"] : [];

export const runBackup = async (target: DeploymentTarget) => {
	const commandArgs = ["run", "backup", "--", ...withTargetArgs(target)];
	const { output } = await runPnpmCommand(commandArgs, "Backup");
	const savedInLine = output
		.split("\n")
		.find((line) => line.includes("Saved in:"))
		?.trim();

	return {
		output,
		savedInLine,
	};
};

export const runRestore = async (
	target: DeploymentTarget,
	snapshotPath?: string,
) => {
	const commandArgs = ["run", "backup:restore", "--"];

	if (snapshotPath && snapshotPath.trim().length > 0) {
		commandArgs.push(snapshotPath.trim());
	}

	commandArgs.push(...withTargetArgs(target));

	const { output } = await runPnpmCommand(commandArgs, "Restore");

	return { output };
};

export const listBackupSnapshots = async (
	limit = 20,
): Promise<BackupSnapshot[]> => {
	try {
		const entries = await readdir(backupsRoot, { withFileTypes: true });
		const directories = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort((left, right) => right.localeCompare(left));

		const snapshots: BackupSnapshot[] = [];

		for (const directory of directories) {
			const directoryPath = resolve(backupsRoot, directory);
			const files = await readdir(directoryPath, { withFileTypes: true });
			const zipFiles = files
				.filter(
					(entry) =>
						entry.isFile() && entry.name.toLowerCase().endsWith(".zip"),
				)
				.map((entry) => entry.name)
				.sort((left, right) => right.localeCompare(left));

			for (const fileName of zipFiles) {
				snapshots.push({
					path: resolve(directoryPath, fileName),
					directory,
					fileName,
				});

				if (snapshots.length >= limit) {
					return snapshots;
				}
			}
		}

		return snapshots;
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return [];
		}

		throw error;
	}
};
