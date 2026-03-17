import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type {
	Doc,
	Id,
} from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	Download,
	FileSpreadsheet,
	Pencil,
	Plus,
	Search,
	Trash2,
	TriangleAlert,
	Upload,
	Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

const SUPPLIER_WORKBOOK_COLUMNS = {
	code: "Mã nhà cung cấp",
	name: "Tên nhà cung cấp",
	contactPerson: "Người liên hệ",
	phone: "Điện thoại",
	email: "Email",
	address: "Địa chỉ",
	taxId: "Mã số thuế",
	notes: "Ghi chú",
	isActive: "Trạng thái",
} as const;

const SUPPLIER_WORKBOOK_HEADER_ORDER = [
	SUPPLIER_WORKBOOK_COLUMNS.code,
	SUPPLIER_WORKBOOK_COLUMNS.name,
	SUPPLIER_WORKBOOK_COLUMNS.contactPerson,
	SUPPLIER_WORKBOOK_COLUMNS.phone,
	SUPPLIER_WORKBOOK_COLUMNS.email,
	SUPPLIER_WORKBOOK_COLUMNS.address,
	SUPPLIER_WORKBOOK_COLUMNS.taxId,
	SUPPLIER_WORKBOOK_COLUMNS.notes,
	SUPPLIER_WORKBOOK_COLUMNS.isActive,
] as const;

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

const toCellString = (value: unknown) => {
	if (value === null || value === undefined) return "";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return value.trim();
	return String(value).trim();
};

const formatOptionalString = (value: string) => {
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
};

const parseActiveStatus = (value: string) => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return true;
	if (
		["hoạt động", "hoat dong", "active", "1", "true", "yes"].includes(
			normalized,
		)
	) {
		return true;
	}
	if (
		[
			"ngưng hoạt động",
			"ngung hoat dong",
			"không hoạt động",
			"khong hoat dong",
			"inactive",
			"0",
			"false",
			"no",
		].includes(normalized)
	) {
		return false;
	}
	throw new Error(`Trạng thái không hợp lệ: ${value}`);
};

type SupplierRow = Doc<"suppliers">;

