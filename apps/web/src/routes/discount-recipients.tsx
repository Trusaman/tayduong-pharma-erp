import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/discount-recipients")({
	component: DiscountRecipientsPage,
});

type RecipientStatus = "active" | "inactive";

type RecipientForm = {
	name: string;
	code: string;
	phone: string;
	notes: string;
	status: RecipientStatus;
};

const initialForm: RecipientForm = {
	name: "",
	code: "",
	phone: "",
	notes: "",
	status: "active",
};

function DiscountRecipientsPage() {
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<RecipientForm>(initialForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const recipients = useQuery(api.discountRecipients.list, {
		activeOnly: false,
	});
	const createRecipient = useMutation(api.discountRecipients.create);
	const updateRecipient = useMutation(api.discountRecipients.update);
	const deleteRecipient = useMutation(api.discountRecipients.remove);

	const filteredRecipients = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		if (!recipients) return [];
		if (!keyword) return recipients;

		return recipients.filter(
			(recipient) =>
				recipient.name.toLowerCase().includes(keyword) ||
				recipient.code.toLowerCase().includes(keyword) ||
				recipient.phone?.toLowerCase().includes(keyword),
		);
	}, [recipients, search]);

	const stats = useMemo(
		() => ({
			total: recipients?.length ?? 0,
			active: recipients?.filter((recipient) => recipient.isActive).length ?? 0,
			inactive:
				recipients?.filter((recipient) => !recipient.isActive).length ?? 0,
		}),
		[recipients],
	);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		try {
			if (editingId) {
				await updateRecipient({
					id: editingId as Id<"salesmen">,
					name: form.name,
					code: form.code,
					phone: form.phone || undefined,
					notes: form.notes || undefined,
					isActive: form.status === "active",
				});
				toast.success("Đã cập nhật người nhận chiết khấu");
			} else {
				await createRecipient({
					name: form.name,
					code: form.code,
					phone: form.phone || undefined,
					notes: form.notes || undefined,
				});
				toast.success("Đã tạo người nhận chiết khấu");
			}

			setDialogOpen(false);
			setEditingId(null);
			setForm(initialForm);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể lưu người nhận chiết khấu",
			);
		}
	};

	const handleEdit = (recipient: NonNullable<typeof recipients>[number]) => {
		setEditingId(recipient._id);
		setForm({
			name: recipient.name,
			code: recipient.code,
			phone: recipient.phone || "",
			notes: recipient.notes || "",
			status: recipient.isActive ? "active" : "inactive",
		});
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deletingId) return;

		try {
			await deleteRecipient({ id: deletingId as Id<"salesmen"> });
			toast.success("Đã xóa người nhận chiết khấu");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể xóa người nhận chiết khấu",
			);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">
						Người nhận chiết khấu
					</h2>
					<p className="text-muted-foreground">
						Quản lý danh sách người nhận chiết khấu dùng cho các phân hệ liên
						quan.
					</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setForm(initialForm);
								setEditingId(null);
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Thêm người nhận
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[520px]">
						<form onSubmit={handleSubmit}>
							<DialogHeader>
								<DialogTitle>
									{editingId
										? "Sửa người nhận chiết khấu"
										: "Thêm người nhận chiết khấu"}
								</DialogTitle>
								<DialogDescription>
									Cập nhật thông tin người nhận dùng cho các cấu hình chiết
									khấu.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="recipient-name">Họ tên *</Label>
										<Input
											id="recipient-name"
											value={form.name}
											onChange={(event) =>
												setForm({ ...form, name: event.target.value })
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="recipient-code">Mã *</Label>
										<Input
											id="recipient-code"
											value={form.code}
											onChange={(event) =>
												setForm({ ...form, code: event.target.value })
											}
											required
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="recipient-phone">Số điện thoại</Label>
										<Input
											id="recipient-phone"
											value={form.phone}
											onChange={(event) =>
												setForm({ ...form, phone: event.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Trạng thái</Label>
										<Select
											value={form.status}
											onValueChange={(value) =>
												value &&
												setForm({
													...form,
													status: value as RecipientStatus,
												})
											}
										>
											<SelectTrigger>
												<SelectValue>
													{form.status === "active"
														? "Đang sử dụng"
														: "Ngừng sử dụng"}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">Đang sử dụng</SelectItem>
												<SelectItem value="inactive">Ngừng sử dụng</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="recipient-notes">Ghi chú</Label>
									<Textarea
										id="recipient-notes"
										value={form.notes}
										onChange={(event) =>
											setForm({ ...form, notes: event.target.value })
										}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button type="submit">
									{editingId ? "Lưu thay đổi" : "Tạo người nhận"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				{[
					{ label: "Tổng người nhận", value: stats.total, icon: Users },
					{ label: "Đang sử dụng", value: stats.active, icon: Users },
					{ label: "Ngừng sử dụng", value: stats.inactive, icon: Users },
				].map((stat) => (
					<Card key={stat.label}>
						<CardContent className="flex items-center justify-between p-4">
							<div>
								<p className="text-muted-foreground text-sm">{stat.label}</p>
								<p className="font-bold text-2xl">{stat.value}</p>
							</div>
							<stat.icon className="h-8 w-8 text-teal-500" />
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Danh sách người nhận chiết khấu</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="relative mb-4 max-w-sm">
						<Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Tìm theo tên hoặc mã..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="pl-9"
						/>
					</div>

					{recipients === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải dữ liệu...
						</div>
					) : filteredRecipients.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Chưa có người nhận chiết khấu phù hợp.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Mã</TableHead>
									<TableHead>Họ tên</TableHead>
									<TableHead>Số điện thoại</TableHead>
									<TableHead>Ghi chú</TableHead>
									<TableHead>Trạng thái</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredRecipients.map((recipient) => (
									<TableRow key={recipient._id}>
										<TableCell className="font-medium">
											{recipient.code}
										</TableCell>
										<TableCell>{recipient.name}</TableCell>
										<TableCell>{recipient.phone || "-"}</TableCell>
										<TableCell className="max-w-[280px] whitespace-normal text-muted-foreground text-sm">
											{recipient.notes || "-"}
										</TableCell>
										<TableCell>
											<Badge
												variant={recipient.isActive ? "default" : "secondary"}
											>
												{recipient.isActive ? "Đang sử dụng" : "Ngừng sử dụng"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleEdit(recipient)}
												>
													<Pencil className="mr-2 h-4 w-4" />
													Sửa
												</Button>
												<Button
													variant="destructive"
													size="sm"
													onClick={() => {
														setDeletingId(recipient._id);
														setDeleteDialogOpen(true);
													}}
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Xóa
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

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Xóa người nhận chiết khấu?</DialogTitle>
						<DialogDescription>
							Thao tác này sẽ xóa người nhận chiết khấu nếu chưa được sử dụng ở
							đơn bán hoặc chính sách chiết khấu.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setDeleteDialogOpen(false);
								setDeletingId(null);
							}}
						>
							Hủy
						</Button>
						<Button variant="destructive" onClick={handleDelete}>
							Xóa
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
