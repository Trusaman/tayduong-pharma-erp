import { createFileRoute } from "@tanstack/react-router";
import { type DeploymentTarget, runRestore } from "@/lib/system-maintenance";

const toBadRequest = (message: string) =>
	Response.json({ message }, { status: 400 });

const parseTarget = (value: unknown): DeploymentTarget | null => {
	if (value === "development" || value === "production") {
		return value;
	}

	return null;
};

export const Route = createFileRoute("/api/system/restore")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await request.json().catch(() => null);
				const target = parseTarget(body?.target);
				const snapshotPath =
					typeof body?.snapshotPath === "string"
						? body.snapshotPath
						: undefined;

				if (!target) {
					return toBadRequest(
						"Invalid target. Expected 'development' or 'production'.",
					);
				}

				try {
					await runRestore(target, snapshotPath);
					return Response.json({
						message: `Restore completed on ${target}.`,
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Restore command failed.";
					return Response.json({ message }, { status: 500 });
				}
			},
		},
	},
});
