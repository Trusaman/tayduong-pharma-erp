import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Search, Trash2, UserCircle } from "lucide-react";
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

export const Route = createFileRoute("/customers")({
	component: CustomersPage,
});

interface CustomerForm {
	name: string;
	code: string;
	contactPerson: string;
	email: string;
	phone: string;
	address: string;
	taxId: string;
	notes: string;
}

const initialForm: CustomerForm = {
	name: "",
	code: "",
	contactPerson: "",
	email: "",
	phone: "",
	address: "",
	taxId: "",
	notes: "",
};

function CustomersPage() {
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<CustomerForm>(initialForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const customers = useQuery(api.customers.list, { activeOnly: false });

	const createCustomer = useMutation(api.customers.create);
	const updateCustomer = useMutation(api.customers.update);
	const deleteCustomer = useMutation(api.customers.remove);

	const filteredCustomers = customers?.filter(
		(c) =>
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			c.code.toLowerCase().includes(search.toLowerCase()),
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (editingId) {
				await updateCustomer({
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
				toast.success("Đã cập nhật khách hàng thành công");
			} else {
				await createCustomer({
					name: form.name,
					code: form.code,
					contactPerson: form.contactPerson || undefined,
					email: form.email || undefined,
					phone: form.phone || undefined,
					address: form.address || undefined,
					taxId: form.taxId || undefined,
					notes: form.notes || undefined,
				});
				toast.success("Đã tạo khách hàng thành công");
			}
			setDialogOpen(false);
			setForm(initialForm);
			setEditingId(null);
		} catch (error: any) {
			toast.error(error.message || "Không thể lưu khách hàng");
		}
	};

	const handleEdit = (customer: any) => {
		setEditingId(customer._id);
		setForm({
			name: customer.name,
			code: customer.code,
			contactPerson: customer.contactPerson || "",
			email: customer.email || "",
			phone: customer.phone || "",
			address: customer.address || "",
			taxId: customer.taxId || "",
			notes: customer.notes || "",
		});
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		try {
			await deleteCustomer({ id: deletingId as any });
			toast.success("Đã xóa khách hàng thành công");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error: any) {
			toast.error(error.message || "Không thể xóa khách hàng");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Khách hàng</h2>
					<p className="text-muted-foreground">Quản lý khách hàng</p>
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
							Thêm khách hàng
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[500px]">
						<form onSubmit={handleSubmit}>
							<DialogHeader>
								<DialogTitle>
									{editingId ? "Sửa khách hàng" : "Thêm khách hàng"}
								</DialogTitle>
								<DialogDescription>
									Nhập thông tin khách hàng bên dưới.
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
						<CardTitle>Danh sách khách hàng</CardTitle>
						<div className="relative w-64">
							<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Tìm kiếm khách hàng..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-8"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{customers === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải...
						</div>
					) : filteredCustomers?.length === 0 ? (
						<div className="py-8 text-center">
							<UserCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<p className="text-muted-foreground">Không tìm thấy khách hàng</p>
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
								{filteredCustomers?.map((customer) => (
									<TableRow key={customer._id}>
										<TableCell className="font-mono">{customer.code}</TableCell>
										<TableCell className="font-medium">
											{customer.name}
										</TableCell>
										<TableCell>{customer.contactPerson || "-"}</TableCell>
										<TableCell>{customer.phone || "-"}</TableCell>
										<TableCell>{customer.email || "-"}</TableCell>
										<TableCell className="text-center">
											{customer.isActive ? (
												<Badge variant="default">Đang hoạt động</Badge>
											) : (
												<Badge variant="secondary">Ngưng hoạt động</Badge>
											)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleEdit(customer)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													setDeletingId(customer._id);
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
						<DialogTitle>Xóa khách hàng</DialogTitle>
						<DialogDescription>
							Bạn có chắc muốn xóa khách hàng này? Hành động này không thể hoàn
							tác.
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
