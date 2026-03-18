import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
	Download,
	History,
	KeyRound,
	Pencil,
	ShieldCheck,
	Trash2,
	TriangleAlert,
	UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin-users")({
	component: AdminUsersPage,
});

type AdminManagedUser = {
	id?: string;
	userId?: string;
	name?: string;
	email?: string;
	role?: string | string[];
	createdAt?: number;
};

type ListUsersResponse = {
	users?: AdminManagedUser[];
	total?: number;
};

type AdminAuditLog = {
	id?: string;
	action: string;
	description: string;
	entityType?: string;
	entityId?: string;
	actorUserId?: string;
	actorEmail?: string;
	before?: unknown;
	after?: unknown;
	metadata?: unknown;
	createdAt: number;
};

const AUDIT_LOG_WORKBOOK_COLUMNS = {
	time: "Thời gian",
	actor: "Người thực hiện",
	action: "Hành động",
	description: "Mô tả",
	entityType: "Entity type",
	entityId: "Entity id",
	before: "Before",
	after: "After",
	metadata: "Metadata",
} as const;

const AUDIT_LOG_WORKBOOK_HEADER_ORDER = [
	AUDIT_LOG_WORKBOOK_COLUMNS.time,
	AUDIT_LOG_WORKBOOK_COLUMNS.actor,
	AUDIT_LOG_WORKBOOK_COLUMNS.action,
	AUDIT_LOG_WORKBOOK_COLUMNS.description,
	AUDIT_LOG_WORKBOOK_COLUMNS.entityType,
	AUDIT_LOG_WORKBOOK_COLUMNS.entityId,
	AUDIT_LOG_WORKBOOK_COLUMNS.before,
	AUDIT_LOG_WORKBOOK_COLUMNS.after,
	AUDIT_LOG_WORKBOOK_COLUMNS.metadata,
] as const;

const AUDIT_ENTITY_TYPE_OPTIONS = [
	{ value: "all", label: "Tất cả phân hệ" },
	{ value: "user", label: "Quản trị user" },
	{ value: "customer", label: "Khách hàng" },
	{ value: "product", label: "Sản phẩm" },
	{ value: "supplier", label: "Nhà cung cấp" },
] as const;

const AUDIT_ACTION_PREFIX_OPTIONS = [
	{ value: "all", label: "Tất cả hành động" },
	{ value: "user.", label: "Nhóm user" },
	{ value: "customer.", label: "Nhóm khách hàng" },
	{ value: "product.", label: "Nhóm sản phẩm" },
	{ value: "supplier.", label: "Nhóm nhà cung cấp" },
] as const;

type UserRole = "admin" | "user";

function getErrorMessage(error: unknown, fallback: string) {
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return fallback;
}

function getUserId(user: AdminManagedUser) {
	return user.id ?? user.userId ?? "";
}

function formatCreatedAt(createdAt: number | undefined) {
	if (!createdAt) return "-";
	return new Date(createdAt).toLocaleString("vi-VN");
}

function formatAuditAction(action: string) {
	switch (action) {
		case "user.created":
			return "Tạo user";
		case "user.updated":
			return "Sửa user";
		case "user.deleted":
			return "Xóa user";
		case "user.role_changed":
			return "Đổi quyền";
		case "user.password_changed":
			return "Đổi mật khẩu";
		case "customer.created":
			return "Tạo khách hàng";
		case "customer.updated":
			return "Sửa khách hàng";
		case "customer.deleted":
			return "Xóa khách hàng";
		case "customer.imported":
			return "Import khách hàng";
		case "product.created":
			return "Tạo sản phẩm";
		case "product.updated":
			return "Sửa sản phẩm";
		case "product.deleted":
			return "Xóa sản phẩm";
		case "supplier.created":
			return "Tạo nhà cung cấp";
		case "supplier.updated":
			return "Sửa nhà cung cấp";
		case "supplier.deleted":
			return "Xóa nhà cung cấp";
		default:
			return action;
	}
}

