import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Doc, Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Search, Trash2, UserCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
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

export const Route = createFileRoute("/customers")({
	component: CustomersPage,
});

interface CustomerForm {
	name: string;
	code: string;
	taxId: string;
	address: string;
	province: string;
	billingAddress: string;
	shippingAddress: string;
	companyDirector: string;
	paymentResponsibleName: string;
	orderResponsibleName: string;
	employeeCode: string;
	territory: string;
	biddingContactName: string;
	biddingContactPhone: string;
	biddingContactNotes: string;
	paymentContactName: string;
	paymentContactPhone: string;
	paymentContactNotes: string;
	receivingContactName: string;
	receivingContactPhone: string;
	receivingContactNotes: string;
	otherContactName: string;
	otherContactPhone: string;
	otherContactNotes: string;
	contactPerson: string;
	email: string;
	phone: string;
	notes: string;
	isActive: boolean;
}

type StringFieldKey = {
	[K in keyof CustomerForm]: CustomerForm[K] extends string ? K : never;
}[keyof CustomerForm];

const initialForm: CustomerForm = {
	name: "",
	code: "",
	taxId: "",
	address: "",
	province: "",
	billingAddress: "",
	shippingAddress: "",
	companyDirector: "",
	paymentResponsibleName: "",
	orderResponsibleName: "",
	employeeCode: "",
	territory: "",
	biddingContactName: "",
	biddingContactPhone: "",
	biddingContactNotes: "",
	paymentContactName: "",
	paymentContactPhone: "",
	paymentContactNotes: "",
	receivingContactName: "",
	receivingContactPhone: "",
	receivingContactNotes: "",
	otherContactName: "",
	otherContactPhone: "",
	otherContactNotes: "",
	contactPerson: "",
	email: "",
	phone: "",
	notes: "",
	isActive: true,
};

function formatOptionalString(value: string) {
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function getPrimaryContactNameFromValues(values: {
	orderResponsibleName?: string;
	paymentResponsibleName?: string;
	biddingContactName?: string;
	paymentContactName?: string;
	receivingContactName?: string;
	otherContactName?: string;
	contactPerson?: string;
}) {
	return (
		values.orderResponsibleName ??
		values.paymentResponsibleName ??
		values.biddingContactName ??
		values.paymentContactName ??
		values.receivingContactName ??
		values.otherContactName ??
		values.contactPerson ??
		"-"
	);
}

function getPrimaryPhoneFromValues(values: {
	biddingContactPhone?: string;
	paymentContactPhone?: string;
	receivingContactPhone?: string;
	otherContactPhone?: string;
	phone?: string;
}) {
	return (
		values.biddingContactPhone ??
		values.paymentContactPhone ??
		values.receivingContactPhone ??
		values.otherContactPhone ??
		values.phone ??
		"-"
	);
}

function getPrimaryContactName(customer: Doc<"customers">) {
	return getPrimaryContactNameFromValues(customer);
}

function getPrimaryPhone(customer: Doc<"customers">) {
	return getPrimaryPhoneFromValues(customer);
}

function getTerritoryLabel(customer: Doc<"customers">) {
	return customer.territory ?? customer.province ?? "-";
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="overflow-hidden rounded-lg border bg-background">
			<div className="border-b bg-muted/40 px-4 py-3 font-semibold text-sm">
				{title}
			</div>
			<div>{children}</div>
		</section>
	);
}

function FormRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="grid items-start gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
			<div className="pt-2 font-medium text-sm">{label}</div>
			<div>{children}</div>
		</div>
	);
}

