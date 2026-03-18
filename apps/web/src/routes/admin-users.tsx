import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { KeyRound, Pencil, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

	const [users, setUsers] = useState<AdminManagedUser[]>([]);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [search, setSearch] = useState("");

	const [createName, setCreateName] = useState("");
	const [createEmail, setCreateEmail] = useState("");
	const [createPassword, setCreatePassword] = useState("");
	const [createRole, setCreateRole] = useState<UserRole>("user");
	const [isCreating, setIsCreating] = useState(false);
	const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(
		null,
	);
	const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

	const [editingUser, setEditingUser] = useState<AdminManagedUser | null>(null);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [isUpdatingUser, setIsUpdatingUser] = useState(false);

	const [passwordDialogUser, setPasswordDialogUser] =
		useState<AdminManagedUser | null>(null);
	const [newPassword, setNewPassword] = useState("");
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	const loadUsers = async (allowBootstrapRetry = true) => {
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
			if (allowBootstrapRetry) {
				try {
					await bootstrapAdminRole({});
					await loadUsers(false);
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

	useEffect(() => {
		if (!isCurrentUserAdmin) {
			return;
		}

		let cancelled = false;
		const run = async () => {
			try {
				if (cancelled) {
					return;
				}

				try {
					await bootstrapAdminRole({});
				} catch {
					// Fallback to existing 403 retry flow in loadUsers.
				}

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
	}, [isCurrentUserAdmin]);

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

	const handleDeleteUser = async (user: AdminManagedUser) => {
		const userId = getUserId(user);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return;
		}

		const confirmed = window.confirm(
			`Bạn có chắc muốn xóa người dùng ${user.email ?? user.name ?? userId}?`,
		);
		if (!confirmed) {
			return;
		}

		setDeletingUserId(userId);
		try {
			await adminDeleteUser({ userId });
			toast.success("Đã xóa người dùng");
			await loadUsers(false);
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể xóa người dùng"));
		} finally {
			setDeletingUserId(null);
		}
	};

	const handleChangeUserRole = async (
		user: AdminManagedUser,
		nextRole: UserRole,
	) => {
		const userId = getUserId(user);
		if (!userId) {
			toast.error("Không xác định được mã người dùng");
			return;
		}

		setChangingRoleUserId(userId);
		try {
			await adminSetUserRole({ userId, role: nextRole });
			toast.success("Đã cập nhật quyền người dùng");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể cập nhật quyền"));
		} finally {
			setChangingRoleUserId(null);
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
														void handleChangeUserRole(user, value as UserRole)
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
														onClick={() => void handleDeleteUser(user)}
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
		</div>
	);
}
