import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Doc, Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	Download,
	Pencil,
	Plus,
	Search,
	Trash2,
	TriangleAlert,
	Upload,
	UserCircle,
} from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
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

const customerWorkbookColumns = {
	code: "Mã khách hàng",
	name: "Tên khách hàng",
	contactPerson: "Người phụ trách",
	phone: "Điện thoại",
	email: "Email",
	address: "Địa chỉ",
	province: "Tỉnh",
	territory: "Địa bàn",
	taxId: "Mã số thuế",
	billingAddress: "Địa chỉ hóa đơn",
	shippingAddress: "Địa chỉ giao hàng",
	companyDirector: "Giám đốc công ty",
	paymentResponsibleName: "Người phụ trách thanh toán",
	orderResponsibleName: "Người phụ trách nhận đơn",
	employeeCode: "Mã nhân viên phụ trách",
	biddingContactName: "Liên hệ phụ trách thầu",
	biddingContactPhone: "SĐT phụ trách thầu",
	biddingContactNotes: "Ghi chú phụ trách thầu",
	paymentContactName: "Liên hệ phụ trách thanh toán",
	paymentContactPhone: "SĐT phụ trách thanh toán",
	paymentContactNotes: "Ghi chú phụ trách thanh toán",
	receivingContactName: "Liên hệ phụ trách nhận hàng",
	receivingContactPhone: "SĐT phụ trách nhận hàng",
	receivingContactNotes: "Ghi chú phụ trách nhận hàng",
	otherContactName: "Liên hệ khác",
	otherContactPhone: "SĐT liên hệ khác",
	otherContactNotes: "Ghi chú liên hệ khác",
	notes: "Ghi chú",
	isActive: "Trạng thái",
} as const;

const customerWorkbookHeaderOrder = [
	customerWorkbookColumns.code,
	customerWorkbookColumns.name,
	customerWorkbookColumns.contactPerson,
	customerWorkbookColumns.phone,
	customerWorkbookColumns.email,
	customerWorkbookColumns.address,
	customerWorkbookColumns.province,
	customerWorkbookColumns.territory,
	customerWorkbookColumns.taxId,
	customerWorkbookColumns.billingAddress,
	customerWorkbookColumns.shippingAddress,
	customerWorkbookColumns.companyDirector,
	customerWorkbookColumns.paymentResponsibleName,
	customerWorkbookColumns.orderResponsibleName,
	customerWorkbookColumns.employeeCode,
	customerWorkbookColumns.biddingContactName,
	customerWorkbookColumns.biddingContactPhone,
	customerWorkbookColumns.biddingContactNotes,
	customerWorkbookColumns.paymentContactName,
	customerWorkbookColumns.paymentContactPhone,
	customerWorkbookColumns.paymentContactNotes,
	customerWorkbookColumns.receivingContactName,
	customerWorkbookColumns.receivingContactPhone,
	customerWorkbookColumns.receivingContactNotes,
	customerWorkbookColumns.otherContactName,
	customerWorkbookColumns.otherContactPhone,
	customerWorkbookColumns.otherContactNotes,
	customerWorkbookColumns.notes,
	customerWorkbookColumns.isActive,
] as const;

function toCellString(value: unknown) {
	if (value === null || value === undefined) return "";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return value.trim();
	return String(value).trim();
}

