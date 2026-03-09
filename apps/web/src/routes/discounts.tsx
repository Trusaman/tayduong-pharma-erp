import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	ChevronDown,
	ChevronUp,
	Download,
	FileSpreadsheet,
	Pencil,
	Plus,
	Search,
	Trash2,
	Upload,
	Users,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
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

export const Route = createFileRoute("/discounts")({
	component: DiscountsPage,
});

const discountTypes = [
	"Doctor",
	"hospital",
	"payment",
	"Salesman",
	"Manager",
] as const;

const discountTypeLabels: Record<(typeof discountTypes)[number], string> = {
	Doctor: "Chiết khấu BS",
	hospital: "Chiết khấu NT, KD",
	payment: "Chiết khấu thanh toán",
	Salesman: "Chiết khấu NT, KD",
	Manager: "Chiết khấu Quản lý",
};

type DiscountGroupKey = "doctor" | "sales" | "payment" | "manager";
type DiscountGroupFormState = { salesmanId: string; percent: string };
type DiscountFormState = {
	name: string;
	customerId: string;
	productId: string;
	unitPrice: string;
	createdByStaff: string;
	notes: string;
	doctor: DiscountGroupFormState;
	sales: DiscountGroupFormState;
	payment: DiscountGroupFormState;
	manager: DiscountGroupFormState;
};
type EditDiscountFormState = {
	name: string;
	customerId: string;
	productId: string;
	unitPrice: string;
	createdByStaff: string;
	updatedByStaff: string;
	notes: string;
	salesmanId: string;
	discountPercent: string;
};

const discountGroups: Array<{ key: DiscountGroupKey; label: string }> = [
	{ key: "doctor", label: "Chiết khấu BS" },
	{ key: "sales", label: "Chiết khấu NT, KD" },
	{ key: "payment", label: "Chiết khấu thanh toán" },
	{ key: "manager", label: "Chiết khấu Quản lý" },
];

const discountTypeToGroup: Record<
	(typeof discountTypes)[number],
	DiscountGroupKey
> = {
	Doctor: "doctor",
	hospital: "sales",
	payment: "payment",
	Salesman: "sales",
	Manager: "manager",
};

const groupToDiscountType: Record<
	DiscountGroupKey,
	(typeof discountTypes)[number]
> = {
	doctor: "Doctor",
	sales: "hospital",
	payment: "payment",
	manager: "Manager",
};

const discountTableColumnCount = 1 + 3 + discountGroups.length * 2 + 2;

const discountWorkbookColumns = {
	ruleName: "Tên quy tắc",
	discountTypeCode: "Mã loại chiết khấu",
	discountTypeLabel: "Tên loại chiết khấu",
	customerCode: "Mã khách hàng",
	customerName: "Tên khách hàng",
	productSku: "SKU thuốc",
	productName: "Tên thuốc",
	salesmanCode: "Mã người nhận",
	salesmanName: "Tên người nhận",
	totalDiscountPercent: "Tổng chiết khấu (%)",
	unitPrice: "Đơn giá",
	createdBy: "Người tạo",
	notes: "Ghi chú",
	status: "Trạng thái",
} as const;

const discountWorkbookHeaderOrder = [
	discountWorkbookColumns.ruleName,
	discountWorkbookColumns.discountTypeCode,
	discountWorkbookColumns.discountTypeLabel,
	discountWorkbookColumns.customerCode,
	discountWorkbookColumns.customerName,
	discountWorkbookColumns.productSku,
	discountWorkbookColumns.productName,
	discountWorkbookColumns.salesmanCode,
	discountWorkbookColumns.salesmanName,
	discountWorkbookColumns.totalDiscountPercent,
	discountWorkbookColumns.unitPrice,
	discountWorkbookColumns.createdBy,
	discountWorkbookColumns.notes,
	discountWorkbookColumns.status,
] as const;

const discountImportSheetName = "Nhap_lieu";

const discountTypeCodeByValue: Record<(typeof discountTypes)[number], string> =
	{
		Doctor: "DOCTOR",
		hospital: "HOSPITAL",
		payment: "PAYMENT",
		Salesman: "SALESMAN",
		Manager: "MANAGER",
	};

type DiscountImportRowPayload = {
	name: string;
	discountTypeCode: string;
	discountTypeLabel?: string;
	customerCode?: string;
	customerName?: string;
	productSku?: string;
	productName?: string;
	salesmanCode: string;
	salesmanName?: string;
	discountPercent: string;
	unitPrice?: string;
	createdByStaff: string;
	notes?: string;
	status?: string;
};

const historyFieldLabels: Record<string, string> = {
	name: "Tên quy tắc",
	discountType: "Loại chiết khấu",
	customerId: "Khách hàng",
	productId: "Sản phẩm/Thuốc",
	salesmanId: "Người nhận",
	discountPercent: "Tỷ lệ chiết khấu",
	unitPrice: "Đơn giá",
	createdByStaff: "Người tạo",
	notes: "Ghi chú",
	isActive: "Trạng thái",
};

const createEmptyDiscountForm = (): DiscountFormState => ({
	name: "",
	customerId: "",
	productId: "",
	unitPrice: "",
	createdByStaff: "",
	notes: "",
	doctor: { salesmanId: "", percent: "" },
	sales: { salesmanId: "", percent: "" },
	payment: { salesmanId: "", percent: "" },
	manager: { salesmanId: "", percent: "" },
});

const createEmptyEditForm = (): EditDiscountFormState => ({
	name: "",
	customerId: "",
	productId: "",
	unitPrice: "",
	createdByStaff: "",
	updatedByStaff: "",
	notes: "",
	salesmanId: "",
	discountPercent: "",
});