function CustomersPage() {
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<Id<"customers"> | null>(null);
	const [form, setForm] = useState<CustomerForm>(initialForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<Id<"customers"> | null>(null);

	const customers = useQuery(api.customers.list, { activeOnly: false });

	const createCustomer = useMutation(api.customers.create);
	const updateCustomer = useMutation(api.customers.update);
	const deleteCustomer = useMutation(api.customers.remove);

	const filteredCustomers = customers?.filter(
		(customer) =>
			customer.name.toLowerCase().includes(search.toLowerCase()) ||
			customer.code.toLowerCase().includes(search.toLowerCase()),
	);

	const updateField = <K extends keyof CustomerForm>(
		field: K,
		value: CustomerForm[K],
	) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const buildPayload = () => {
		const primaryContact = formatOptionalString(
			getPrimaryContactNameFromValues({
				orderResponsibleName: formatOptionalString(form.orderResponsibleName),
				paymentResponsibleName: formatOptionalString(form.paymentResponsibleName),
				biddingContactName: formatOptionalString(form.biddingContactName),
				paymentContactName: formatOptionalString(form.paymentContactName),
				receivingContactName: formatOptionalString(form.receivingContactName),
				otherContactName: formatOptionalString(form.otherContactName),
				contactPerson: formatOptionalString(form.contactPerson),
			}),
		);
		const primaryPhone = formatOptionalString(
			getPrimaryPhoneFromValues({
				biddingContactPhone: formatOptionalString(form.biddingContactPhone),
				paymentContactPhone: formatOptionalString(form.paymentContactPhone),
				receivingContactPhone: formatOptionalString(form.receivingContactPhone),
				otherContactPhone: formatOptionalString(form.otherContactPhone),
				phone: formatOptionalString(form.phone),
			}),
		);

		return {
			name: form.name.trim(),
			code: form.code.trim(),
			contactPerson: primaryContact,
			email: formatOptionalString(form.email),
			phone: primaryPhone,
			address: formatOptionalString(form.address),
			taxId: formatOptionalString(form.taxId),
			province: formatOptionalString(form.province),
			billingAddress: formatOptionalString(form.billingAddress),
			shippingAddress: formatOptionalString(form.shippingAddress),
			companyDirector: formatOptionalString(form.companyDirector),
			paymentResponsibleName: formatOptionalString(form.paymentResponsibleName),
			orderResponsibleName: formatOptionalString(form.orderResponsibleName),
			employeeCode: formatOptionalString(form.employeeCode),
			territory: formatOptionalString(form.territory),
			biddingContactName: formatOptionalString(form.biddingContactName),
			biddingContactPhone: formatOptionalString(form.biddingContactPhone),
			biddingContactNotes: formatOptionalString(form.biddingContactNotes),
			paymentContactName: formatOptionalString(form.paymentContactName),
			paymentContactPhone: formatOptionalString(form.paymentContactPhone),
			paymentContactNotes: formatOptionalString(form.paymentContactNotes),
			receivingContactName: formatOptionalString(form.receivingContactName),
			receivingContactPhone: formatOptionalString(form.receivingContactPhone),
			receivingContactNotes: formatOptionalString(form.receivingContactNotes),
			otherContactName: formatOptionalString(form.otherContactName),
			otherContactPhone: formatOptionalString(form.otherContactPhone),
			otherContactNotes: formatOptionalString(form.otherContactNotes),
			notes: formatOptionalString(form.notes),
			isActive: form.isActive,
		};
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!form.name.trim() || !form.code.trim()) {
			toast.error("Vui lòng nhập mã khách hàng và tên khách hàng");
			return;
		}

		try {
			const payload = buildPayload();

			if (editingId) {
				await updateCustomer({
					id: editingId,
					...payload,
				});
				toast.success("Đã cập nhật khách hàng thành công");
			} else {
				await createCustomer(payload);
				toast.success("Đã tạo khách hàng thành công");
			}

			setDialogOpen(false);
			setForm(initialForm);
			setEditingId(null);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể lưu khách hàng",
			);
		}
	};

	const handleEdit = (customer: Doc<"customers">) => {
		setEditingId(customer._id);
		setForm({
			name: customer.name,
			code: customer.code,
			taxId: customer.taxId ?? "",
			address: customer.address ?? "",
			province: customer.province ?? "",
			billingAddress: customer.billingAddress ?? "",
			shippingAddress: customer.shippingAddress ?? "",
			companyDirector: customer.companyDirector ?? "",
			paymentResponsibleName: customer.paymentResponsibleName ?? "",
			orderResponsibleName:
				customer.orderResponsibleName ?? customer.contactPerson ?? "",
			employeeCode: customer.employeeCode ?? "",
			territory: customer.territory ?? "",
			biddingContactName: customer.biddingContactName ?? "",
			biddingContactPhone: customer.biddingContactPhone ?? customer.phone ?? "",
			biddingContactNotes: customer.biddingContactNotes ?? "",
			paymentContactName: customer.paymentContactName ?? "",
			paymentContactPhone: customer.paymentContactPhone ?? "",
			paymentContactNotes: customer.paymentContactNotes ?? "",
			receivingContactName: customer.receivingContactName ?? "",
			receivingContactPhone: customer.receivingContactPhone ?? "",
			receivingContactNotes: customer.receivingContactNotes ?? "",
			otherContactName: customer.otherContactName ?? "",
			otherContactPhone: customer.otherContactPhone ?? "",
			otherContactNotes: customer.otherContactNotes ?? "",
			contactPerson: customer.contactPerson ?? "",
			email: customer.email ?? "",
			phone: customer.phone ?? "",
			notes: customer.notes ?? "",
			isActive: customer.isActive,
		});
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deletingId) {
			return;
		}

		try {
			await deleteCustomer({ id: deletingId });
			toast.success("Đã xóa khách hàng thành công");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xóa khách hàng",
			);
		}
	};

	const renderContactSection = (
		title: string,
		nameField: StringFieldKey,
		phoneField: StringFieldKey,
		notesField: StringFieldKey,
	) => (
		<FormSection title={title}>
			<FormRow label="Người phụ trách">
				<Input
					value={form[nameField]}
					onChange={(e) => updateField(nameField, e.target.value)}
					placeholder="Nhập tên người phụ trách"
				/>
			</FormRow>
			<FormRow label="Số điện thoại">
				<Input
					value={form[phoneField]}
					onChange={(e) => updateField(phoneField, e.target.value)}
					placeholder="Nhập số điện thoại"
				/>
			</FormRow>
			<FormRow label="Ghi chú">
				<Textarea
					value={form[notesField]}
					onChange={(e) => updateField(notesField, e.target.value)}
					placeholder="Ghi chú thêm"
					rows={3}
				/>
			</FormRow>
		</FormSection>
	);

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
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[920px]">
						<form onSubmit={handleSubmit}>
							<DialogHeader>
								<DialogTitle>
									{editingId ? "Sửa khách hàng" : "Thêm khách hàng"}
								</DialogTitle>
								<DialogDescription>
									Biểu mẫu khách hàng chi tiết theo nhóm thông tin.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-5 py-4">
								<FormSection title="Thông tin chung">
									<FormRow label="Mã khách hàng *">
										<Input
											value={form.code}
											onChange={(e) => updateField("code", e.target.value)}
											placeholder="Nhập mã khách hàng"
											required
										/>
									</FormRow>
									<FormRow label="Tên khách hàng *">
										<Input
											value={form.name}
											onChange={(e) => updateField("name", e.target.value)}
											placeholder="Nhập tên khách hàng"
											required
										/>
									</FormRow>
									<FormRow label="Mã số thuế">
										<Input
											value={form.taxId}
											onChange={(e) => updateField("taxId", e.target.value)}
											placeholder="Nhập mã số thuế"
										/>
									</FormRow>
									<FormRow label="Địa chỉ">
										<Textarea
											value={form.address}
											onChange={(e) => updateField("address", e.target.value)}
											placeholder="Nhập địa chỉ chính"
											rows={2}
										/>
									</FormRow>
									<FormRow label="Tỉnh">
										<Input
											value={form.province}
											onChange={(e) => updateField("province", e.target.value)}
											placeholder="Ví dụ: Hà Nội"
										/>
									</FormRow>
									<FormRow label="Địa chỉ hóa đơn">
										<Textarea
											value={form.billingAddress}
											onChange={(e) =>
												updateField("billingAddress", e.target.value)
											}
											placeholder="Nhập địa chỉ hóa đơn"
											rows={2}
										/>
									</FormRow>
									<FormRow label="Địa chỉ giao hàng">
										<Textarea
											value={form.shippingAddress}
											onChange={(e) =>
												updateField("shippingAddress", e.target.value)
											}
											placeholder="Nhập địa chỉ giao hàng"
											rows={2}
										/>
									</FormRow>
									<FormRow label="Giám đốc công ty">
										<Input
											value={form.companyDirector}
											onChange={(e) =>
												updateField("companyDirector", e.target.value)
											}
											placeholder="Nhập tên giám đốc"
										/>
									</FormRow>
									<FormRow label="Người phụ trách thanh toán">
										<Input
											value={form.paymentResponsibleName}
											onChange={(e) =>
												updateField("paymentResponsibleName", e.target.value)
											}
											placeholder="Nhập người phụ trách thanh toán"
										/>
									</FormRow>
									<FormRow label="Người phụ trách nhận đơn">
										<Input
											value={form.orderResponsibleName}
											onChange={(e) =>
												updateField("orderResponsibleName", e.target.value)
											}
											placeholder="Nhập người phụ trách nhận đơn"
										/>
									</FormRow>
									<FormRow label="Nhân viên phụ trách (Mã nhân viên)">
										<Input
											value={form.employeeCode}
											onChange={(e) => updateField("employeeCode", e.target.value)}
											placeholder="Nhập mã nhân viên"
										/>
									</FormRow>
									<FormRow label="Địa bàn">
										<Input
											value={form.territory}
											onChange={(e) => updateField("territory", e.target.value)}
											placeholder="Ví dụ: Tỉnh, Hà Nội"
										/>
									</FormRow>
								</FormSection>

								{renderContactSection(
									"Thông tin người phụ trách thầu",
									"biddingContactName",
									"biddingContactPhone",
									"biddingContactNotes",
								)}

								{renderContactSection(
									"Thông tin người phụ trách thanh toán",
									"paymentContactName",
									"paymentContactPhone",
									"paymentContactNotes",
								)}

								{renderContactSection(
									"Thông tin người phụ trách nhận hàng",
									"receivingContactName",
									"receivingContactPhone",
									"receivingContactNotes",
								)}

								{renderContactSection(
									"Thông tin người phụ trách khác",
									"otherContactName",
									"otherContactPhone",
									"otherContactNotes",
								)}

								<FormSection title="Trạng thái">
									<FormRow label="Trạng thái">
										<Select
											value={form.isActive ? "active" : "inactive"}
											onValueChange={(value) =>
												updateField("isActive", value === "active")
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Chọn trạng thái" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">Hoạt động</SelectItem>
												<SelectItem value="inactive">
													Không hoạt động
												</SelectItem>
											</SelectContent>
										</Select>
									</FormRow>
								</FormSection>
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
									<TableHead>Tên khách hàng</TableHead>
									<TableHead>Người phụ trách</TableHead>
									<TableHead>Điện thoại</TableHead>
									<TableHead>Địa bàn</TableHead>
									<TableHead className="text-center">Trạng thái</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredCustomers?.map((customer) => (
									<TableRow key={customer._id}>
										<TableCell className="font-mono">{customer.code}</TableCell>
										<TableCell className="font-medium">{customer.name}</TableCell>
										<TableCell>{getPrimaryContactName(customer)}</TableCell>
										<TableCell>{getPrimaryPhone(customer)}</TableCell>
										<TableCell>{getTerritoryLabel(customer)}</TableCell>
										<TableCell className="text-center">
											{customer.isActive ? (
												<Badge variant="default">Hoạt động</Badge>
											) : (
												<Badge variant="secondary">Không hoạt động</Badge>
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
							Bạn có chắc muốn xóa khách hàng này? Hành động này không thể hoàn tác.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
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
