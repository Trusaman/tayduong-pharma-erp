import { createFileRoute } from "@tanstack/react-router";
import { listBackupSnapshots } from "@/lib/system-maintenance";

export const Route = createFileRoute("/api/system/backups")({
	server: {
		handlers: {
			GET: async () => {
				try {
					const snapshots = await listBackupSnapshots();
					return Response.json({ snapshots });
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Không thể tải danh sách bản sao lưu.";
					return Response.json({ message }, { status: 500 });
				}
			},
		},
	},
});