function DiscountsPage() {
	const [salesmanDialogOpen, setSalesmanDialogOpen] = useState(false);
	const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
	const [editingRuleId, setEditingRuleId] =
		useState<Id<"discountRules"> | null>(null);
	const [editingRuleName, setEditingRuleName] = useState("");
	const [expandedRuleIds, setExpandedRuleIds] = useState<string[]>([]);
	const [search, setSearch] = useState("");
	const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
	const [pendingRemovedRuleIds, setPendingRemovedRuleIds] = useState<string[]>(
		[],
	);
	const importInputRef = useRef<HTMLInputElement | null>(null);
	const [salesmanForm, setSalesmanForm] = useState({
		name: "",
		code: "",
		phone: "",
		notes: "",
	});
	const [discountForm, setDiscountForm] = useState<DiscountFormState>(
		createEmptyDiscountForm,
	);
	const [editForm, setEditForm] =
		useState<EditDiscountFormState>(createEmptyEditForm);

	const salesmen = useQuery(api.salesmen.list, { activeOnly: true });
	const customers = useQuery(api.customers.list, { activeOnly: true });
	const products = useQuery(api.products.list, { activeOnly: true });
	const rules = useQuery(api.discounts.listWithDetails, { activeOnly: false });
	type DiscountRuleRow = NonNullable<typeof rules>[number];
	type DiscountRuleGroupRow = {
		id: string;
		name: string;
		customerId?: DiscountRuleRow["customerId"];
		customer: DiscountRuleRow["customer"] | null;
		productId?: DiscountRuleRow["productId"];
		product: DiscountRuleRow["product"] | null;
		unitPrice?: DiscountRuleRow["unitPrice"];
		createdByStaff: string;
		notes?: DiscountRuleRow["notes"];
		createdAt: number;
		updatedAt: number;
		totalDiscountPercent: number;
		ruleIds: string[];
		groupRules: DiscountRuleRow[];
		rulesByGroup: Partial<Record<DiscountGroupKey, DiscountRuleRow>>;
	};

	const createSalesman = useMutation(api.salesmen.create);
	const createDiscount = useMutation(api.discounts.create);
	const updateDiscount = useMutation(api.discounts.update);
	const removeDiscount = useMutation(api.discounts.remove);
	const removeManyDiscounts = useMutation(api.discounts.removeMany);
	const importDiscounts = useMutation(api.discounts.importMany);

	const editingRule = editingRuleId
		? (rules?.find((rule) => rule._id === editingRuleId) ?? null)
		: null;

	const getCustomerDisplayName = (customerId: string) => {
		if (!customerId) return undefined;

		return (
			customers?.find((customer) => customer._id === customerId)?.name ??
			(editingRule?.customer?._id === customerId
				? editingRule.customer.name
				: undefined)
		);
	};

	const getProductDisplayName = (productId: string) => {
		if (!productId) return undefined;

		return (
			products?.find((product) => product._id === productId)?.name ??
			(editingRule?.product?._id === productId
				? editingRule.product.name
				: undefined)
		);
	};

	const getSalesmanDisplayName = (salesmanId: string) => {
		if (!salesmanId) return undefined;

		return (
			salesmen?.find((salesman) => salesman._id === salesmanId)?.name ??
			(editingRule?.salesman?._id === salesmanId
				? editingRule.salesman.name
				: undefined)
		);
	};

	const formatDate = (timestamp: number) =>
		new Date(timestamp).toLocaleDateString("vi-VN");
	const formatDateTime = (timestamp: number) =>
		new Date(timestamp).toLocaleString("vi-VN");
	const formatDecimalNumber = (value: number) =>
		new Intl.NumberFormat("vi-VN", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		}).format(value);
	const formatPercentValue = (value: number) =>
		`${formatDecimalNumber(value)}%`;

	const getRuleGroupStatus = (groupRules: DiscountRuleRow[]) => {
		const activeCount = groupRules.filter((rule) => rule.isActive).length;

		if (activeCount === groupRules.length) {
			return {
				label: "Hoat dong",
				className: "font-medium text-emerald-600 text-xs",
				nextActionLabel: "Tam dung",
				nextIsActive: false,
			};
		}

		if (activeCount === 0) {
			return {
				label: "Tam dung",
				className: "font-medium text-muted-foreground text-xs",
				nextActionLabel: "Kich hoat",
				nextIsActive: true,
			};
		}

		return {
			label: `Hoat dong ${activeCount}/${groupRules.length}`,
			className: "font-medium text-amber-600 text-xs",
			nextActionLabel: "Kich hoat tat ca",
			nextIsActive: true,
		};
	};

	const parseLocalizedNumber = (value: string): number | undefined => {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		const cleaned = trimmed.replace(/\s+/g, "");
		if (!/^[\d.,]+$/.test(cleaned)) return undefined;

		const commaCount = cleaned.split(",").length - 1;
		const dotCount = cleaned.split(".").length - 1;
		let normalized = cleaned;

		if (commaCount > 0 && dotCount > 0) {
			const decimalSeparator =
				cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
			const separatorIndex = cleaned.lastIndexOf(decimalSeparator);
			const integerPart = cleaned.slice(0, separatorIndex).replace(/[.,]/g, "");
			const decimalPart = cleaned
				.slice(separatorIndex + 1)
				.replace(/[.,]/g, "");
			normalized = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
		} else if (commaCount > 1 || dotCount > 1) {
			normalized = cleaned.replace(commaCount > 1 ? /,/g : /\./g, "");
		} else if (commaCount === 1 || dotCount === 1) {
			const separator = commaCount === 1 ? "," : ".";
			const separatorIndex = cleaned.lastIndexOf(separator);
			const digitsAfter = cleaned.length - separatorIndex - 1;
			const shouldTreatAsThousands =
				digitsAfter === 3 && !cleaned.startsWith(`0${separator}`);

			normalized = shouldTreatAsThousands
				? cleaned.replace(separator === "," ? /,/g : /\./g, "")
				: cleaned.replace(separator, ".");
		}

		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : undefined;
	};

	const parseDecimalInput = (value: string): number | undefined =>
		parseLocalizedNumber(value);

	const closeEditDialog = () => {
		setEditDialogOpen(false);
		setEditingRuleId(null);
		setEditingRuleName("");
		setEditForm(createEmptyEditForm());
	};

	const historyValue = (value?: string) => value ?? "Trống";

	const handleCreateSalesman = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await createSalesman({
				name: salesmanForm.name,
				code: salesmanForm.code,
				phone: salesmanForm.phone || undefined,
				notes: salesmanForm.notes || undefined,
			});
			setSalesmanDialogOpen(false);
			setSalesmanForm({ name: "", code: "", phone: "", notes: "" });
			toast.success("Đã tạo người nhận chiết khấu");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không thể tạo");
		}
	};

	const handleCreateDiscount = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const parsedUnitPrice = parseDecimalInput(discountForm.unitPrice);
			if (
				discountForm.unitPrice.trim() &&
				typeof parsedUnitPrice !== "number"
			) {
				toast.error("Đơn giá không hợp lệ");
				return;
			}
			if (typeof parsedUnitPrice === "number" && parsedUnitPrice < 0) {
				toast.error("Đơn giá không được âm");
				return;
			}

			const rulesToCreate: Array<{
				discountType: (typeof discountTypes)[number];
				salesmanId: Id<"salesmen">;
				percent: number;
			}> = [];
			const ruleGroupId = crypto.randomUUID();

			for (const group of discountGroups) {
				const groupData = discountForm[group.key];
				if (
					groupData.percent &&
					Number(groupData.percent) > 0 &&
					groupData.salesmanId
				) {
					rulesToCreate.push({
						discountType: groupToDiscountType[group.key],
						salesmanId: groupData.salesmanId as Id<"salesmen">,
						percent: Number(groupData.percent),
					});
				}
			}

			if (rulesToCreate.length === 0) {
				toast.error("Vui lòng nhập ít nhất một loại chiết khấu");
				return;
			}

			for (const rule of rulesToCreate) {
				await createDiscount({
					ruleGroupId,
					name:
						discountForm.name ||
						`${discountTypeLabels[rule.discountType]} - ${new Date().toLocaleDateString("vi-VN")}`,
					discountType: rule.discountType,
					customerId: discountForm.customerId
						? (discountForm.customerId as Id<"customers">)
						: undefined,
					productId: discountForm.productId
						? (discountForm.productId as Id<"products">)
						: undefined,
					unitPrice: parsedUnitPrice,
					salesmanId: rule.salesmanId,
					discountPercent: rule.percent,
					createdByStaff: discountForm.createdByStaff,
					notes: discountForm.notes || undefined,
				});
			}

			setDiscountDialogOpen(false);
			setDiscountForm(createEmptyDiscountForm());
			toast.success(
				`Da tao 1 nhom chiet khau voi ${rulesToCreate.length} loai`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể tạo quy tắc chiết khấu",
			);
		}
	};

	const handleEditDiscount = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingRuleId || !editingRule) {
			toast.error("Không tìm thấy quy tắc cần sửa");
			return;
		}

		try {
			const parsedUnitPrice = parseDecimalInput(editForm.unitPrice);
			if (editForm.unitPrice.trim() && typeof parsedUnitPrice !== "number") {
				toast.error("Đơn giá không hợp lệ");
				return;
			}

			const parsedDiscountPercent = Number(editForm.discountPercent);
			if (
				!editForm.discountPercent.trim() ||
				!Number.isFinite(parsedDiscountPercent) ||
				parsedDiscountPercent < 0 ||
				parsedDiscountPercent > 100
			) {
				toast.error("Tỷ lệ chiết khấu phải từ 0 đến 100");
				return;
			}

			if (!editForm.salesmanId) {
				toast.error("Vui lòng chọn người nhận");
				return;
			}

			if (!editForm.updatedByStaff.trim()) {
				toast.error("Vui lòng nhập người chỉnh sửa");
				return;
			}

			await updateDiscount({
				id: editingRuleId,
				name: editForm.name.trim(),
				customerId: editForm.customerId
					? (editForm.customerId as Id<"customers">)
					: undefined,
				productId: editForm.productId
					? (editForm.productId as Id<"products">)
					: undefined,
				salesmanId: editForm.salesmanId as Id<"salesmen">,
				discountPercent: parsedDiscountPercent,
				unitPrice: parsedUnitPrice,
				createdByStaff: editForm.createdByStaff.trim(),
				updatedByStaff: editForm.updatedByStaff.trim(),
				notes: editForm.notes.trim() ? editForm.notes.trim() : undefined,
			});

			closeEditDialog();
			toast.success("Đã cập nhật quy tắc chiết khấu");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể cập nhật quy tắc chiết khấu",
			);
		}
	};

	const toggleRuleActive = async (
		id: Id<"discountRules">,
		isActive: boolean,
	) => {
		try {
			await updateDiscount({ id, isActive: !isActive });
			toast.success("Đã cập nhật quy tắc chiết khấu");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể cập nhật quy tắc chiết khấu",
			);
		}
	};

	const handleRemoveDiscount = async (id: Id<"discountRules">) => {
		try {
			await removeDiscount({ id });
			setSelectedRuleIds((prev) =>
				prev.filter((ruleId) => ruleId !== String(id)),
			);
			toast.success("Đã xóa quy tắc chiết khấu");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể xóa quy tắc chiết khấu",
			);
		}
	};

	useEffect(() => {
		if (!rules) return;
		const activeRuleIdSet = new Set(rules.map((rule) => String(rule._id)));
		setPendingRemovedRuleIds((prev) =>
			prev.filter((id) => activeRuleIdSet.has(id)),
		);
	}, [rules]);

	const filteredRuleGroups = (() => {
		if (!rules) return undefined;

		const keyword = search.trim().toLowerCase();
		const groupedRules = new Map<string, DiscountRuleGroupRow>();

		for (const rule of rules) {
			if (pendingRemovedRuleIds.includes(String(rule._id))) continue;

			const groupId = rule.ruleGroupId?.trim() || String(rule._id);
			const existingGroup = groupedRules.get(groupId);

			if (existingGroup) {
				existingGroup.totalDiscountPercent += rule.discountPercent;
				existingGroup.updatedAt = Math.max(
					existingGroup.updatedAt,
					rule.updatedAt,
				);
				existingGroup.createdAt = Math.min(
					existingGroup.createdAt,
					rule.createdAt,
				);
				existingGroup.ruleIds.push(String(rule._id));
				existingGroup.groupRules.push(rule);

				const groupKey = discountTypeToGroup[rule.discountType];
				const currentRule = existingGroup.rulesByGroup[groupKey];
				if (!currentRule || rule.updatedAt >= currentRule.updatedAt) {
					existingGroup.rulesByGroup[groupKey] = rule;
				}

				continue;
			}

			groupedRules.set(groupId, {
				id: groupId,
				name: rule.name,
				customerId: rule.customerId,
				customer: rule.customer ?? null,
				productId: rule.productId,
				product: rule.product ?? null,
				unitPrice: rule.unitPrice,
				createdByStaff: rule.createdByStaff,
				notes: rule.notes,
				createdAt: rule.createdAt,
				updatedAt: rule.updatedAt,
				totalDiscountPercent: rule.discountPercent,
				ruleIds: [String(rule._id)],
				groupRules: [rule],
				rulesByGroup: {
					[discountTypeToGroup[rule.discountType]]: rule,
				},
			});
		}

		return Array.from(groupedRules.values())
			.filter((group) => {
				if (!keyword) return true;
				return (group.product?.name ?? "").toLowerCase().includes(keyword);
			})
			.sort((left, right) => right.createdAt - left.createdAt);
	})();

	const visibleRuleIds = (filteredRuleGroups ?? []).map((group) => group.id);
	const visibleRuleIdsKey = visibleRuleIds.join("||");
	const allVisibleSelected =
		visibleRuleIds.length > 0 &&
		visibleRuleIds.every((id) => selectedRuleIds.includes(id));
	const selectedRuleGroups = (filteredRuleGroups ?? []).filter((group) =>
		selectedRuleIds.includes(group.id),
	);

	useEffect(() => {
		const visibleIdSet = new Set(
			visibleRuleIdsKey ? visibleRuleIdsKey.split("||") : [],
		);

		setSelectedRuleIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
	}, [visibleRuleIdsKey]);

	const toggleRuleSelection = (ruleId: string, checked: boolean) => {
		setSelectedRuleIds((prev) =>
			checked
				? prev.includes(ruleId)
					? prev
					: [...prev, ruleId]
				: prev.filter((id) => id !== ruleId),
		);
	};

	const toggleSelectAllVisible = (checked: boolean) => {
		if (checked) {
			setSelectedRuleIds((prev) => {
				const next = new Set(prev);
				for (const id of visibleRuleIds) next.add(id);
				return [...next];
			});
			return;
		}
		setSelectedRuleIds((prev) =>
			prev.filter((id) => !visibleRuleIds.includes(id)),
		);
	};

	const toggleRuleGroupActive = async (group: DiscountRuleGroupRow) => {
		const status = getRuleGroupStatus(group.groupRules);
		const targetRules = group.groupRules.filter(
			(rule) => rule.isActive !== status.nextIsActive,
		);

		if (targetRules.length === 0) return;

		try {
			await Promise.all(
				targetRules.map((rule) =>
					updateDiscount({ id: rule._id, isActive: status.nextIsActive }),
				),
			);
			toast.success("Da cap nhat trang thai nhom chiet khau");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Khong the cap nhat trang thai nhom chiet khau",
			);
		}
	};

	const handleRemoveDiscountGroup = async (group: DiscountRuleGroupRow) => {
		const removingIds = [...group.ruleIds];

		try {
			setPendingRemovedRuleIds((prev) => [
				...new Set([...prev, ...removingIds]),
			]);
			setExpandedRuleIds((prev) => prev.filter((id) => id !== group.id));
			setSelectedRuleIds((prev) => prev.filter((id) => id !== group.id));
			await removeManyDiscounts({
				ids: removingIds as Id<"discountRules">[],
			});
			toast.success("Da xoa nhom chiet khau");
		} catch (error) {
			setPendingRemovedRuleIds((prev) =>
				prev.filter((id) => !removingIds.includes(id)),
			);
			toast.error(
				error instanceof Error
					? error.message
					: "Khong the xoa nhom chiet khau",
			);
		}
	};

	const handleRemoveSelectedDiscounts = async () => {
		if (selectedRuleGroups.length === 0) return;
		const removingIds = [
			...new Set(selectedRuleGroups.flatMap((group) => group.ruleIds)),
		];
		const removingGroupIds = selectedRuleGroups.map((group) => group.id);

		try {
			setBulkDeleteDialogOpen(false);
			setPendingRemovedRuleIds((prev) => [
				...new Set([...prev, ...removingIds]),
			]);
			setExpandedRuleIds((prev) =>
				prev.filter((id) => !removingGroupIds.includes(id)),
			);
			setSelectedRuleIds([]);
			await removeManyDiscounts({
				ids: removingIds as Id<"discountRules">[],
			});
			toast.success(`Da xoa ${selectedRuleGroups.length} nhom chiet khau`);
		} catch (error) {
			setPendingRemovedRuleIds((prev) =>
				prev.filter((id) => !removingIds.includes(id)),
			);
			setSelectedRuleIds(removingGroupIds);
			toast.error(
				error instanceof Error
					? error.message
					: "Khong the xoa danh sach nhom chiet khau",
			);
		}
	};

	const toCellString = (value: unknown) => {
		if (value === null || value === undefined) return "";
		if (typeof value === "number") return String(value);
		if (typeof value === "string") return value.trim();
		return String(value).trim();
	};

	const handleExportXlsx = async () => {
		if (!filteredRuleGroups || filteredRuleGroups.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}

		try {
			const XLSX = await import("xlsx");
			const rows = filteredRuleGroups.flatMap((group) =>
				group.groupRules.map((rule) => ({
					[discountWorkbookColumns.ruleName]: rule.name,
					[discountWorkbookColumns.discountTypeCode]:
						discountTypeCodeByValue[rule.discountType],
					[discountWorkbookColumns.discountTypeLabel]:
						discountTypeLabels[rule.discountType],
					[discountWorkbookColumns.customerCode]: rule.customer?.code ?? "",
					[discountWorkbookColumns.customerName]: rule.customer?.name ?? "",
					[discountWorkbookColumns.productSku]: rule.product?.sku ?? "",
					[discountWorkbookColumns.productName]: rule.product?.name ?? "",
					[discountWorkbookColumns.salesmanCode]: rule.salesman?.code ?? "",
					[discountWorkbookColumns.salesmanName]: rule.salesman?.name ?? "",
					[discountWorkbookColumns.totalDiscountPercent]: rule.discountPercent,
					[discountWorkbookColumns.unitPrice]:
						typeof rule.unitPrice === "number" ? rule.unitPrice : "",
					[discountWorkbookColumns.createdBy]: rule.createdByStaff,
					[discountWorkbookColumns.notes]: rule.notes ?? "",
					[discountWorkbookColumns.status]: rule.isActive
						? "active"
						: "inactive",
				})),
			);

			const worksheet = XLSX.utils.json_to_sheet(rows, {
				header: [...discountWorkbookHeaderOrder],
			});
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				worksheet,
				discountImportSheetName,
			);

			const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
			const blob = new Blob([output], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "discount-rules.xlsx";
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

	const handleDownloadTemplate = async () => {
		try {
			const XLSX = await import("xlsx");

			const inputSheet = XLSX.utils.aoa_to_sheet([
				[...discountWorkbookHeaderOrder],
			]);

			const exampleRows = [
				{
					[discountWorkbookColumns.ruleName]: "CK BS Cty A - AMOX500",
					[discountWorkbookColumns.discountTypeCode]: "DOCTOR",
					[discountWorkbookColumns.discountTypeLabel]: "Chiết khấu BS",
					[discountWorkbookColumns.customerCode]: "KH001",
					[discountWorkbookColumns.customerName]: "Nhà thuốc Minh Tâm",
					[discountWorkbookColumns.productSku]: "AMOX500",
					[discountWorkbookColumns.productName]: "Amoxicillin 500mg",
					[discountWorkbookColumns.salesmanCode]: "NVKD01",
					[discountWorkbookColumns.salesmanName]: "Nguyễn Văn A",
					[discountWorkbookColumns.totalDiscountPercent]: 8,
					[discountWorkbookColumns.unitPrice]: 125000,
					[discountWorkbookColumns.createdBy]: "Phòng kinh doanh",
					[discountWorkbookColumns.notes]: "Áp dụng quý 1",
					[discountWorkbookColumns.status]: "active",
				},
				{
					[discountWorkbookColumns.ruleName]: "CK thanh toán toàn hệ thống",
					[discountWorkbookColumns.discountTypeCode]: "PAYMENT",
					[discountWorkbookColumns.discountTypeLabel]: "Chiết khấu thanh toán",
					[discountWorkbookColumns.customerCode]: "",
					[discountWorkbookColumns.customerName]: "",
					[discountWorkbookColumns.productSku]: "",
					[discountWorkbookColumns.productName]: "",
					[discountWorkbookColumns.salesmanCode]: "NVKD02",
					[discountWorkbookColumns.salesmanName]: "Trần Thị B",
					[discountWorkbookColumns.totalDiscountPercent]: 2.5,
					[discountWorkbookColumns.unitPrice]: "",
					[discountWorkbookColumns.createdBy]: "Kế toán",
					[discountWorkbookColumns.notes]: "Áp dụng toàn bộ khách/sản phẩm",
					[discountWorkbookColumns.status]: "inactive",
				},
			];

			const exampleSheet = XLSX.utils.json_to_sheet(exampleRows, {
				header: [...discountWorkbookHeaderOrder],
			});

			const guideSheet = XLSX.utils.aoa_to_sheet([
				["Hướng dẫn import bảng chiết khấu"],
				[
					`1) Nhập dữ liệu vào sheet ${discountImportSheetName} theo đúng tiêu đề cột.`,
				],
				["2) Không đổi tên tiêu đề cột, không import theo tên nếu thiếu mã."],
				["3) Mã khách hàng và SKU thuốc để trống nghĩa là áp dụng toàn cục."],
				["4) Mã người nhận là bắt buộc."],
				[
					"5) discount type code hợp lệ: DOCTOR, HOSPITAL, PAYMENT, SALESMAN, MANAGER.",
				],
				[
					"6) HOSPITAL và SALESMAN đều hiển thị tại nhóm Chiết khấu NT, KD trên giao diện.",
				],
				["7) status hợp lệ: active/inactive (chấp nhận hoat_dong/tam_dung)."],
				["8) Tổng chiết khấu (%) từ 0 đến 100, Đơn giá >= 0 hoặc để trống."],
			]);

			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				inputSheet,
				discountImportSheetName,
			);
			XLSX.utils.book_append_sheet(workbook, exampleSheet, "Vi_du");
			XLSX.utils.book_append_sheet(workbook, guideSheet, "Huong_dan");

			const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
			const blob = new Blob([output], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "mau-import-chiet-khau.xlsx";
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			toast.success("Đã tải file mẫu XLSX");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể tạo file mẫu XLSX",
			);
		}
	};

	const handlePickImportFile = () => {
		importInputRef.current?.click();
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
			const targetSheetName = workbook.SheetNames.find(
				(sheetName) => sheetName === discountImportSheetName,
			);
			if (!targetSheetName) {
				throw new Error(`File import phải có sheet ${discountImportSheetName}`);
			}

			const worksheet = workbook.Sheets[targetSheetName];
			const headerRows = XLSX.utils.sheet_to_json<Array<string | number>>(
				worksheet,
				{
					header: 1,
					defval: "",
				},
			);
			const headerRow = (headerRows[0] ?? []).map((cell) => toCellString(cell));
			const missingHeaders = discountWorkbookHeaderOrder.filter(
				(header) => !headerRow.includes(header),
			);
			if (missingHeaders.length > 0) {
				throw new Error(`File import thiếu cột: ${missingHeaders.join(", ")}`);
			}

			const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
				worksheet,
				{
					defval: "",
				},
			);

			const rows: DiscountImportRowPayload[] = rawRows
				.map((row) => ({
					name: toCellString(row[discountWorkbookColumns.ruleName]),
					discountTypeCode: toCellString(
						row[discountWorkbookColumns.discountTypeCode],
					),
					discountTypeLabel: toCellString(
						row[discountWorkbookColumns.discountTypeLabel],
					),
					customerCode: toCellString(row[discountWorkbookColumns.customerCode]),
					customerName: toCellString(row[discountWorkbookColumns.customerName]),
					productSku: toCellString(row[discountWorkbookColumns.productSku]),
					productName: toCellString(row[discountWorkbookColumns.productName]),
					salesmanCode: toCellString(row[discountWorkbookColumns.salesmanCode]),
					salesmanName: toCellString(row[discountWorkbookColumns.salesmanName]),
					discountPercent: toCellString(
						row[discountWorkbookColumns.totalDiscountPercent],
					),
					unitPrice: toCellString(row[discountWorkbookColumns.unitPrice]),
					createdByStaff: toCellString(row[discountWorkbookColumns.createdBy]),
					notes: toCellString(row[discountWorkbookColumns.notes]),
					status: toCellString(row[discountWorkbookColumns.status]),
				}))
				.filter((row) =>
					Object.values(row).some((value) =>
						typeof value === "string" ? value.trim().length > 0 : false,
					),
				);

			if (rows.length === 0) {
				throw new Error("Sheet import không có dữ liệu hợp lệ");
			}

			const result = await importDiscounts({ rows });
			toast.success(
				`Import thành công ${result.createdCount} quy tắc (${result.inactiveCount} tạm dừng)`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể import file XLSX",
			);
		} finally {
			event.target.value = "";
		}
	};

	const handleUnitPriceBlur = () =>
		setDiscountForm((prev) => {
			const parsed = parseDecimalInput(prev.unitPrice);
			return {
				...prev,
				unitPrice:
					typeof parsed === "number" ? formatDecimalNumber(parsed) : "",
			};
		});

	const handleEditUnitPriceBlur = () =>
		setEditForm((prev) => {
			const parsed = parseDecimalInput(prev.unitPrice);
			return {
				...prev,
				unitPrice:
					typeof parsed === "number" ? formatDecimalNumber(parsed) : "",
			};
		});

	const updateGroupField = (
		groupKey: DiscountGroupKey,
		field: "salesmanId" | "percent",
		value: string,
	) =>
		setDiscountForm((prev) => ({
			...prev,
			[groupKey]: { ...prev[groupKey], [field]: value },
		}));

	const toggleRuleDetails = (id: string) => {
		const targetId = String(id);
		setExpandedRuleIds((prev) =>
			prev.includes(targetId)
				? prev.filter((ruleId) => ruleId !== targetId)
				: [...prev, targetId],
		);
	};

	const startEditingRule = (rule: DiscountRuleRow) => {
		setEditingRuleId(rule._id);
		setEditingRuleName(rule.name);
		setEditForm({
			name: rule.name,
			customerId: rule.customerId ?? "",
			productId: rule.productId ?? "",
			unitPrice:
				typeof rule.unitPrice === "number"
					? formatDecimalNumber(rule.unitPrice)
					: "",
			createdByStaff: rule.createdByStaff,
			updatedByStaff: "",
			notes: rule.notes ?? "",
			salesmanId: rule.salesmanId,
			discountPercent: String(rule.discountPercent),
		});
		setEditDialogOpen(true);
	};

	const updateDiscountFormCustomer = (value: string | null) => {
		if (!value) return;
		setDiscountForm({
			...discountForm,
			customerId: value === "all-customers" ? "" : value,
		});
	};

	const updateDiscountFormProduct = (value: string | null) => {
		if (!value) return;
		setDiscountForm({
			...discountForm,
			productId: value === "all-products" ? "" : value,
		});
	};

	const updateEditFormCustomer = (value: string | null) => {
		if (!value) return;
		setEditForm({
			...editForm,
			customerId: value === "all-customers" ? "" : value,
		});
	};

	const updateEditFormProduct = (value: string | null) => {
		if (!value) return;
		setEditForm({
			...editForm,
			productId: value === "all-products" ? "" : value,
		});
	};

	const updateEditFormSalesman = (value: string | null) => {
		if (!value) return;
		setEditForm({ ...editForm, salesmanId: value });
	};

	const updateCreateGroupSalesman = (
		groupKey: DiscountGroupKey,
		value: string | null,
	) => {
		if (!value) return;
		updateGroupField(groupKey, "salesmanId", value);
	};

	const totalDiscountPercent = discountGroups.reduce((total, group) => {
		const groupPercent = Number(discountForm[group.key].percent);
		return Number.isFinite(groupPercent) && groupPercent > 0
			? total + groupPercent
			: total;
	}, 0);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Chiết khấu</h2>
					<p className="text-muted-foreground">
						Quản lý chiết khấu theo bác sĩ, nhà thuốc, thanh toán và quản lý.
					</p>
				</div>
				<div className="flex gap-2">
					<Dialog
						open={salesmanDialogOpen}
						onOpenChange={setSalesmanDialogOpen}
					>
						<DialogTrigger asChild>
							<Button variant="outline">
								<Users className="mr-2 h-4 w-4" />
								Thêm người nhận chiết khấu
							</Button>
						</DialogTrigger>
						<DialogContent>
							<form onSubmit={handleCreateSalesman}>
								<DialogHeader>
									<DialogTitle>Thêm người nhận chiết khấu</DialogTitle>
									<DialogDescription>Thêm người nhận mới.</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Họ tên *</Label>
											<Input
												value={salesmanForm.name}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														name: e.target.value,
													})
												}
												required
											/>
										</div>
										<div className="space-y-2">
											<Label>Mã *</Label>
											<Input
												value={salesmanForm.code}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														code: e.target.value,
													})
												}
												required
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Số điện thoại</Label>
											<Input
												value={salesmanForm.phone}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														phone: e.target.value,
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Ghi chú</Label>
											<Input
												value={salesmanForm.notes}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														notes: e.target.value,
													})
												}
											/>
										</div>
									</div>
								</div>
								<DialogFooter>
									<Button type="submit">Tạo</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>

					<Dialog
						open={discountDialogOpen}
						onOpenChange={setDiscountDialogOpen}
					>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Thêm chiết khấu
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
							<form onSubmit={handleCreateDiscount}>
								<DialogHeader>
									<DialogTitle>Thêm chiết khấu</DialogTitle>
									<DialogDescription>
										Nhập tỷ lệ chiết khấu cho từng loại.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Tên quy tắc</Label>
											<Input
												value={discountForm.name}
												onChange={(e) =>
													setDiscountForm({
														...discountForm,
														name: e.target.value,
													})
												}
												placeholder="Tự động nếu để trống"
											/>
										</div>
										<div className="space-y-2">
											<Label>Người tạo *</Label>
											<Input
												value={discountForm.createdByStaff}
												onChange={(e) =>
													setDiscountForm({
														...discountForm,
														createdByStaff: e.target.value,
													})
												}
												required
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Khách hàng</Label>
											<Select
												value={discountForm.customerId || "all-customers"}
												onValueChange={updateDiscountFormCustomer}
											>
												<SelectTrigger>
													<SelectValue placeholder="Tất cả khách hàng">
														{discountForm.customerId
															? getCustomerDisplayName(discountForm.customerId)
															: "Tất cả khách hàng"}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all-customers">
														Tất cả khách hàng
													</SelectItem>
													{customers?.map((customer) => (
														<SelectItem key={customer._id} value={customer._id}>
															{customer.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Sản phẩm/Thuốc</Label>
											<Select
												value={discountForm.productId || "all-products"}
												onValueChange={updateDiscountFormProduct}
											>
												<SelectTrigger>
													<SelectValue placeholder="Tất cả sản phẩm">
														{discountForm.productId
															? getProductDisplayName(discountForm.productId)
															: "Tất cả sản phẩm"}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all-products">
														Tất cả sản phẩm
													</SelectItem>
													{products?.map((product) => (
														<SelectItem key={product._id} value={product._id}>
															{product.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className="space-y-2">
										<Label>Đơn giá</Label>
										<Input
											value={discountForm.unitPrice}
											onChange={(e) =>
												setDiscountForm({
													...discountForm,
													unitPrice: e.target.value.replace(/[^\d.,\s]/g, ""),
												})
											}
											onBlur={handleUnitPriceBlur}
											inputMode="decimal"
											placeholder="VD: 125.000,50"
										/>
									</div>
									<div className="space-y-4 rounded-lg border p-4">
										<h4 className="font-medium text-sm">Chi tiết chiết khấu</h4>
										{discountGroups.map((group) => (
											<div
												key={group.key}
												className="grid grid-cols-3 items-end gap-4"
											>
												<div className="space-y-2">
													<Label>{group.label}</Label>
													<div className="flex items-center gap-2">
														<Input
															type="number"
															min="0"
															max="100"
															step="0.01"
															value={discountForm[group.key].percent}
															onChange={(e) =>
																updateGroupField(
																	group.key,
																	"percent",
																	e.target.value,
																)
															}
															className="w-24"
														/>
														<span className="text-muted-foreground text-sm">
															%
														</span>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Người nhận</Label>
													<Select
														value={discountForm[group.key].salesmanId}
														onValueChange={(value) =>
															updateCreateGroupSalesman(group.key, value)
														}
													>
														<SelectTrigger>
															<SelectValue placeholder="Chọn người nhận">
																{discountForm[group.key].salesmanId
																	? getSalesmanDisplayName(
																			discountForm[group.key].salesmanId,
																		)
																	: undefined}
															</SelectValue>
														</SelectTrigger>
														<SelectContent>
															{salesmen?.map((salesman) => (
																<SelectItem
																	key={salesman._id}
																	value={salesman._id}
																>
																	{salesman.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-2">
													<Label>Tổng chiết khấu %</Label>
													<div className="flex h-9 items-center text-muted-foreground text-sm">
														{discountForm[group.key].percent &&
														Number(discountForm[group.key].percent) > 0
															? formatPercentValue(
																	Number(discountForm[group.key].percent),
																)
															: "-"}
													</div>
												</div>
											</div>
										))}
										<div className="flex items-center justify-end border-t pt-4">
											<div className="text-right">
												<div className="text-muted-foreground text-xs">
													Tổng chiết khấu %
												</div>
												<div className="font-medium text-sm">
													{totalDiscountPercent > 0
														? formatPercentValue(totalDiscountPercent)
														: "-"}
												</div>
											</div>
										</div>
									</div>
									<div className="space-y-2">
										<Label>Ghi chú</Label>
										<Textarea
											value={discountForm.notes}
											onChange={(e) =>
												setDiscountForm({
													...discountForm,
													notes: e.target.value,
												})
											}
										/>
									</div>
								</div>
								<DialogFooter>
									<Button type="submit">Tạo quy tắc</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<Dialog
				open={editDialogOpen}
				onOpenChange={(open) => !open && closeEditDialog()}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
					<form onSubmit={handleEditDiscount}>
						<DialogHeader>
							<DialogTitle>Chỉnh sửa chiết khấu</DialogTitle>
							<DialogDescription>
								Cập nhật quy tắc{" "}
								<strong>{editingRuleName || "đang chọn"}</strong>.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Tên quy tắc *</Label>
									<Input
										value={editForm.name}
										onChange={(e) =>
											setEditForm({ ...editForm, name: e.target.value })
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label>Loại chiết khấu</Label>
									<Input
										value={
											editingRule
												? discountTypeLabels[editingRule.discountType]
												: ""
										}
										readOnly
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Người tạo *</Label>
									<Input
										value={editForm.createdByStaff}
										onChange={(e) =>
											setEditForm({
												...editForm,
												createdByStaff: e.target.value,
											})
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label>Người chỉnh sửa *</Label>
									<Input
										value={editForm.updatedByStaff}
										onChange={(e) =>
											setEditForm({
												...editForm,
												updatedByStaff: e.target.value,
											})
										}
										required
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Khách hàng</Label>
									<Select
										value={editForm.customerId || "all-customers"}
										onValueChange={updateEditFormCustomer}
									>
										<SelectTrigger>
											<SelectValue placeholder="Tất cả khách hàng">
												{editForm.customerId
													? getCustomerDisplayName(editForm.customerId)
													: "Tất cả khách hàng"}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all-customers">
												Tất cả khách hàng
											</SelectItem>
											{customers?.map((customer) => (
												<SelectItem key={customer._id} value={customer._id}>
													{customer.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Sản phẩm/Thuốc</Label>
									<Select
										value={editForm.productId || "all-products"}
										onValueChange={updateEditFormProduct}
									>
										<SelectTrigger>
											<SelectValue placeholder="Tất cả sản phẩm">
												{editForm.productId
													? getProductDisplayName(editForm.productId)
													: "Tất cả sản phẩm"}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all-products">
												Tất cả sản phẩm
											</SelectItem>
											{products?.map((product) => (
												<SelectItem key={product._id} value={product._id}>
													{product.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label>Người nhận *</Label>
									<Select
										value={editForm.salesmanId}
										onValueChange={updateEditFormSalesman}
									>
										<SelectTrigger>
											<SelectValue placeholder="Chọn người nhận">
												{getSalesmanDisplayName(editForm.salesmanId)}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{salesmen?.map((salesman) => (
												<SelectItem key={salesman._id} value={salesman._id}>
													{salesman.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Tỷ lệ *</Label>
									<Input
										type="number"
										min="0"
										max="100"
										step="0.01"
										value={editForm.discountPercent}
										onChange={(e) =>
											setEditForm({
												...editForm,
												discountPercent: e.target.value,
											})
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label>Đơn giá</Label>
									<Input
										value={editForm.unitPrice}
										onChange={(e) =>
											setEditForm({
												...editForm,
												unitPrice: e.target.value.replace(/[^\d.,\s]/g, ""),
											})
										}
										onBlur={handleEditUnitPriceBlur}
										inputMode="decimal"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label>Ghi chú</Label>
								<Textarea
									value={editForm.notes}
									onChange={(e) =>
										setEditForm({ ...editForm, notes: e.target.value })
									}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={closeEditDialog}>
								Huỷ
							</Button>
							<Button type="submit">Lưu thay đổi</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<CardTitle>Danh sách chiết khấu</CardTitle>
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative w-64">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Tìm theo tên sản phẩm/thuốc"
									className="pl-8"
								/>
							</div>
							<Button variant="outline" onClick={handleExportXlsx}>
								<Download className="mr-2 h-4 w-4" />
								Xuất XLSX
							</Button>
							<Button variant="outline" onClick={handlePickImportFile}>
								<Upload className="mr-2 h-4 w-4" />
								Nhập XLSX
							</Button>
							<Button variant="outline" onClick={handleDownloadTemplate}>
								<FileSpreadsheet className="mr-2 h-4 w-4" />
								Tải mẫu XLSX
							</Button>
							<AlertDialog
								open={bulkDeleteDialogOpen}
								onOpenChange={setBulkDeleteDialogOpen}
							>
								<AlertDialogTrigger
									render={
										<Button
											variant="destructive"
											disabled={selectedRuleGroups.length === 0}
										/>
									}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Xóa đã chọn ({selectedRuleGroups.length})
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Xác nhận xóa hàng loạt</AlertDialogTitle>
										<AlertDialogDescription>
											Bạn có chắc muốn xóa{" "}
											<strong>{selectedRuleGroups.length}</strong> nhom chiet
											khau da chon?
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Huỷ</AlertDialogCancel>
										<AlertDialogAction
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											onClick={handleRemoveSelectedDiscounts}
										>
											Xóa đã chọn
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
							<input
								type="file"
								ref={importInputRef}
								onChange={handleImportXlsx}
								accept=".xlsx,.xls"
								className="hidden"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{rules === undefined ? (
						<div className="text-muted-foreground">Dang tai...</div>
					) : rules.length === 0 ? (
						<div className="text-muted-foreground">
							Chua co quy tac chiet khau nao
						</div>
					) : !filteredRuleGroups || filteredRuleGroups.length === 0 ? (
						<div className="text-muted-foreground">
							Khong tim thay quy tac theo ten san pham/thuoc
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead rowSpan={2} className="w-12 text-center">
											<input
												type="checkbox"
												checked={allVisibleSelected}
												onChange={(e) =>
													toggleSelectAllVisible(e.target.checked)
												}
												disabled={visibleRuleIds.length === 0}
											/>
										</TableHead>
										<TableHead rowSpan={2}>Ngay hach toan</TableHead>
										<TableHead rowSpan={2} className="text-right">
											Don gia
										</TableHead>
										{discountGroups.map((group) => (
											<TableHead
												key={group.key}
												colSpan={2}
												className="text-center"
											>
												{group.label}
											</TableHead>
										))}
										<TableHead rowSpan={2} className="text-right">
											Tong chiet khau
										</TableHead>
										<TableHead rowSpan={2} className="text-right">
											Trang thai
										</TableHead>
									</TableRow>
									<TableRow>
										{discountGroups.map((group) => (
											<Fragment key={`${group.key}-sub`}>
												<TableHead className="text-right">Ty le</TableHead>
												<TableHead className="text-center">
													Nguoi nhan
												</TableHead>
											</Fragment>
										))}
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredRuleGroups.map((ruleGroup) => {
										const ruleUnitPrice =
											typeof ruleGroup.unitPrice === "number"
												? ruleGroup.unitPrice
												: ruleGroup.product?.salePrice;
										const isExpanded = expandedRuleIds.includes(ruleGroup.id);
										const isSelected = selectedRuleIds.includes(ruleGroup.id);
										const groupStatus = getRuleGroupStatus(
											ruleGroup.groupRules,
										);
										const detailRules = discountGroups.flatMap((group) => {
											const detailRule = ruleGroup.rulesByGroup[group.key];
											return detailRule ? [detailRule] : [];
										});

										return (
											<Fragment key={ruleGroup.id}>
												<TableRow>
													<TableCell className="text-center">
														<input
															type="checkbox"
															checked={isSelected}
															onChange={(e) =>
																toggleRuleSelection(
																	ruleGroup.id,
																	e.target.checked,
																)
															}
														/>
													</TableCell>
													<TableCell>
														<div className="font-medium">
															{formatDate(ruleGroup.createdAt)}
														</div>
														<div className="text-muted-foreground text-xs">
															{ruleGroup.name}
														</div>
														<div className="text-muted-foreground text-xs">
															{ruleGroup.product?.name
																? `San pham/Thuoc: ${ruleGroup.product.name}`
																: "San pham/Thuoc: Tat ca san pham/thuoc"}
														</div>
													</TableCell>
													<TableCell className="text-right">
														{typeof ruleUnitPrice === "number"
															? `${formatDecimalNumber(ruleUnitPrice)} VND`
															: "-"}
													</TableCell>
													{discountGroups.map((group) => {
														const groupRule = ruleGroup.rulesByGroup[group.key];
														return (
															<Fragment key={`${ruleGroup.id}-${group.key}`}>
																<TableCell className="text-right">
																	{groupRule
																		? formatPercentValue(
																				groupRule.discountPercent,
																			)
																		: "0%"}
																</TableCell>
																<TableCell className="text-center">
																	{groupRule?.salesman?.name ?? "-"}
																</TableCell>
															</Fragment>
														);
													})}
													<TableCell className="text-right">
														{formatPercentValue(ruleGroup.totalDiscountPercent)}
													</TableCell>
													<TableCell className="text-right">
														<div className="space-y-2">
															<div className={groupStatus.className}>
																{groupStatus.label}
															</div>
															<div className="flex flex-wrap justify-end gap-2">
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() =>
																		toggleRuleDetails(ruleGroup.id)
																	}
																>
																	{isExpanded ? (
																		<ChevronUp className="mr-1 h-3.5 w-3.5" />
																	) : (
																		<ChevronDown className="mr-1 h-3.5 w-3.5" />
																	)}
																	Chi tiet
																</Button>
																{ruleGroup.groupRules.length === 1 ? (
																	<AlertDialog>
																		<AlertDialogTrigger
																			render={
																				<Button size="sm" variant="outline" />
																			}
																		>
																			<Pencil className="mr-1 h-3.5 w-3.5" />
																			Sua
																		</AlertDialogTrigger>
																		<AlertDialogContent>
																			<AlertDialogHeader>
																				<AlertDialogTitle>
																					Tiep tuc chinh sua chiet khau?
																				</AlertDialogTitle>
																				<AlertDialogDescription>
																					Ban sap chinh sua quy tac{" "}
																					<strong>
																						"{ruleGroup.groupRules[0].name}"
																					</strong>
																					.
																				</AlertDialogDescription>
																			</AlertDialogHeader>
																			<AlertDialogFooter>
																				<AlertDialogCancel>
																					Huy
																				</AlertDialogCancel>
																				<AlertDialogAction
																					onClick={() =>
																						startEditingRule(
																							ruleGroup.groupRules[0],
																						)
																					}
																				>
																					Tiep tuc chinh sua
																				</AlertDialogAction>
																			</AlertDialogFooter>
																		</AlertDialogContent>
																	</AlertDialog>
																) : null}
																{groupStatus.nextIsActive ? (
																	<Button
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			toggleRuleGroupActive(ruleGroup)
																		}
																	>
																		{groupStatus.nextActionLabel}
																	</Button>
																) : (
																	<AlertDialog>
																		<AlertDialogTrigger
																			render={
																				<Button size="sm" variant="secondary" />
																			}
																		>
																			{groupStatus.label}
																		</AlertDialogTrigger>
																		<AlertDialogContent>
																			<AlertDialogHeader>
																				<AlertDialogTitle>
																					Xac nhan tam dung
																				</AlertDialogTitle>
																				<AlertDialogDescription>
																					Ban co chac muon tam dung toan bo nhom{" "}
																					<strong>"{ruleGroup.name}"</strong>?
																				</AlertDialogDescription>
																			</AlertDialogHeader>
																			<AlertDialogFooter>
																				<AlertDialogCancel>
																					Huy
																				</AlertDialogCancel>
																				<AlertDialogAction
																					className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																					onClick={() =>
																						toggleRuleGroupActive(ruleGroup)
																					}
																				>
																					{groupStatus.nextActionLabel}
																				</AlertDialogAction>
																			</AlertDialogFooter>
																		</AlertDialogContent>
																	</AlertDialog>
																)}
																<AlertDialog>
																	<AlertDialogTrigger
																		render={
																			<Button size="sm" variant="destructive" />
																		}
																	>
																		<Trash2 className="mr-1 h-3.5 w-3.5" />
																		Xoa
																	</AlertDialogTrigger>
																	<AlertDialogContent>
																		<AlertDialogHeader>
																			<AlertDialogTitle>
																				Xac nhan xoa chiet khau
																			</AlertDialogTitle>
																			<AlertDialogDescription>
																				Ban co chac muon <strong>xoa</strong>{" "}
																				nhom chiet khau{" "}
																				<strong>"{ruleGroup.name}"</strong>?
																			</AlertDialogDescription>
																		</AlertDialogHeader>
																		<AlertDialogFooter>
																			<AlertDialogCancel>Huy</AlertDialogCancel>
																			<AlertDialogAction
																				className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																				onClick={() =>
																					handleRemoveDiscountGroup(ruleGroup)
																				}
																			>
																				Xoa nhom chiet khau
																			</AlertDialogAction>
																		</AlertDialogFooter>
																	</AlertDialogContent>
																</AlertDialog>
															</div>
														</div>
													</TableCell>
												</TableRow>
												{isExpanded ? (
													<TableRow className="bg-muted/20">
														<TableCell colSpan={discountTableColumnCount}>
															<div className="space-y-4 py-2">
																<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
																	<div>
																		<div className="text-muted-foreground text-xs">
																			Khach hang
																		</div>
																		<div className="font-medium text-sm">
																			{ruleGroup.customer?.name ??
																				"Tat ca khach hang"}
																		</div>
																	</div>
																	<div>
																		<div className="text-muted-foreground text-xs">
																			San pham/Thuoc
																		</div>
																		<div className="font-medium text-sm">
																			{ruleGroup.product?.name ??
																				"Tat ca san pham/thuoc"}
																		</div>
																	</div>
																	<div>
																		<div className="text-muted-foreground text-xs">
																			Nguoi tao
																		</div>
																		<div className="font-medium text-sm">
																			{ruleGroup.createdByStaff}
																		</div>
																	</div>
																	<div>
																		<div className="text-muted-foreground text-xs">
																			Cap nhat gan nhat
																		</div>
																		<div className="font-medium text-sm">
																			{formatDateTime(ruleGroup.updatedAt)}
																		</div>
																	</div>
																</div>
																<div>
																	<div className="text-muted-foreground text-xs">
																		Ghi chu
																	</div>
																	<div className="text-sm">
																		{ruleGroup.notes?.trim()
																			? ruleGroup.notes
																			: "Khong co ghi chu"}
																	</div>
																</div>
																<div className="grid gap-3 lg:grid-cols-2">
																	{detailRules.map((rule) => {
																		const historyEntries = [
																			...rule.editHistory,
																		].sort((a, b) => b.editedAt - a.editedAt);
																		const detailStatus = rule.isActive
																			? "Hoat dong"
																			: "Tam dung";

																		return (
																			<div
																				key={rule._id}
																				className="rounded-md border bg-background p-4"
																			>
																				<div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
																					<div>
																						<div className="font-medium text-sm">
																							{
																								discountTypeLabels[
																									rule.discountType
																								]
																							}
																						</div>
																						<div className="text-muted-foreground text-xs">
																							{detailStatus}
																						</div>
																					</div>
																					<div className="flex flex-wrap gap-2">
																						<Button
																							size="sm"
																							variant="outline"
																							onClick={() =>
																								startEditingRule(rule)
																							}
																						>
																							<Pencil className="mr-1 h-3.5 w-3.5" />
																							Sua
																						</Button>
																						<Button
																							size="sm"
																							variant="outline"
																							onClick={() =>
																								toggleRuleActive(
																									rule._id,
																									rule.isActive,
																								)
																							}
																						>
																							{rule.isActive
																								? "Tam dung"
																								: "Kich hoat"}
																						</Button>
																						<Button
																							size="sm"
																							variant="destructive"
																							onClick={() =>
																								handleRemoveDiscount(rule._id)
																							}
																						>
																							<Trash2 className="mr-1 h-3.5 w-3.5" />
																							Xoa
																						</Button>
																					</div>
																				</div>
																				<div className="mt-3 grid gap-3 md:grid-cols-2">
																					<div>
																						<div className="text-muted-foreground text-xs">
																							Ty le
																						</div>
																						<div className="font-medium text-sm">
																							{formatPercentValue(
																								rule.discountPercent,
																							)}
																						</div>
																					</div>
																					<div>
																						<div className="text-muted-foreground text-xs">
																							Nguoi nhan
																						</div>
																						<div className="font-medium text-sm">
																							{rule.salesman?.name ?? "-"}
																						</div>
																					</div>
																					<div>
																						<div className="text-muted-foreground text-xs">
																							Don gia
																						</div>
																						<div className="font-medium text-sm">
																							{typeof rule.unitPrice ===
																							"number"
																								? `${formatDecimalNumber(rule.unitPrice)} VND`
																								: "-"}
																						</div>
																					</div>
																					<div>
																						<div className="text-muted-foreground text-xs">
																							Cap nhat gan nhat
																						</div>
																						<div className="font-medium text-sm">
																							{formatDateTime(rule.updatedAt)}
																						</div>
																					</div>
																				</div>
																				<div className="mt-4 space-y-3">
																					<div className="font-medium text-sm">
																						Lich su chinh sua
																					</div>
																					{historyEntries.length === 0 ? (
																						<div className="text-muted-foreground text-sm">
																							Chua co lich su chinh sua.
																						</div>
																					) : (
																						<div className="space-y-3">
																							{historyEntries.map(
																								(entry, index) => (
																									<div
																										key={`${rule._id}-${entry.editedAt}-${index}`}
																										className="rounded-md border bg-muted/30 p-3"
																									>
																										<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
																											<div className="font-medium text-sm">
																												{entry.editedBy}
																											</div>
																											<div className="text-muted-foreground text-xs">
																												{formatDateTime(
																													entry.editedAt,
																												)}
																											</div>
																										</div>
																										<div className="mt-3 space-y-2">
																											{entry.changes.map(
																												(
																													change,
																													changeIndex,
																												) => (
																													<div
																														key={`${entry.editedAt}-${change.field}-${changeIndex}`}
																														className="rounded-sm bg-background px-3 py-2 text-sm"
																													>
																														<div className="font-medium">
																															{historyFieldLabels[
																																change.field
																															] ?? change.field}
																														</div>
																														<div className="text-muted-foreground text-xs">
																															{historyValue(
																																change.from,
																															)}{" "}
																															{" -> "}{" "}
																															{historyValue(
																																change.to,
																															)}
																														</div>
																													</div>
																												),
																											)}
																										</div>
																									</div>
																								),
																							)}
																						</div>
																					)}
																				</div>
																			</div>
																		);
																	})}
																</div>
															</div>
														</TableCell>
													</TableRow>
												) : null}
											</Fragment>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
