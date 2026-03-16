import { createFileRoute } from "@tanstack/react-router";
import { type DeploymentTarget, runBackup } from "@/lib/system-maintenance";

const toBadRequest = (message: string) =>
	Response.json({ message }, { status: 400 });

const parseTarget = (value: unknown): DeploymentTarget | null => {
	if (value === "development" || value === "production") {
		return value;
	}

	return null;
};

export const Route = createFileRoute("/api/system/backup")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await request.json().catch(() => null);
				const target = parseTarget(body?.target);

				if (!target) {
					return toBadRequest(
						"Deployment không hợp lệ. Chỉ chấp nhận development hoặc production.",
					);
				}

				try {
					const result = await runBackup(target);
					return Response.json({
						message: `Đã sao lưu dữ liệu trên môi trường ${target}.`,
						savedInLine: result.savedInLine,
					});
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Lệnh sao lưu dữ liệu thất bại.";
					return Response.json({ message }, { status: 500 });
				}
			},
		},
	},
});