function SuppliersPage() {
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<Id<"suppliers"> | null>(null);
	const [form, setForm] = useState<SupplierForm>(initialForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<Id<"suppliers"> | null>(null);
	const [selectedSupplierIds, setSelectedSupplierIds] = useState<
		Id<"suppliers">[]
	>([]);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
	const importInputRef = useRef<HTMLInputElement>(null);

	const suppliers = useQuery(api.suppliers.list, { activeOnly: false });

	const createSupplier = useMutation(api.suppliers.create);
	const updateSupplier = useMutation(api.suppliers.update);
	const deleteSupplier = useMutation(api.suppliers.remove);

	const filteredSuppliers = suppliers?.filter(
		(supplier) =>
			supplier.name.toLowerCase().includes(search.toLowerCase()) ||
			supplier.code.toLowerCase().includes(search.toLowerCase()),
	);

	const filteredSupplierIds = (filteredSuppliers ?? []).map(
		(supplier) => supplier._id,
	);
	const selectedSupplierIdSet = useMemo(
		() => new Set(selectedSupplierIds),
		[selectedSupplierIds],
	);
	const selectedInCurrentFilterCount = filteredSupplierIds.filter((id) =>
		selectedSupplierIdSet.has(id),
	).length;
	const isAllCurrentFilteredSelected =
		filteredSupplierIds.length > 0 &&
		selectedInCurrentFilterCount === filteredSupplierIds.length;
	const selectedSuppliers = (suppliers ?? []).filter((supplier) =>
		selectedSupplierIdSet.has(supplier._id),
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (editingId) {
				await updateSupplier({
					id: editingId,
					name: form.name.trim(),
					code: form.code.trim(),
					contactPerson: formatOptionalString(form.contactPerson),
					email: formatOptionalString(form.email),
					phone: formatOptionalString(form.phone),
					address: formatOptionalString(form.address),
					taxId: formatOptionalString(form.taxId),
					notes: formatOptionalString(form.notes),
				});
				toast.success("Đã cập nhật nhà cung cấp thành công");
			} else {
				await createSupplier({
					name: form.name.trim(),
					code: form.code.trim(),
					contactPerson: formatOptionalString(form.contactPerson),
					email: formatOptionalString(form.email),
					phone: formatOptionalString(form.phone),
					address: formatOptionalString(form.address),
					taxId: formatOptionalString(form.taxId),
					notes: formatOptionalString(form.notes),
				});
				toast.success("Đã tạo nhà cung cấp thành công");
			}
			setDialogOpen(false);
			setForm(initialForm);
			setEditingId(null);
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Không thể lưu nhà cung cấp",
			);
		}
	};

	const handleEdit = (supplier: SupplierRow) => {
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
		const deletingSupplierId = deletingId;

		try {
			await deleteSupplier({ id: deletingSupplierId });
			toast.success("Đã xóa nhà cung cấp thành công");
			setDeleteDialogOpen(false);
			setDeletingId(null);
			setSelectedSupplierIds((current) =>
				current.filter((id) => id !== deletingSupplierId),
			);
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xóa nhà cung cấp",
			);
		}
	};

	const toggleSelectSupplier = (id: Id<"suppliers">, checked: boolean) => {
		setSelectedSupplierIds((current) => {
			if (checked) {
				if (current.includes(id)) return current;
				return [...current, id];
			}
			return current.filter((selectedId) => selectedId !== id);
		});
	};

	const toggleSelectAllFiltered = (checked: boolean) => {
		if (!filteredSupplierIds.length) return;
		setSelectedSupplierIds((current) => {
			if (checked) {
				return [...new Set([...current, ...filteredSupplierIds])];
			}
			return current.filter((id) => !filteredSupplierIds.includes(id));
		});
	};

	const handleRemoveSelectedSuppliers = async () => {
		if (selectedSuppliers.length === 0) return;

		let deletedCount = 0;
		const failed: SupplierRow[] = [];

		for (const supplier of selectedSuppliers) {
			try {
				await deleteSupplier({ id: supplier._id });
				deletedCount += 1;
			} catch {
				failed.push(supplier);
			}
		}

		if (deletedCount > 0) {
			toast.success(`Đã xóa ${deletedCount} nhà cung cấp`);
		}

		if (failed.length > 0) {
			toast.error(
				`Không thể xóa ${failed.length} nhà cung cấp. Kiểm tra đơn mua trước khi xóa.`,
			);
		}

		setSelectedSupplierIds(failed.map((supplier) => supplier._id));
		setBulkDeleteDialogOpen(false);
	};

	const handleExportXlsx = async () => {
		if (!filteredSuppliers || filteredSuppliers.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}

		try {
			const XLSX = await import("xlsx");
			const rows = filteredSuppliers.map((supplier) => ({
				[SUPPLIER_WORKBOOK_COLUMNS.code]: supplier.code,
				[SUPPLIER_WORKBOOK_COLUMNS.name]: supplier.name,
				[SUPPLIER_WORKBOOK_COLUMNS.contactPerson]: supplier.contactPerson ?? "",
				[SUPPLIER_WORKBOOK_COLUMNS.phone]: supplier.phone ?? "",
				[SUPPLIER_WORKBOOK_COLUMNS.email]: supplier.email ?? "",
				[SUPPLIER_WORKBOOK_COLUMNS.address]: supplier.address ?? "",
				[SUPPLIER_WORKBOOK_COLUMNS.taxId]: supplier.taxId ?? "",
				[SUPPLIER_WORKBOOK_COLUMNS.notes]: supplier.notes ?? "",
				[SUPPLIER_WORKBOOK_COLUMNS.isActive]: supplier.isActive
					? "Hoạt động"
					: "Ngưng hoạt động",
			}));

			const worksheet = XLSX.utils.json_to_sheet(rows, {
				header: [...SUPPLIER_WORKBOOK_HEADER_ORDER],
			});
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Nha_cung_cap");

			const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
			const blob = new Blob([output], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "danh-sach-nha-cung-cap.xlsx";
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			toast.success("Đã xuất file XLSX");
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xuất file XLSX",
			);
		}
	};

	const handlePickImportFile = () => {
		importInputRef.current?.click();
	};

	const handleDownloadTemplate = async () => {
		try {
			const XLSX = await import("xlsx");
			const templateRows = [
				{
					[SUPPLIER_WORKBOOK_COLUMNS.code]: "NCC001",
					[SUPPLIER_WORKBOOK_COLUMNS.name]: "Công ty Dược ABC",
					[SUPPLIER_WORKBOOK_COLUMNS.contactPerson]: "Nguyễn Văn A",
					[SUPPLIER_WORKBOOK_COLUMNS.phone]: "0901234567",
					[SUPPLIER_WORKBOOK_COLUMNS.email]: "abc@example.com",
					[SUPPLIER_WORKBOOK_COLUMNS.address]: "Hà Nội",
					[SUPPLIER_WORKBOOK_COLUMNS.taxId]: "0101234567",
					[SUPPLIER_WORKBOOK_COLUMNS.notes]: "",
					[SUPPLIER_WORKBOOK_COLUMNS.isActive]: "Hoạt động",
				},
			];

			const dataSheet = XLSX.utils.json_to_sheet(templateRows, {
				header: [...SUPPLIER_WORKBOOK_HEADER_ORDER],
			});

			const guideRows = [
				["Hướng dẫn import nhà cung cấp"],
				[
					`Cột bắt buộc: ${SUPPLIER_WORKBOOK_COLUMNS.code}, ${SUPPLIER_WORKBOOK_COLUMNS.name}`,
				],
				["Trạng thái hợp lệ: Hoạt động, Ngưng hoạt động"],
				["Mã nhà cung cấp phải là duy nhất trong hệ thống"],
				["Số điện thoại nên nhập dạng text để giữ số 0 đầu"],
			];
			const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);

			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, dataSheet, "Mau_import");
			XLSX.utils.book_append_sheet(workbook, guideSheet, "Huong_dan");

			const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
			const blob = new Blob([output], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "mau-import-nha-cung-cap.xlsx";
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			toast.success("Đã tải file mẫu XLSX");
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Không thể tạo file mẫu XLSX",
			);
		}
	};

	const handleImportXlsx = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const XLSX = await import("xlsx");
			const fileBuffer = await file.arrayBuffer();
			const workbook = XLSX.read(fileBuffer, { type: "array" });
			const worksheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
			if (!worksheet) {
				throw new Error("Không tìm thấy dữ liệu trong file import");
			}

			const headerRows = XLSX.utils.sheet_to_json<Array<string | number>>(
				worksheet,
				{
					header: 1,
					defval: "",
				},
			);
			const headerRow = (headerRows[0] ?? []).map((cell) => toCellString(cell));
			for (const requiredColumn of [
				SUPPLIER_WORKBOOK_COLUMNS.code,
				SUPPLIER_WORKBOOK_COLUMNS.name,
			]) {
				if (!headerRow.includes(requiredColumn)) {
					throw new Error(`File import thiếu cột bắt buộc: ${requiredColumn}`);
				}
			}

			const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
				worksheet,
				{ defval: "" },
			);

			const rowsToImport = rawRows
				.map((row, index) => {
					const rowNumber = index + 2;
					const code = toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.code]);
					const name = toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.name]);
					if (!code && !name) return null;
					if (!code || !name) {
						throw new Error(
							`Dòng ${rowNumber}: cần nhập Mã nhà cung cấp và Tên nhà cung cấp`,
						);
					}

					return {
						rowNumber,
						payload: {
							code,
							name,
							contactPerson: formatOptionalString(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.contactPerson]),
							),
							phone: formatOptionalString(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.phone]),
							),
							email: formatOptionalString(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.email]),
							),
							address: formatOptionalString(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.address]),
							),
							taxId: formatOptionalString(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.taxId]),
							),
							notes: formatOptionalString(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.notes]),
							),
							isActive: parseActiveStatus(
								toCellString(row[SUPPLIER_WORKBOOK_COLUMNS.isActive]),
							),
						},
					};
				})
				.filter((row) => row !== null);

			if (rowsToImport.length === 0) {
				throw new Error("File import không có dữ liệu hợp lệ");
			}

			for (const row of rowsToImport) {
				try {
					const insertedId = await createSupplier({
						name: row.payload.name,
						code: row.payload.code,
						contactPerson: row.payload.contactPerson,
						email: row.payload.email,
						phone: row.payload.phone,
						address: row.payload.address,
						taxId: row.payload.taxId,
						notes: row.payload.notes,
					});

					if (!row.payload.isActive) {
						await updateSupplier({
							id: insertedId,
							isActive: false,
						});
					}
				} catch (error: unknown) {
					throw new Error(
						`Dòng ${row.rowNumber}: ${
							error instanceof Error ? error.message : "Không thể import"
						}`,
					);
				}
			}

			toast.success(`Đã import ${rowsToImport.length} nhà cung cấp`);
		} catch (error: unknown) {
			toast.error(
				error instanceof Error ? error.message : "Không thể import file XLSX",
			);
		} finally {
			event.target.value = "";
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
					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<CardTitle>Danh sách nhà cung cấp</CardTitle>
							<div className="flex flex-wrap items-center gap-2">
								<Button variant="outline" onClick={handlePickImportFile}>
									<Upload className="mr-2 h-4 w-4" />
									Import XLSX
								</Button>
								<Button variant="outline" onClick={handleExportXlsx}>
									<Download className="mr-2 h-4 w-4" />
									Export XLSX
								</Button>
								<Button variant="outline" onClick={handleDownloadTemplate}>
									<FileSpreadsheet className="mr-2 h-4 w-4" />
									Tải mẫu XLSX
								</Button>
								<Button
									variant="destructive"
									disabled={selectedSuppliers.length === 0}
									onClick={() => setBulkDeleteDialogOpen(true)}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Xóa đã chọn ({selectedSuppliers.length})
								</Button>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative min-w-[240px] flex-1">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Tìm kiếm nhà cung cấp..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8"
								/>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<input
						ref={importInputRef}
						type="file"
						accept=".xlsx,.xls"
						className="hidden"
						onChange={handleImportXlsx}
					/>
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
									<TableHead className="w-[44px]">
										<Checkbox
											checked={isAllCurrentFilteredSelected}
											onCheckedChange={(checked) =>
												toggleSelectAllFiltered(Boolean(checked))
											}
										/>
									</TableHead>
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
										<TableCell>
											<Checkbox
												checked={selectedSupplierIdSet.has(supplier._id)}
												onCheckedChange={(checked) =>
													toggleSelectSupplier(supplier._id, Boolean(checked))
												}
											/>
										</TableCell>
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

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-destructive/10 text-destructive">
							<TriangleAlert className="h-5 w-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Xác nhận xóa nhà cung cấp</AlertDialogTitle>
						<AlertDialogDescription>
							Bạn sắp xóa nhà cung cấp này khỏi hệ thống. Hành động không thể
							hoàn tác.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Hủy</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleDelete}
						>
							Xác nhận xóa
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={bulkDeleteDialogOpen}
				onOpenChange={setBulkDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-destructive/10 text-destructive">
							<TriangleAlert className="h-5 w-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Xác nhận xóa nhiều nhà cung cấp</AlertDialogTitle>
						<AlertDialogDescription>
							Bạn sắp xóa {selectedSuppliers.length} nhà cung cấp đã chọn. Hành
							động không thể hoàn tác.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{selectedSuppliers.length > 0 && (
						<div className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
							{selectedSuppliers.slice(0, 8).map((supplier) => (
								<div
									key={supplier._id}
									className="flex items-center justify-between gap-3"
								>
									<span className="font-mono text-xs">{supplier.code}</span>
									<span className="truncate text-muted-foreground">
										{supplier.name}
									</span>
								</div>
							))}
							{selectedSuppliers.length > 8 && (
								<p className="text-muted-foreground text-xs">
									+{selectedSuppliers.length - 8} nhà cung cấp nữa
								</p>
							)}
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Hủy</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleRemoveSelectedSuppliers}
						>
							Xác nhận xóa đã chọn
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