function formatAuditEntityType(entityType: string | undefined) {
	switch (entityType) {
		case "user":
			return "Quản trị user";
		case "customer":
			return "Khách hàng";
		case "product":
			return "Sản phẩm";
		case "supplier":
			return "Nhà cung cấp";
		default:
			return entityType ?? "-";
	}
}

function getDateFilterTimestamp(value: string, boundary: "start" | "end") {
	if (!value) {
		return undefined;
	}

	const [year, month, day] = value.split("-").map(Number);
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	) {
		return undefined;
	}

	return boundary === "start"
		? new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
		: new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function AdminUsersPage() {
	const isCurrentUserAdmin = useQuery(api.auth.isCurrentUserAdmin);
	const bootstrapAdminRole = useMutation(api.auth.bootstrapAdminRole);
	const adminCreateUser = useMutation(api.auth.adminCreateUser);
	const adminListUsers = useMutation(api.auth.adminListUsers);
	const adminUpdateUser = useMutation(api.auth.adminUpdateUser);
	const adminDeleteUser = useMutation(api.auth.adminDeleteUser);
	const adminSetUserRole = useMutation(api.auth.adminSetUserRole);
	const adminSetUserPassword = useMutation(api.auth.adminSetUserPassword);
	const roleOverrides = useQuery(
		api.auth.adminGetUserRoleOverrides,
		isCurrentUserAdmin ? {} : "skip",
	);
	const [auditFromDate, setAuditFromDate] = useState("");
	const [auditToDate, setAuditToDate] = useState("");
	const [auditEntityType, setAuditEntityType] = useState<string>("all");
	const [auditActionPrefix, setAuditActionPrefix] = useState<string>("all");
	const [isExportingAuditLogs, setIsExportingAuditLogs] = useState(false);

	const auditFromTs = useMemo(
		() => getDateFilterTimestamp(auditFromDate, "start"),
		[auditFromDate],
	);
	const auditToTs = useMemo(
		() => getDateFilterTimestamp(auditToDate, "end"),
		[auditToDate],
	);
	const isAuditRangeInvalid =
		auditFromTs !== undefined &&
		auditToTs !== undefined &&
		auditFromTs > auditToTs;

	const auditLogs = useQuery(
		api.auth.adminListAuditLogs,
		isCurrentUserAdmin && !isAuditRangeInvalid
			? {
					limit: 300,
					fromTs: auditFromTs,
					toTs: auditToTs,
					entityType: auditEntityType === "all" ? undefined : auditEntityType,
					actionPrefix:
						auditActionPrefix === "all" ? undefined : auditActionPrefix,
				}
			: "skip",
	);

	const [users, setUsers] = useState<AdminManagedUser[]>([]);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [search, setSearch] = useState("");
	const [auditSearch, setAuditSearch] = useState("");

	const [createName, setCreateName] = useState("");
	const [createEmail, setCreateEmail] = useState("");
	const [createPassword, setCreatePassword] = useState("");
	const [createRole, setCreateRole] = useState<UserRole>("user");
	const [isCreating, setIsCreating] = useState(false);
	const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(
		null,
	);
	const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
	const [pendingDeleteUser, setPendingDeleteUser] =
		useState<AdminManagedUser | null>(null);
	const [pendingRoleChange, setPendingRoleChange] = useState<{
		user: AdminManagedUser;
		currentRole: UserRole;
		nextRole: UserRole;
	} | null>(null);

	const [editingUser, setEditingUser] = useState<AdminManagedUser | null>(null);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [isUpdatingUser, setIsUpdatingUser] = useState(false);

	const [passwordDialogUser, setPasswordDialogUser] =
		useState<AdminManagedUser | null>(null);
	const [newPassword, setNewPassword] = useState("");
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	const loadUsers = useCallback(
		async (allowBootstrapRetry = true) => {
			const runLoadUsers = async (allowRetry: boolean): Promise<void> => {
				setIsLoadingUsers(true);
				try {
					const payload = (await adminListUsers({
						limit: 200,
					})) as ListUsersResponse;
					setUsers(payload.users ?? []);
				} catch (error: unknown) {
					const message = getErrorMessage(
						error,
						"Không thể tải danh sách người dùng",
					);
					if (allowRetry) {
						try {
							await bootstrapAdminRole({});
							await runLoadUsers(false);
							return;
						} catch (bootstrapError: unknown) {
							toast.error(
								getErrorMessage(bootstrapError, "Không thể gán quyền admin"),
							);
						}
					}

					toast.error(message);
				} finally {
					setIsLoadingUsers(false);
				}
			};

			await runLoadUsers(allowBootstrapRetry);
		},
		[adminListUsers, bootstrapAdminRole],
	);

	useEffect(() => {
		if (!isCurrentUserAdmin) {
			return;
		}

		let cancelled = false;
		const run = async () => {
			try {
				if (!cancelled) {
					await loadUsers();
				}
			} catch (error: unknown) {
				if (!cancelled) {
					toast.error(getErrorMessage(error, "Không thể tải dữ liệu quản trị"));
				}
			}
		};

		void run();

		return () => {
			cancelled = true;
		};
	}, [isCurrentUserAdmin, loadUsers]);

	const filteredUsers = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		if (!keyword) {
			return users;
		}

		return users.filter((user) => {
			const name = (user.name ?? "").toLowerCase();
			const email = (user.email ?? "").toLowerCase();
			return name.includes(keyword) || email.includes(keyword);
		});
	}, [search, users]);

	const filteredAuditLogs = useMemo(() => {
		const source = (auditLogs ?? []) as AdminAuditLog[];
		const keyword = auditSearch.trim().toLowerCase();
		if (!keyword) {
			return source;
		}

		return source.filter((logItem) => {
			const actor = (
				logItem.actorEmail ??
				logItem.actorUserId ??
				""
			).toLowerCase();
			const description = (logItem.description ?? "").toLowerCase();
			const action = formatAuditAction(logItem.action).toLowerCase();
			return (
				actor.includes(keyword) ||
				description.includes(keyword) ||
				action.includes(keyword)
			);
		});
	}, [auditLogs, auditSearch]);

	const roleByUserId = useMemo(
		() =>
			new Map((roleOverrides ?? []).map((item) => [item.userId, item.role])),
		[roleOverrides],
	);

	const getEffectiveRole = (user: AdminManagedUser): UserRole => {
		const userId = getUserId(user);
		const overrideRole = userId ? roleByUserId.get(userId) : undefined;
		if (overrideRole === "admin" || overrideRole === "user") {
			return overrideRole;
		}

		if (typeof user.role === "string") {
			return user.role === "admin" ? "admin" : "user";
		}

		if (Array.isArray(user.role)) {
			return user.role.includes("admin") ? "admin" : "user";
		}

		return "user";
	};

	const handleCreateUser = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!createName.trim() || !createEmail.trim() || !createPassword.trim()) {
			toast.error("Vui lòng nhập đầy đủ họ tên, email và mật khẩu");
			return;
		}

		if (createPassword.length < 8) {
			toast.error("Mật khẩu phải có ít nhất 8 ký tự");
			return;
		}

		setIsCreating(true);
		try {
			await adminCreateUser({
				name: createName.trim(),
				email: createEmail.trim().toLowerCase(),
				password: createPassword,
				role: createRole,
			});
			toast.success("Đã tạo người dùng mới");
			setCreateName("");
			setCreateEmail("");
			setCreatePassword("");
			setCreateRole("user");
			await loadUsers();
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể tạo người dùng"));
		} finally {
			setIsCreating(false);
		}
	};

	const handleOpenEditUser = (user: AdminManagedUser) => {
		setEditingUser(user);
		setEditName(user.name ?? "");
		setEditEmail(user.email ?? "");
	};

	const handleUpdateUser = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!editingUser) {
			return;
		}

		const userId = getUserId(editingUser);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return;
		}

		if (!editName.trim() || !editEmail.trim()) {
			toast.error("Vui lòng nhập đầy đủ họ tên và email");
			return;
		}

		setIsUpdatingUser(true);
		try {
			await adminUpdateUser({
				userId,
				name: editName.trim(),
				email: editEmail.trim().toLowerCase(),
			});
			toast.success("Đã cập nhật thông tin người dùng");
			setEditingUser(null);
			await loadUsers();
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể cập nhật người dùng"));
		} finally {
			setIsUpdatingUser(false);
		}
	};

	const handleRequestDeleteUser = (user: AdminManagedUser) => {
		const userId = getUserId(user);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return;
		}

		setPendingDeleteUser(user);
	};

	const handleDeleteUser = async () => {
		if (!pendingDeleteUser) {
			return;
		}

		const userId = getUserId(pendingDeleteUser);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			setPendingDeleteUser(null);
			return;
		}

		setDeletingUserId(userId);
		try {
			await adminDeleteUser({ userId });
			toast.success("Đã xóa người dùng");
			setPendingDeleteUser(null);
			await loadUsers(false);
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể xóa người dùng"));
		} finally {
			setDeletingUserId(null);
		}
	};

	const handleRequestRoleChange = (
		user: AdminManagedUser,
		nextRole: UserRole,
	) => {
		const userId = getUserId(user);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return;
		}

		const currentRole = getEffectiveRole(user);
		if (nextRole === currentRole) {
			return;
		}

		setPendingRoleChange({
			user,
			currentRole,
			nextRole,
		});
	};

	const handleChangeUserRole = async (
		user: AdminManagedUser,
		nextRole: UserRole,
	) => {
		const userId = getUserId(user);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return false;
		}

		setChangingRoleUserId(userId);
		try {
			await adminSetUserRole({ userId, role: nextRole });
			toast.success("Đã cập nhật quyền người dùng");
			return true;
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể cập nhật quyền"));
			return false;
		} finally {
			setChangingRoleUserId(null);
		}
	};

	const handleConfirmRoleChange = async () => {
		if (!pendingRoleChange) {
			return;
		}

		const updated = await handleChangeUserRole(
			pendingRoleChange.user,
			pendingRoleChange.nextRole,
		);
		if (updated) {
			setPendingRoleChange(null);
		}
	};

	const handleSetPassword = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!passwordDialogUser) return;

		const userId = getUserId(passwordDialogUser);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return;
		}

		if (newPassword.trim().length < 8) {
			toast.error("Mật khẩu mới phải có ít nhất 8 ký tự");
			return;
		}

		setIsChangingPassword(true);
		try {
			await adminSetUserPassword({
				userId,
				newPassword: newPassword.trim(),
			});
			toast.success("Đã cập nhật mật khẩu người dùng");
			setPasswordDialogUser(null);
			setNewPassword("");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể đổi mật khẩu"));
		} finally {
			setIsChangingPassword(false);
		}
	};

	const handleExportAuditLogs = async () => {
		if (isAuditRangeInvalid) {
			toast.error("Khoảng thời gian lọc không hợp lệ");
			return;
		}

		if (filteredAuditLogs.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}

		setIsExportingAuditLogs(true);
		try {
			const XLSX = await import("xlsx");
			const rows = filteredAuditLogs.map((logItem) => ({
				[AUDIT_LOG_WORKBOOK_COLUMNS.time]: formatCreatedAt(logItem.createdAt),
				[AUDIT_LOG_WORKBOOK_COLUMNS.actor]:
					logItem.actorEmail ?? logItem.actorUserId ?? "-",
				[AUDIT_LOG_WORKBOOK_COLUMNS.action]: formatAuditAction(logItem.action),
				[AUDIT_LOG_WORKBOOK_COLUMNS.description]: logItem.description,
				[AUDIT_LOG_WORKBOOK_COLUMNS.entityType]: formatAuditEntityType(
					logItem.entityType,
				),
				[AUDIT_LOG_WORKBOOK_COLUMNS.entityId]: logItem.entityId ?? "",
				[AUDIT_LOG_WORKBOOK_COLUMNS.before]: logItem.before
					? JSON.stringify(logItem.before)
					: "",
				[AUDIT_LOG_WORKBOOK_COLUMNS.after]: logItem.after
					? JSON.stringify(logItem.after)
					: "",
				[AUDIT_LOG_WORKBOOK_COLUMNS.metadata]: logItem.metadata
					? JSON.stringify(logItem.metadata)
					: "",
			}));

			const worksheet = XLSX.utils.json_to_sheet(rows, {
				header: [...AUDIT_LOG_WORKBOOK_HEADER_ORDER],
			});
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Audit_Logs");

			const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
			const blob = new Blob([output], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "nhat-ky-thay-doi.xlsx";
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			toast.success("Đã xuất file nhật ký thay đổi");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể xuất file nhật ký"));
		} finally {
			setIsExportingAuditLogs(false);
		}
	};

	if (isCurrentUserAdmin === undefined) {
		return (
			<div className="space-y-4">
				<h2 className="font-bold text-2xl tracking-tight">
					Quản trị người dùng
				</h2>
				<p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
			</div>
		);
	}

	if (!isCurrentUserAdmin) {
		return (
			<div className="space-y-4">
				<h2 className="font-bold text-2xl tracking-tight">
					Quản trị người dùng
				</h2>
				<Card>
					<CardContent className="py-8 text-center">
						<p className="font-medium text-lg">Bạn không có quyền truy cập</p>
						<p className="mt-2 text-muted-foreground text-sm">
							Chỉ tài khoản admin mới có thể quản lý người dùng.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl tracking-tight">
					Quản trị người dùng
				</h2>
				<p className="text-muted-foreground">
					Chỉ admin mới được tạo người dùng và thay đổi mật khẩu.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-5">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<UserPlus className="h-5 w-5" />
							Tạo người dùng mới
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleCreateUser} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="create-name">Họ tên</Label>
								<Input
									id="create-name"
									value={createName}
									onChange={(event) => setCreateName(event.target.value)}
									placeholder="Ví dụ: Nguyễn Văn A"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-email">Email</Label>
								<Input
									id="create-email"
									type="email"
									value={createEmail}
									onChange={(event) => setCreateEmail(event.target.value)}
									placeholder="user@tayduong.com"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-password">Mật khẩu</Label>
								<Input
									id="create-password"
									type="password"
									value={createPassword}
									onChange={(event) => setCreatePassword(event.target.value)}
									placeholder="Tối thiểu 8 ký tự"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label>Quyền</Label>
								<Select
									value={createRole}
									onValueChange={(value) => setCreateRole(value as UserRole)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="user">User</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Button type="submit" className="w-full" disabled={isCreating}>
								{isCreating ? "Đang tạo..." : "Tạo người dùng"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card className="lg:col-span-3">
					<CardHeader className="gap-3">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2">
								<ShieldCheck className="h-5 w-5" />
								Danh sách người dùng
							</CardTitle>
							<Button variant="outline" onClick={() => void loadUsers()}>
								Làm mới
							</Button>
						</div>
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Tìm theo tên hoặc email"
						/>
					</CardHeader>
					<CardContent>
						{isLoadingUsers ? (
							<p className="py-6 text-center text-muted-foreground">
								Đang tải danh sách người dùng...
							</p>
						) : filteredUsers.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground">
								Không có người dùng phù hợp.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Họ tên</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Quyền</TableHead>
										<TableHead>Tạo lúc</TableHead>
										<TableHead className="text-right">Thao tác</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredUsers.map((user) => (
										<TableRow key={getUserId(user) || user.email || user.name}>
											<TableCell className="font-medium">
												{user.name ?? "-"}
											</TableCell>
											<TableCell>{user.email ?? "-"}</TableCell>
											<TableCell>
												<Select
													value={getEffectiveRole(user)}
													onValueChange={(value) =>
														handleRequestRoleChange(user, value as UserRole)
													}
													disabled={changingRoleUserId === getUserId(user)}
												>
													<SelectTrigger className="h-8 w-[120px]">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="user">User</SelectItem>
														<SelectItem value="admin">Admin</SelectItem>
													</SelectContent>
												</Select>
											</TableCell>
											<TableCell>{formatCreatedAt(user.createdAt)}</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleOpenEditUser(user)}
													>
														<Pencil className="mr-2 h-4 w-4" />
														Sửa
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															setPasswordDialogUser(user);
															setNewPassword("");
														}}
													>
														<KeyRound className="mr-2 h-4 w-4" />
														Mật khẩu
													</Button>
													<Button
														variant="destructive"
														size="sm"
														disabled={deletingUserId === getUserId(user)}
														onClick={() => handleRequestDeleteUser(user)}
													>
														<Trash2 className="mr-2 h-4 w-4" />
														{deletingUserId === getUserId(user)
															? "Đang xóa"
															: "Xóa"}
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="gap-3">
					<CardTitle className="flex items-center gap-2">
						<History className="h-5 w-5" />
						Nhật ký thay đổi
					</CardTitle>
					<div className="flex flex-wrap items-end gap-3">
						<div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
							<div className="space-y-1">
								<Label htmlFor="audit-log-from-date" className="text-xs">
									Từ ngày
								</Label>
								<Input
									id="audit-log-from-date"
									type="date"
									value={auditFromDate}
									onChange={(event) => setAuditFromDate(event.target.value)}
									max={auditToDate || undefined}
									className="w-full sm:w-44"
								/>
							</div>
							<div className="space-y-1">
								<Label htmlFor="audit-log-to-date" className="text-xs">
									Đến ngày
								</Label>
								<Input
									id="audit-log-to-date"
									type="date"
									value={auditToDate}
									onChange={(event) => setAuditToDate(event.target.value)}
									min={auditFromDate || undefined}
									className="w-full sm:w-44"
								/>
							</div>
						</div>
						<div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
							<div className="space-y-1">
								<Label className="text-xs">Phân hệ</Label>
								<Select
									value={auditEntityType}
									onValueChange={(value) => setAuditEntityType(value ?? "all")}
								>
									<SelectTrigger className="w-full sm:w-44">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{AUDIT_ENTITY_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<Label className="text-xs">Nhóm hành động</Label>
								<Select
									value={auditActionPrefix}
									onValueChange={(value) =>
										setAuditActionPrefix(value ?? "all")
									}
								>
									<SelectTrigger className="w-full sm:w-44">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{AUDIT_ACTION_PREFIX_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						{(auditFromDate ||
							auditToDate ||
							auditEntityType !== "all" ||
							auditActionPrefix !== "all") && (
							<Button
								variant="outline"
								onClick={() => {
									setAuditFromDate("");
									setAuditToDate("");
									setAuditEntityType("all");
									setAuditActionPrefix("all");
								}}
							>
								Xóa bộ lọc
							</Button>
						)}
						<Button
							variant="outline"
							onClick={() => void handleExportAuditLogs()}
							disabled={
								isExportingAuditLogs ||
								filteredAuditLogs.length === 0 ||
								isAuditRangeInvalid
							}
						>
							<Download className="mr-2 h-4 w-4" />
							{isExportingAuditLogs ? "Đang xuất..." : "Xuất Excel"}
						</Button>
					</div>
					<Input
						value={auditSearch}
						onChange={(event) => setAuditSearch(event.target.value)}
						placeholder="Tìm theo hành động, người thực hiện hoặc mô tả"
					/>
				</CardHeader>
				<CardContent>
					{isAuditRangeInvalid ? (
						<p className="py-6 text-center text-muted-foreground">
							Khoảng thời gian không hợp lệ. Vui lòng chọn lại từ ngày/đến ngày.
						</p>
					) : auditLogs === undefined ? (
						<p className="py-6 text-center text-muted-foreground">
							Đang tải nhật ký thay đổi...
						</p>
					) : filteredAuditLogs.length === 0 ? (
						<p className="py-6 text-center text-muted-foreground">
							Chưa có bản ghi phù hợp.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Thời gian</TableHead>
									<TableHead>Phân hệ</TableHead>
									<TableHead>Người thực hiện</TableHead>
									<TableHead>Hành động</TableHead>
									<TableHead>Mô tả</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredAuditLogs.map((logItem) => (
									<TableRow
										key={
											logItem.id ??
											`${logItem.createdAt}-${logItem.action}-${logItem.entityId ?? "unknown"}`
										}
									>
										<TableCell>{formatCreatedAt(logItem.createdAt)}</TableCell>
										<TableCell>
											{formatAuditEntityType(logItem.entityType)}
										</TableCell>
										<TableCell>
											{logItem.actorEmail ?? logItem.actorUserId ?? "-"}
										</TableCell>
										<TableCell>
											<span className="inline-flex rounded bg-muted px-2 py-0.5 font-medium text-xs">
												{formatAuditAction(logItem.action)}
											</span>
										</TableCell>
										<TableCell>{logItem.description}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={!!editingUser}
				onOpenChange={(open) => {
					if (!open) {
						setEditingUser(null);
					}
				}}
			>
				<DialogContent>
					<form onSubmit={handleUpdateUser} className="space-y-4">
						<DialogHeader>
							<DialogTitle>Cập nhật người dùng</DialogTitle>
							<DialogDescription>
								Chỉnh sửa thông tin cơ bản của người dùng.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-2">
							<Label htmlFor="edit-name">Họ tên</Label>
							<Input
								id="edit-name"
								value={editName}
								onChange={(event) => setEditName(event.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-email">Email</Label>
							<Input
								id="edit-email"
								type="email"
								value={editEmail}
								onChange={(event) => setEditEmail(event.target.value)}
								required
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setEditingUser(null)}
							>
								Hủy
							</Button>
							<Button type="submit" disabled={isUpdatingUser}>
								{isUpdatingUser ? "Đang cập nhật..." : "Lưu thay đổi"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!passwordDialogUser}
				onOpenChange={(open) => {
					if (!open) {
						setPasswordDialogUser(null);
						setNewPassword("");
					}
				}}
			>
				<DialogContent>
					<form onSubmit={handleSetPassword} className="space-y-4">
						<DialogHeader>
							<DialogTitle>Đổi mật khẩu người dùng</DialogTitle>
							<DialogDescription>
								{passwordDialogUser?.email
									? `Đang đổi mật khẩu cho ${passwordDialogUser.email}`
									: "Nhập mật khẩu mới"}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-2">
							<Label htmlFor="new-password">Mật khẩu mới</Label>
							<Input
								id="new-password"
								type="password"
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
								placeholder="Tối thiểu 8 ký tự"
								required
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setPasswordDialogUser(null);
									setNewPassword("");
								}}
							>
								Hủy
							</Button>
							<Button type="submit" disabled={isChangingPassword}>
								{isChangingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!pendingRoleChange}
				onOpenChange={(open) => {
					if (!open && !changingRoleUserId) {
						setPendingRoleChange(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-amber-100 text-amber-700">
							<TriangleAlert className="h-5 w-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Xác nhận thay đổi quyền</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingRoleChange
								? `Bạn sắp đổi quyền của ${pendingRoleChange.user.email ?? pendingRoleChange.user.name ?? getUserId(pendingRoleChange.user)} từ ${pendingRoleChange.currentRole} sang ${pendingRoleChange.nextRole}.`
								: "Xác nhận thay đổi quyền người dùng."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={!!changingRoleUserId}>
							Hủy
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								void handleConfirmRoleChange();
							}}
							disabled={!!changingRoleUserId}
						>
							{changingRoleUserId ? "Đang cập nhật..." : "Xác nhận thay đổi"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!pendingDeleteUser}
				onOpenChange={(open) => {
					if (!open && !deletingUserId) {
						setPendingDeleteUser(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-destructive/10 text-destructive">
							<TriangleAlert className="h-5 w-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Xác nhận xóa người dùng</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingDeleteUser
								? `Bạn sắp xóa người dùng ${pendingDeleteUser.email ?? pendingDeleteUser.name ?? getUserId(pendingDeleteUser)}. Hành động này không thể hoàn tác.`
								: "Xác nhận xóa người dùng khỏi hệ thống."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={!!deletingUserId}>
							Hủy
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								void handleDeleteUser();
							}}
							disabled={!!deletingUserId}
						>
							{deletingUserId ? "Đang xóa..." : "Xác nhận xóa"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
