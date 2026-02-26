import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useState } from "react";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/suppliers")({
	component: SuppliersPage,
});

interface SupplierForm {
	name: string;
	code: string;
	contactPerson: string;
	email: string;
	phone: string;
	address: string;
	taxId: string;
	notes: string;
}

const initialForm: SupplierForm = {
	name: "",
	code: "",
	contactPerson: "",
	email: "",
	phone: "",
	address: "",
	taxId: "",
	notes: "",
};

function SuppliersPage() {
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<SupplierForm>(initialForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const suppliers = useQuery(api.suppliers.list, { activeOnly: false });

	const createSupplier = useMutation(api.suppliers.create);
	const updateSupplier = useMutation(api.suppliers.update);
	const deleteSupplier = useMutation(api.suppliers.remove);

	const filteredSuppliers = suppliers?.filter(
		(s) =>
			s.name.toLowerCase().includes(search.toLowerCase()) ||
			s.code.toLowerCase().includes(search.toLowerCase()),
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (editingId) {
				await updateSupplier({
					id: editingId as any,
					name: form.name,
					code: form.code,
					contactPerson: form.contactPerson || undefined,
					email: form.email || undefined,
					phone: form.phone || undefined,
					address: form.address || undefined,
					taxId: form.taxId || undefined,
					notes: form.notes || undefined,
				});
				toast.success("Đã cập nhật nhà cung cấp thành công");
			} else {
				await createSupplier({
					name: form.name,
					code: form.code,
					contactPerson: form.contactPerson || undefined,
					email: form.email || undefined,
					phone: form.phone || undefined,
					address: form.address || undefined,
					taxId: form.taxId || undefined,
					notes: form.notes || undefined,
				});
				toast.success("Đã tạo nhà cung cấp thành công");
			}
			setDialogOpen(false);
			setForm(initialForm);
			setEditingId(null);
		} catch (error: any) {
			toast.error(error.message || "Không thể lưu nhà cung cấp");
		}
	};

	const handleEdit = (supplier: any) => {
		setEditingId(supplier._id);
		setForm({
			name: supplier.name,
			code: supplier.code,
			contactPerson: supplier.contactPerson || "",
			email: supplier.email || "",
			phone: supplier.phone || "",
			address: supplier.address || "",
			taxId: supplier.taxId || "",
			notes: supplier.notes || "",
		});
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		try {
			await deleteSupplier({ id: deletingId as any });
			toast.success("Đã xóa nhà cung cấp thành công");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error: any) {
			toast.error(error.message || "Không thể xóa nhà cung cấp");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Nhà cung cấp</h2>
					<p className="text-muted-foreground">Quản lý nhà cung cấp</p>
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
							Thêm nhà cung cấp
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[500px]">
						<form onSubmit={handleSubmit}>
							<DialogHeader>
								<DialogTitle>
									{editingId ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
								</DialogTitle>
								<DialogDescription>
									Nhập thông tin nhà cung cấp bên dưới.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="name">Tên *</Label>
										<Input
											id="name"
											value={form.name}
											onChange={(e) =>
												setForm({ ...form, name: e.target.value })
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="code">Mã *</Label>
										<Input
											id="code"
											value={form.code}
											onChange={(e) =>
												setForm({ ...form, code: e.target.value })
											}
											required
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="contactPerson">Người liên hệ</Label>
										<Input
											id="contactPerson"
											value={form.contactPerson}
											onChange={(e) =>
												setForm({ ...form, contactPerson: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="phone">Điện thoại</Label>
										<Input
											id="phone"
											value={form.phone}
											onChange={(e) =>
												setForm({ ...form, phone: e.target.value })
											}
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											value={form.email}
											onChange={(e) =>
												setForm({ ...form, email: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="taxId">Mã số thuế</Label>
										<Input
											id="taxId"
											value={form.taxId}
											onChange={(e) =>
												setForm({ ...form, taxId: e.target.value })
											}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="address">Địa chỉ</Label>
									<Input
										id="address"
										value={form.address}
										onChange={(e) =>
											setForm({ ...form, address: e.target.value })
										}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="notes">Ghi chú</Label>
									<Textarea
										id="notes"
										value={form.notes}
										onChange={(e) =>
											setForm({ ...form, notes: e.target.value })
										}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button type="submit">{editingId ? "Cập nhật" : "Tạo"}</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Danh sách nhà cung cấp</CardTitle>
						<div className="relative w-64">
							<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Tìm kiếm nhà cung cấp..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-8"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{suppliers === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải...
						</div>
					) : filteredSuppliers?.length === 0 ? (
						<div className="py-8 text-center">
							<Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<p className="text-muted-foreground">
								Không tìm thấy nhà cung cấp
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Mã</TableHead>
									<TableHead>Tên</TableHead>
									<TableHead>Người liên hệ</TableHead>
									<TableHead>Điện thoại</TableHead>
									<TableHead>Email</TableHead>
									<TableHead className="text-center">Trạng thái</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredSuppliers?.map((supplier) => (
									<TableRow key={supplier._id}>
										<TableCell className="font-mono">{supplier.code}</TableCell>
										<TableCell className="font-medium">
											{supplier.name}
										</TableCell>
										<TableCell>{supplier.contactPerson || "-"}</TableCell>
										<TableCell>{supplier.phone || "-"}</TableCell>
										<TableCell>{supplier.email || "-"}</TableCell>
										<TableCell className="text-center">
											{supplier.isActive ? (
												<Badge variant="default">Đang hoạt động</Badge>
											) : (
												<Badge variant="secondary">Ngưng hoạt động</Badge>
											)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleEdit(supplier)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													setDeletingId(supplier._id);
													setDeleteDialogOpen(true);
												}}
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Xóa nhà cung cấp</DialogTitle>
						<DialogDescription>
							Bạn có chắc muốn xóa nhà cung cấp này? Hành động này không thể
							hoàn tác.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogOpen(false)}
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