function parseActiveStatus(value: string) {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return true;
	if (["hoạt động", "hoat dong", "active", "1", "true", "yes"].includes(normalized)) {
		return true;
	}
	if (["không hoạt động", "khong hoat dong", "inactive", "0", "false", "no"].includes(normalized)) {
		return false;
	}
	throw new Error(`Giá trị trạng thái không hợp lệ: ${value}`);
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
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
	const [provinceFilter, setProvinceFilter] = useState("all");
	const [territoryFilter, setTerritoryFilter] = useState("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<Id<"customers"> | null>(null);
	const [form, setForm] = useState<CustomerForm>(initialForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<Id<"customers"> | null>(null);
	const [selectedCustomerIds, setSelectedCustomerIds] = useState<Id<"customers">[]>([]);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
	const importInputRef = useRef<HTMLInputElement>(null);

	const customers = useQuery(api.customers.list, { activeOnly: false });

	const createCustomer = useMutation(api.customers.create);
	const createManyCustomers = useMutation(api.customers.createMany);
	const updateCustomer = useMutation(api.customers.update);
	const deleteCustomer = useMutation(api.customers.remove);
	const deleteManyCustomers = useMutation(api.customers.removeMany);

	const provinceOptions = useMemo(() => {
		if (!customers) return [];
		return [
			...new Set(
				customers
					.map((customer) => customer.province?.trim())
					.filter((value): value is string => Boolean(value)),
			),
		]
			.sort((a, b) => a.localeCompare(b, "vi"));
	}, [customers]);

	const territoryOptions = useMemo(() => {
		if (!customers) return [];
		return [
			...new Set(
				customers
					.map((customer) => customer.territory?.trim())
					.filter((value): value is string => Boolean(value)),
			),
		]
			.sort((a, b) => a.localeCompare(b, "vi"));
	}, [customers]);

	const filteredCustomers = customers?.filter(
		(customer) => {
			const normalizedSearch = search.trim().toLowerCase();
			const matchesSearch =
				!normalizedSearch ||
				customer.name.toLowerCase().includes(normalizedSearch) ||
				customer.code.toLowerCase().includes(normalizedSearch) ||
				(customer.contactPerson ?? "").toLowerCase().includes(normalizedSearch) ||
				(customer.phone ?? "").toLowerCase().includes(normalizedSearch);
			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" && customer.isActive) ||
				(statusFilter === "inactive" && !customer.isActive);
			const matchesProvince =
				provinceFilter === "all" ||
				(customer.province?.trim() ?? "") === provinceFilter;
			const matchesTerritory =
				territoryFilter === "all" ||
				(customer.territory?.trim() ?? "") === territoryFilter;

			return (
				matchesSearch && matchesStatus && matchesProvince && matchesTerritory
			);
		},
	);

	const filteredCustomerIds = (filteredCustomers ?? []).map((customer) => customer._id);
	const selectedCustomerIdSet = useMemo(
		() => new Set(selectedCustomerIds),
		[selectedCustomerIds],
	);
	const selectedInCurrentFilterCount = filteredCustomerIds.filter((id) =>
		selectedCustomerIdSet.has(id),
	).length;
	const isAllCurrentFilteredSelected =
		filteredCustomerIds.length > 0 &&
		selectedInCurrentFilterCount === filteredCustomerIds.length;

	const selectableCustomers = customers ?? [];
	const selectedCustomers = selectableCustomers.filter((customer) =>
		selectedCustomerIdSet.has(customer._id),
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

	const toggleSelectCustomer = (id: Id<"customers">, checked: boolean) => {
		setSelectedCustomerIds((current) => {
			if (checked) {
				if (current.includes(id)) return current;
				return [...current, id];
			}
			return current.filter((selectedId) => selectedId !== id);
		});
	};

	const toggleSelectAllFiltered = (checked: boolean) => {
		if (!filteredCustomerIds.length) return;
		setSelectedCustomerIds((current) => {
			if (checked) {
				return [...new Set([...current, ...filteredCustomerIds])];
			}
			return current.filter((id) => !filteredCustomerIds.includes(id));
		});
	};

	const handleRemoveSelectedCustomers = async () => {
		if (selectedCustomerIds.length === 0) return;

		try {
			const result = await deleteManyCustomers({ ids: selectedCustomerIds });
			toast.success(`Đã xóa ${result.deletedCount} khách hàng`);
			setSelectedCustomerIds([]);
			setBulkDeleteDialogOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể xóa danh sách khách hàng",
			);
		}
	};

	const handleExportXlsx = async () => {
		if (!filteredCustomers || filteredCustomers.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}

		try {
			const XLSX = await import("xlsx");
			const rows = filteredCustomers.map((customer) => ({
				[customerWorkbookColumns.code]: customer.code,
				[customerWorkbookColumns.name]: customer.name,
				[customerWorkbookColumns.contactPerson]: customer.contactPerson ?? "",
				[customerWorkbookColumns.phone]: customer.phone ?? "",
				[customerWorkbookColumns.email]: customer.email ?? "",
				[customerWorkbookColumns.address]: customer.address ?? "",
				[customerWorkbookColumns.province]: customer.province ?? "",
				[customerWorkbookColumns.territory]: customer.territory ?? "",
				[customerWorkbookColumns.taxId]: customer.taxId ?? "",
				[customerWorkbookColumns.billingAddress]: customer.billingAddress ?? "",
				[customerWorkbookColumns.shippingAddress]: customer.shippingAddress ?? "",
				[customerWorkbookColumns.companyDirector]: customer.companyDirector ?? "",
				[customerWorkbookColumns.paymentResponsibleName]:
					customer.paymentResponsibleName ?? "",
				[customerWorkbookColumns.orderResponsibleName]:
					customer.orderResponsibleName ?? "",
				[customerWorkbookColumns.employeeCode]: customer.employeeCode ?? "",
				[customerWorkbookColumns.biddingContactName]:
					customer.biddingContactName ?? "",
				[customerWorkbookColumns.biddingContactPhone]:
					customer.biddingContactPhone ?? "",
				[customerWorkbookColumns.biddingContactNotes]:
					customer.biddingContactNotes ?? "",
				[customerWorkbookColumns.paymentContactName]:
					customer.paymentContactName ?? "",
				[customerWorkbookColumns.paymentContactPhone]:
					customer.paymentContactPhone ?? "",
				[customerWorkbookColumns.paymentContactNotes]:
					customer.paymentContactNotes ?? "",
				[customerWorkbookColumns.receivingContactName]:
					customer.receivingContactName ?? "",
				[customerWorkbookColumns.receivingContactPhone]:
					customer.receivingContactPhone ?? "",
				[customerWorkbookColumns.receivingContactNotes]:
					customer.receivingContactNotes ?? "",
				[customerWorkbookColumns.otherContactName]: customer.otherContactName ?? "",
				[customerWorkbookColumns.otherContactPhone]: customer.otherContactPhone ?? "",
				[customerWorkbookColumns.otherContactNotes]: customer.otherContactNotes ?? "",
				[customerWorkbookColumns.notes]: customer.notes ?? "",
				[customerWorkbookColumns.isActive]: customer.isActive
					? "Hoạt động"
					: "Không hoạt động",
			}));

			const worksheet = XLSX.utils.json_to_sheet(rows, {
				header: [...customerWorkbookHeaderOrder],
			});
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Khach_hang");

			const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
			const blob = new Blob([output], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "danh-sach-khach-hang.xlsx";
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			toast.success("Đã xuất file XLSX");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xuất file XLSX",
			);
		}
	};

	const handlePickImportFile = () => {
		importInputRef.current?.click();
	};

	const handleImportXlsx = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
				customerWorkbookColumns.code,
				customerWorkbookColumns.name,
			]) {
				if (!headerRow.includes(requiredColumn)) {
					throw new Error(`File import thiếu cột bắt buộc: ${requiredColumn}`);
				}
			}

			const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
				worksheet,
				{ defval: "" },
			);
			const rows = rawRows
				.map((row) => {
					const rawCode = row[customerWorkbookColumns.code];
					const rawPhone = row[customerWorkbookColumns.phone];
					if (typeof rawCode === "number") {
						throw new Error(
							`Mã khách hàng phải ở dạng text để giữ nguyên ký tự: ${rawCode}`,
						);
					}
					if (typeof rawPhone === "number") {
						throw new Error(
							`Điện thoại phải ở dạng text để giữ nguyên số 0 đầu: ${rawPhone}`,
						);
					}

					const orderResponsibleName = formatOptionalString(
						toCellString(row[customerWorkbookColumns.orderResponsibleName]),
					);
					const paymentResponsibleName = formatOptionalString(
						toCellString(row[customerWorkbookColumns.paymentResponsibleName]),
					);
					const biddingContactName = formatOptionalString(
						toCellString(row[customerWorkbookColumns.biddingContactName]),
					);
					const paymentContactName = formatOptionalString(
						toCellString(row[customerWorkbookColumns.paymentContactName]),
					);
					const receivingContactName = formatOptionalString(
						toCellString(row[customerWorkbookColumns.receivingContactName]),
					);
					const otherContactName = formatOptionalString(
						toCellString(row[customerWorkbookColumns.otherContactName]),
					);
					const inputContactPerson = formatOptionalString(
						toCellString(row[customerWorkbookColumns.contactPerson]),
					);

					const biddingContactPhone = formatOptionalString(
						toCellString(row[customerWorkbookColumns.biddingContactPhone]),
					);
					const paymentContactPhone = formatOptionalString(
						toCellString(row[customerWorkbookColumns.paymentContactPhone]),
					);
					const receivingContactPhone = formatOptionalString(
						toCellString(row[customerWorkbookColumns.receivingContactPhone]),
					);
					const otherContactPhone = formatOptionalString(
						toCellString(row[customerWorkbookColumns.otherContactPhone]),
					);
					const inputPhone = formatOptionalString(
						toCellString(row[customerWorkbookColumns.phone]),
					);

					const primaryContact =
						orderResponsibleName ??
						paymentResponsibleName ??
						biddingContactName ??
						paymentContactName ??
						receivingContactName ??
						otherContactName ??
						inputContactPerson;

					const primaryPhone =
						biddingContactPhone ??
						paymentContactPhone ??
						receivingContactPhone ??
						otherContactPhone ??
						inputPhone;

					return {
						code: toCellString(rawCode),
						name: toCellString(row[customerWorkbookColumns.name]),
						contactPerson: primaryContact,
						phone: primaryPhone,
					email: formatOptionalString(toCellString(row[customerWorkbookColumns.email])),
					address: formatOptionalString(
						toCellString(row[customerWorkbookColumns.address]),
					),
					province: formatOptionalString(
						toCellString(row[customerWorkbookColumns.province]),
					),
					territory: formatOptionalString(
						toCellString(row[customerWorkbookColumns.territory]),
					),
					taxId: formatOptionalString(toCellString(row[customerWorkbookColumns.taxId])),
					billingAddress: formatOptionalString(
						toCellString(row[customerWorkbookColumns.billingAddress]),
					),
					shippingAddress: formatOptionalString(
						toCellString(row[customerWorkbookColumns.shippingAddress]),
					),
					companyDirector: formatOptionalString(
						toCellString(row[customerWorkbookColumns.companyDirector]),
					),
					paymentResponsibleName,
					orderResponsibleName,
					employeeCode: formatOptionalString(
						toCellString(row[customerWorkbookColumns.employeeCode]),
					),
					biddingContactName,
					biddingContactPhone,
					biddingContactNotes: formatOptionalString(
						toCellString(row[customerWorkbookColumns.biddingContactNotes]),
					),
					paymentContactName,
					paymentContactPhone,
					paymentContactNotes: formatOptionalString(
						toCellString(row[customerWorkbookColumns.paymentContactNotes]),
					),
					receivingContactName,
					receivingContactPhone,
					receivingContactNotes: formatOptionalString(
						toCellString(row[customerWorkbookColumns.receivingContactNotes]),
					),
					otherContactName,
					otherContactPhone,
					otherContactNotes: formatOptionalString(
						toCellString(row[customerWorkbookColumns.otherContactNotes]),
					),
					notes: formatOptionalString(toCellString(row[customerWorkbookColumns.notes])),
					isActive: parseActiveStatus(
						toCellString(row[customerWorkbookColumns.isActive]),
					),
					};
				})
				.filter((row) => row.code || row.name);

			if (rows.length === 0) {
				throw new Error("File import không có dữ liệu hợp lệ");
			}

			const result = await createManyCustomers({ rows });
			toast.success(`Đã import ${result.count} khách hàng`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể import file XLSX",
			);
		} finally {
			event.target.value = "";
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
					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<CardTitle>Danh sách khách hàng</CardTitle>
							<div className="flex flex-wrap items-center gap-2">
								<Button variant="outline" onClick={handlePickImportFile}>
									<Upload className="mr-2 h-4 w-4" />
									Import XLSX
								</Button>
								<Button variant="outline" onClick={handleExportXlsx}>
									<Download className="mr-2 h-4 w-4" />
									Export XLSX
								</Button>
								<Button
									variant="destructive"
									disabled={selectedCustomers.length === 0}
									onClick={() => setBulkDeleteDialogOpen(true)}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Xóa đã chọn ({selectedCustomers.length})
								</Button>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative min-w-[220px] flex-1">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Tìm kiếm mã, tên, liên hệ, điện thoại..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(value) =>
									setStatusFilter((value as typeof statusFilter) ?? "all")
								}
							>
								<SelectTrigger className="w-[170px]">
									<SelectValue placeholder="Trạng thái" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Tất cả trạng thái</SelectItem>
									<SelectItem value="active">Hoạt động</SelectItem>
									<SelectItem value="inactive">Không hoạt động</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={provinceFilter}
								onValueChange={(value) => setProvinceFilter(value ?? "all")}
							>
								<SelectTrigger className="w-[170px]">
									<SelectValue placeholder="Tỉnh" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Tất cả tỉnh</SelectItem>
									{provinceOptions.map((province) => (
										<SelectItem key={province} value={province}>
											{province}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={territoryFilter}
								onValueChange={(value) => setTerritoryFilter(value ?? "all")}
							>
								<SelectTrigger className="w-[170px]">
									<SelectValue placeholder="Địa bàn" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Tất cả địa bàn</SelectItem>
									{territoryOptions.map((territory) => (
										<SelectItem key={territory} value={territory}>
											{territory}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
									<TableHead className="w-[44px]">
										<Checkbox
											checked={isAllCurrentFilteredSelected}
											onCheckedChange={(checked) =>
												toggleSelectAllFiltered(Boolean(checked))
											}
										/>
									</TableHead>
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
										<TableCell>
											<Checkbox
												checked={selectedCustomerIdSet.has(customer._id)}
												onCheckedChange={(checked) =>
													toggleSelectCustomer(customer._id, Boolean(checked))
												}
											/>
										</TableCell>
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

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-destructive/10 text-destructive">
							<TriangleAlert className="h-5 w-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Xác nhận xóa khách hàng</AlertDialogTitle>
						<AlertDialogDescription>
							Bạn sắp xóa khách hàng này khỏi hệ thống. Hành động không thể hoàn tác.
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
						<AlertDialogTitle>Xác nhận xóa nhiều khách hàng</AlertDialogTitle>
						<AlertDialogDescription>
							Bạn sắp xóa {selectedCustomers.length} khách hàng đã chọn. Hành động
							không thể hoàn tác.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{selectedCustomers.length > 0 && (
						<div className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
							{selectedCustomers.slice(0, 8).map((customer) => (
								<div
									key={customer._id}
									className="flex items-center justify-between gap-3"
								>
									<span className="font-mono text-xs">{customer.code}</span>
									<span className="truncate text-muted-foreground">
										{customer.name}
									</span>
								</div>
							))}
							{selectedCustomers.length > 8 && (
								<p className="text-muted-foreground text-xs">
									+{selectedCustomers.length - 8} khách hàng nữa
								</p>
							)}
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Hủy</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleRemoveSelectedCustomers}
						>
							Xác nhận xóa đã chọn
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
