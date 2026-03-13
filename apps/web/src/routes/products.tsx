import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type {
	Doc,
	Id,
} from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	Eye,
	EyeOff,
	FolderPlus,
	Package,
	Pencil,
	Plus,
	Ruler,
	Search,
	Trash2,
} from "lucide-react";
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

export const Route = createFileRoute("/products")({
	component: ProductsPage,
});

// Default units - can be extended with custom units
const DEFAULT_UNITS = [
	{ value: "tablet", label: "Viên" },
	{ value: "bottle", label: "Chai" },
	{ value: "box", label: "Hộp" },
	{ value: "vial", label: "Lọ" },
	{ value: "ampoule", label: "Ống" },
	{ value: "tube", label: "Tuýp" },
	{ value: "sachet", label: "Gói" },
	{ value: "piece", label: "Cái" },
	{ value: "capsule", label: "Nang" },
	{ value: "syringe", label: "Kim tiêm" },
	{ value: "patch", label: "Miếng dán" },
	{ value: "cream", label: "Kem" },
	{ value: "ointment", label: "Thuốc mỡ" },
	{ value: "drops", label: "Nhỏ mắt" },
	{ value: "inhaler", label: "Bình xịt" },
	{ value: "suppository", label: "Đạn" },
];

const PRODUCT_TYPE_OPTIONS = [
	{ value: "thuoc", label: "Thuốc" },
	{ value: "vtyt", label: "VTYT" },
	{ value: "tpcn", label: "TPCN" },
	{ value: "khac", label: "Khác" },
] as const;

const PRESCRIPTION_TYPE_OPTIONS = [
	{ value: "prescription", label: "Thuốc kê đơn" },
	{ value: "non_prescription", label: "Thuốc không kê đơn" },
	{ value: "other", label: "Khác" },
] as const;

interface ProductForm {
	name: string;
	sku: string;
	categoryId: Id<"categories"> | "";
	productType: (typeof PRODUCT_TYPE_OPTIONS)[number]["value"] | "";
	activeIngredient: string;
	strength: string;
	administrationRoute: string;
	dosageForm: string;
	packagingSpecification: string;
	drugGroup: string;
	shelfLife: string;
	registrationNumber: string;
	registrationExpiryDate: string;
	manufacturer: string;
	countryOfOrigin: string;
	description: string;
	unit: string;
	declarationDate: string;
	declarationUnit: string;
	declarationDecisionNumber: string;
	declarationValidity: string;
	biddingUnit: string;
	indication: string;
	prescriptionType: (typeof PRESCRIPTION_TYPE_OPTIONS)[number]["value"] | "";
	vatRate: string;
	isActive: "active" | "inactive";
	purchasePrice: string;
	salePrice: string;
	minStock: string;
}

const initialForm: ProductForm = {
	name: "",
	sku: "",
	categoryId: "",
	productType: "thuoc",
	activeIngredient: "",
	strength: "",
	administrationRoute: "",
	dosageForm: "",
	packagingSpecification: "",
	drugGroup: "",
	shelfLife: "",
	registrationNumber: "",
	registrationExpiryDate: "",
	manufacturer: "",
	countryOfOrigin: "",
	description: "",
	unit: "tablet",
	declarationDate: "",
	declarationUnit: "",
	declarationDecisionNumber: "",
	declarationValidity: "",
	biddingUnit: "",
	indication: "",
	prescriptionType: "prescription",
	vatRate: "",
	isActive: "active",
	purchasePrice: "",
	salePrice: "",
	minStock: "0",
};

const parseOptionalNumber = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number.parseFloat(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalDate = (value: string) => {
	return value ? Date.parse(`${value}T00:00:00.000Z`) : undefined;
};

const toDateInputValue = (timestamp?: number) => {
	if (!timestamp) return "";
	return new Date(timestamp).toISOString().slice(0, 10);
};

const formatDateTime = (timestamp?: number) => {
	if (!timestamp) return "Tự động cập nhật";
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(timestamp);
};

const getErrorMessage = (error: unknown, fallback: string) => {
	return error instanceof Error ? error.message : fallback;
};

const parseRequiredNumber = (value: string, label: string) => {
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Vui lòng nhập ${label.toLowerCase()} hợp lệ`);
	}
	return parsed;
};

const parseMinStock = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return 0;
	const parsed = Number.parseInt(trimmed, 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		throw new Error("Vui lòng nhập mức tồn kho tối thiểu hợp lệ");
	}
	return parsed;
};

type ProductRow = Doc<"products"> & {
	totalStock: number;
	isLowStock: boolean;
};

function ProductsPage() {
	const [search, setSearch] = useState("");
	const [activeFilter, setActiveFilter] = useState<
		"all" | "active" | "inactive"
	>("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<Id<"products"> | null>(null);
	const [form, setForm] = useState<ProductForm>(initialForm);
	const [formMeta, setFormMeta] = useState<{
		createdAt?: number;
		updatedAt?: number;
	}>({});
	const [deletingId, setDeletingId] = useState<Id<"products"> | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [toggleConfirmProduct, setToggleConfirmProduct] =
		useState<ProductRow | null>(null);

	// Quick add dialogs
	const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
	const [quickCategoryName, setQuickCategoryName] = useState("");
	const [quickUnitOpen, setQuickUnitOpen] = useState(false);
	const [newUnitName, setNewUnitName] = useState("");

	const products = useQuery(api.products.listWithStock, { activeOnly: false });
	const categories = useQuery(api.categories.list);
	const customUnits = useQuery(api.units.list);

	const createProduct = useMutation(api.products.create);
	const updateProduct = useMutation(api.products.update);
	const deleteProduct = useMutation(api.products.remove);
	const createCategory = useMutation(api.categories.create);
	const createUnit = useMutation(api.units.create);

	// Combine default units with custom units from database
	const allUnits = [
		...DEFAULT_UNITS,
		...(customUnits?.map((u) => ({ value: u.value, label: u.name })) || []),
	];

	const filteredProducts = products?.filter((p) => {
		const matchesSearch =
			p.name.toLowerCase().includes(search.toLowerCase()) ||
			p.sku.toLowerCase().includes(search.toLowerCase());
		const matchesActive =
			activeFilter === "all" ||
			(activeFilter === "active" && p.isActive) ||
			(activeFilter === "inactive" && !p.isActive);
		return matchesSearch && matchesActive;
	});

	const updateFormField = <K extends keyof ProductForm>(
		field: K,
		value: ProductForm[K],
	) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const resetProductDialog = () => {
		setForm(initialForm);
		setEditingId(null);
		setFormMeta({});
	};

	const handleDialogOpenChange = (open: boolean) => {
		setDialogOpen(open);
		if (!open) {
			resetProductDialog();
		}
	};

	const handleQuickAddCategory = async () => {
		if (!quickCategoryName.trim()) {
			toast.error("Vui lòng nhập tên danh mục");
			return;
		}
		try {
			const categoryId = await createCategory({
				name: quickCategoryName.trim(),
			});
			toast.success("Đã tạo danh mục thành công");
			setQuickCategoryOpen(false);
			setQuickCategoryName("");
			updateFormField("categoryId", categoryId as Id<"categories">);
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể tạo danh mục"));
		}
	};

	const handleQuickAddUnit = async () => {
		if (!newUnitName.trim()) {
			toast.error("Vui lòng nhập tên đơn vị");
			return;
		}
		const unitLower = newUnitName.trim().toLowerCase();
		if (allUnits.some((u) => u.value === unitLower)) {
			toast.error("Đơn vị này đã tồn tại");
			return;
		}
		try {
			await createUnit({ name: newUnitName.trim() });
			toast.success("Đã thêm đơn vị thành công");
			updateFormField("unit", unitLower);
			setQuickUnitOpen(false);
			setNewUnitName("");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể thêm đơn vị"));
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const purchasePrice = parseRequiredNumber(form.purchasePrice, "giá nhập");
			const salePrice = parseRequiredNumber(form.salePrice, "giá bán");
			const minStock = parseMinStock(form.minStock);
			if (editingId) {
				await updateProduct({
					id: editingId,
					name: form.name,
					sku: form.sku,
					categoryId: form.categoryId || undefined,
					productType: form.productType || undefined,
					activeIngredient: form.activeIngredient || undefined,
					strength: form.strength || undefined,
					administrationRoute: form.administrationRoute || undefined,
					dosageForm: form.dosageForm || undefined,
					packagingSpecification: form.packagingSpecification || undefined,
					drugGroup: form.drugGroup || undefined,
					shelfLife: form.shelfLife || undefined,
					registrationNumber: form.registrationNumber || undefined,
					registrationExpiryDate: parseOptionalDate(
						form.registrationExpiryDate,
					),
					manufacturer: form.manufacturer || undefined,
					countryOfOrigin: form.countryOfOrigin || undefined,
					description: form.description || undefined,
					unit: form.unit,
					declarationDate: parseOptionalDate(form.declarationDate),
					declarationUnit: form.declarationUnit || undefined,
					declarationDecisionNumber:
						form.declarationDecisionNumber || undefined,
					declarationValidity: form.declarationValidity || undefined,
					biddingUnit: form.biddingUnit || undefined,
					indication: form.indication || undefined,
					prescriptionType: form.prescriptionType || undefined,
					vatRate: parseOptionalNumber(form.vatRate),
					isActive: form.isActive === "active",
					purchasePrice,
					salePrice,
					minStock,
				});
				toast.success("Đã cập nhật sản phẩm thành công");
			} else {
				await createProduct({
					name: form.name,
					sku: form.sku,
					categoryId: form.categoryId || undefined,
					productType: form.productType || undefined,
					activeIngredient: form.activeIngredient || undefined,
					strength: form.strength || undefined,
					administrationRoute: form.administrationRoute || undefined,
					dosageForm: form.dosageForm || undefined,
					packagingSpecification: form.packagingSpecification || undefined,
					drugGroup: form.drugGroup || undefined,
					shelfLife: form.shelfLife || undefined,
					registrationNumber: form.registrationNumber || undefined,
					registrationExpiryDate: parseOptionalDate(
						form.registrationExpiryDate,
					),
					manufacturer: form.manufacturer || undefined,
					countryOfOrigin: form.countryOfOrigin || undefined,
					description: form.description || undefined,
					unit: form.unit,
					declarationDate: parseOptionalDate(form.declarationDate),
					declarationUnit: form.declarationUnit || undefined,
					declarationDecisionNumber:
						form.declarationDecisionNumber || undefined,
					declarationValidity: form.declarationValidity || undefined,
					biddingUnit: form.biddingUnit || undefined,
					indication: form.indication || undefined,
					prescriptionType: form.prescriptionType || undefined,
					vatRate: parseOptionalNumber(form.vatRate),
					isActive: form.isActive === "active",
					purchasePrice,
					salePrice,
					minStock,
				});
				toast.success("Đã tạo sản phẩm thành công");
			}
			setDialogOpen(false);
			resetProductDialog();
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể lưu sản phẩm"));
		}
	};

	const handleEdit = (product: ProductRow) => {
		setEditingId(product._id);
		setForm({
			name: product.name,
			sku: product.sku,
			categoryId: product.categoryId || "",
			productType: product.productType || "",
			activeIngredient: product.activeIngredient || "",
			strength: product.strength || "",
			administrationRoute: product.administrationRoute || "",
			dosageForm: product.dosageForm || "",
			packagingSpecification: product.packagingSpecification || "",
			drugGroup: product.drugGroup || "",
			shelfLife: product.shelfLife || "",
			registrationNumber: product.registrationNumber || "",
			registrationExpiryDate: toDateInputValue(product.registrationExpiryDate),
			manufacturer: product.manufacturer || "",
			countryOfOrigin: product.countryOfOrigin || "",
			description: product.description || "",
			unit: product.unit,
			declarationDate: toDateInputValue(product.declarationDate),
			declarationUnit: product.declarationUnit || "",
			declarationDecisionNumber: product.declarationDecisionNumber || "",
			declarationValidity: product.declarationValidity || "",
			biddingUnit: product.biddingUnit || "",
			indication: product.indication || "",
			prescriptionType: product.prescriptionType || "",
			vatRate:
				typeof product.vatRate === "number" ? product.vatRate.toString() : "",
			isActive: product.isActive ? "active" : "inactive",
			purchasePrice: product.purchasePrice.toString(),
			salePrice: product.salePrice.toString(),
			minStock: product.minStock.toString(),
		});
		setFormMeta({
			createdAt: product.createdAt,
			updatedAt: product.updatedAt,
		});
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		try {
			await deleteProduct({ id: deletingId });
			toast.success("Đã xóa sản phẩm thành công");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể xóa sản phẩm"));
		}
	};

	const handleToggleActive = (product: ProductRow) => {
		setToggleConfirmProduct(product);
	};

	const handleConfirmToggle = async () => {
		if (!toggleConfirmProduct) return;
		try {
			await updateProduct({
				id: toggleConfirmProduct._id,
				isActive: !toggleConfirmProduct.isActive,
			});
			toast.success(
				toggleConfirmProduct.isActive
					? `Đã ngừng theo dõi "${toggleConfirmProduct.name}"`
					: `Đã theo dõi lại "${toggleConfirmProduct.name}"`,
			);
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể cập nhật trạng thái"));
		} finally {
			setToggleConfirmProduct(null);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
		}).format(amount);
	};

	const getCategoryName = (categoryId: string | undefined) => {
		if (!categoryId || !categories) return "-";
		const category = categories.find((c) => c._id === categoryId);
		return category?.name || "-";
	};

	const getUnitLabel = (unitValue: string) => {
		const unit = allUnits.find((u) => u.value === unitValue);
		return unit?.label || unitValue;
	};

	const getPrescriptionTypeLabel = (value: ProductForm["prescriptionType"]) => {
		if (!value) return "";
		const option = PRESCRIPTION_TYPE_OPTIONS.find(
			(item) => item.value === value,
		);
		return option?.label || value;
	};

	const getSellingStatusLabel = (value: ProductForm["isActive"]) => {
		return value === "active" ? "Đang bán" : "Ngừng bán";
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Sản phẩm</h2>
					<p className="text-muted-foreground">Quản lý danh mục sản phẩm</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								resetProductDialog();
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Thêm sản phẩm
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[960px]">
						<form onSubmit={handleSubmit}>
							<DialogHeader>
								<DialogTitle>
									{editingId ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
								</DialogTitle>
								<DialogDescription>
									Khai báo đầy đủ thông tin sản phẩm theo nhóm hồ sơ dược và
									thông tin quản lý nội bộ.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-6 py-4">
								<div className="grid gap-4 md:grid-cols-3">
									<div className="space-y-2">
										<Label htmlFor="supplyScope">
											Hàng hóa/Dịch vụ cung cấp
										</Label>
										<Input id="supplyScope" value="Hàng hóa" disabled />
									</div>
									<div className="space-y-2">
										<Label htmlFor="productType">Phân loại</Label>
										<Select
											value={form.productType}
											onValueChange={(value) =>
												updateFormField(
													"productType",
													value as ProductForm["productType"],
												)
											}
										>
											<SelectTrigger id="productType">
												<SelectValue placeholder="Chọn phân loại" />
											</SelectTrigger>
											<SelectContent>
												{PRODUCT_TYPE_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sku">Mã SKU *</Label>
										<Input
											id="sku"
											value={form.sku}
											onChange={(e) => updateFormField("sku", e.target.value)}
											required
										/>
									</div>
								</div>

								<div className="rounded-lg border bg-muted/20 p-4">
									<div className="mb-4">
										<h3 className="font-semibold text-base">
											Thông tin cơ bản
										</h3>
										<p className="text-muted-foreground text-sm">
											Thông tin hồ sơ sản phẩm và đặc tính chuyên môn.
										</p>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="name">Tên thuốc *</Label>
											<Input
												id="name"
												value={form.name}
												onChange={(e) =>
													updateFormField("name", e.target.value)
												}
												required
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="activeIngredient">Tên hoạt chất</Label>
											<Input
												id="activeIngredient"
												value={form.activeIngredient}
												onChange={(e) =>
													updateFormField("activeIngredient", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="strength">Nồng độ/Hàm lượng</Label>
											<Input
												id="strength"
												value={form.strength}
												onChange={(e) =>
													updateFormField("strength", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="administrationRoute">Đường dùng</Label>
											<Input
												id="administrationRoute"
												value={form.administrationRoute}
												onChange={(e) =>
													updateFormField("administrationRoute", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="dosageForm">Dạng bào chế</Label>
											<Input
												id="dosageForm"
												value={form.dosageForm}
												onChange={(e) =>
													updateFormField("dosageForm", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="packagingSpecification">
												Quy cách đóng gói
											</Label>
											<Input
												id="packagingSpecification"
												value={form.packagingSpecification}
												onChange={(e) =>
													updateFormField(
														"packagingSpecification",
														e.target.value,
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="drugGroup">Nhóm thuốc</Label>
											<Input
												id="drugGroup"
												value={form.drugGroup}
												onChange={(e) =>
													updateFormField("drugGroup", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="shelfLife">Tuổi thọ</Label>
											<Input
												id="shelfLife"
												value={form.shelfLife}
												onChange={(e) =>
													updateFormField("shelfLife", e.target.value)
												}
												placeholder="Ví dụ: 24 tháng"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="registrationNumber">SDK/GPNK</Label>
											<Input
												id="registrationNumber"
												value={form.registrationNumber}
												onChange={(e) =>
													updateFormField("registrationNumber", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="registrationExpiryDate">
												Ngày hết hạn SDK/GPNK
											</Label>
											<Input
												id="registrationExpiryDate"
												type="date"
												value={form.registrationExpiryDate}
												onChange={(e) =>
													updateFormField(
														"registrationExpiryDate",
														e.target.value,
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="manufacturer">Cơ sở sản xuất</Label>
											<Input
												id="manufacturer"
												value={form.manufacturer}
												onChange={(e) =>
													updateFormField("manufacturer", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="countryOfOrigin">Nước sản xuất</Label>
											<Input
												id="countryOfOrigin"
												value={form.countryOfOrigin}
												onChange={(e) =>
													updateFormField("countryOfOrigin", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<div className="flex items-center justify-between">
												<Label htmlFor="category">Danh mục nội bộ</Label>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-6 px-2 text-teal-600 text-xs hover:text-teal-700"
													onClick={() => setQuickCategoryOpen(true)}
												>
													<FolderPlus className="mr-1 h-3 w-3" />
													Thêm danh mục
												</Button>
											</div>
											<Select
												value={form.categoryId || ""}
												onValueChange={(value) => {
													if (value === "_clear") {
														updateFormField("categoryId", "");
													} else if (value && value !== "_none") {
														updateFormField(
															"categoryId",
															value as Id<"categories">,
														);
													}
												}}
											>
												<SelectTrigger id="category">
													<SelectValue placeholder="Chọn danh mục nội bộ">
														{form.categoryId &&
															categories?.find(
																(category) => category._id === form.categoryId,
															)?.name}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="_clear">
														Bỏ chọn danh mục
													</SelectItem>
													{categories?.map((category) => (
														<SelectItem key={category._id} value={category._id}>
															{category.name}
														</SelectItem>
													))}
													{(!categories || categories.length === 0) && (
														<SelectItem value="_none" disabled>
															Chưa có danh mục, bấm "Thêm danh mục" để tạo.
														</SelectItem>
													)}
												</SelectContent>
											</Select>
										</div>
									</div>
								</div>

								<div className="rounded-lg border bg-muted/20 p-4">
									<div className="mb-4">
										<h3 className="font-semibold text-base">
											Thông tin bổ sung
										</h3>
										<p className="text-muted-foreground text-sm">
											Thông tin kê khai, thuế, theo dõi và vận hành nội bộ.
										</p>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<Label htmlFor="unit">Đơn vị tính *</Label>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-6 px-2 text-teal-600 text-xs hover:text-teal-700"
													onClick={() => setQuickUnitOpen(true)}
												>
													<Ruler className="mr-1 h-3 w-3" />
													Thêm đơn vị
												</Button>
											</div>
											<Select
												value={form.unit}
												onValueChange={(value) =>
													value && updateFormField("unit", value)
												}
												required
											>
												<SelectTrigger id="unit">
													<SelectValue placeholder="Chọn đơn vị tính">
														{getUnitLabel(form.unit)}
													</SelectValue>
												</SelectTrigger>
												<SelectContent className="max-h-60">
													{allUnits.map((unit) => (
														<SelectItem key={unit.value} value={unit.value}>
															{unit.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label htmlFor="declarationDate">Ngày kê khai</Label>
											<Input
												id="declarationDate"
												type="date"
												value={form.declarationDate}
												onChange={(e) =>
													updateFormField("declarationDate", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="declarationUnit">
												Đơn vị công bố KQTT
											</Label>
											<Input
												id="declarationUnit"
												value={form.declarationUnit}
												onChange={(e) =>
													updateFormField("declarationUnit", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="declarationDecisionNumber">
												Số QĐ công bố
											</Label>
											<Input
												id="declarationDecisionNumber"
												value={form.declarationDecisionNumber}
												onChange={(e) =>
													updateFormField(
														"declarationDecisionNumber",
														e.target.value,
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="declarationValidity">Thời hạn</Label>
											<Input
												id="declarationValidity"
												value={form.declarationValidity}
												onChange={(e) =>
													updateFormField("declarationValidity", e.target.value)
												}
												placeholder="Ví dụ: 12 tháng"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="biddingUnit">Đơn vị trúng thầu</Label>
											<Input
												id="biddingUnit"
												value={form.biddingUnit}
												onChange={(e) =>
													updateFormField("biddingUnit", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="prescriptionType">Tính chất</Label>
											<Select
												value={form.prescriptionType}
												onValueChange={(value) =>
													updateFormField(
														"prescriptionType",
														value as ProductForm["prescriptionType"],
													)
												}
											>
												<SelectTrigger id="prescriptionType">
													<SelectValue placeholder="Chọn tính chất">
														{getPrescriptionTypeLabel(form.prescriptionType)}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													{PRESCRIPTION_TYPE_OPTIONS.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label htmlFor="vatRate">Thuế GTGT (%)</Label>
											<Input
												id="vatRate"
												type="number"
												step="0.01"
												min="0"
												value={form.vatRate}
												onChange={(e) =>
													updateFormField("vatRate", e.target.value)
												}
												placeholder="Ví dụ: 5 hoặc 10"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="trackingStatus">
												Trạng thái bán hàng
											</Label>
											<Select
												value={form.isActive}
												onValueChange={(value) =>
													updateFormField(
														"isActive",
														value as ProductForm["isActive"],
													)
												}
											>
												<SelectTrigger id="trackingStatus">
													<SelectValue placeholder="Chọn trạng thái bán hàng">
														{getSellingStatusLabel(form.isActive)}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="active">Đang bán</SelectItem>
													<SelectItem value="inactive">Ngừng bán</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label htmlFor="purchasePrice">Giá nhập *</Label>
											<Input
												id="purchasePrice"
												type="number"
												step="1"
												min="0"
												value={form.purchasePrice}
												onChange={(e) =>
													updateFormField("purchasePrice", e.target.value)
												}
												required
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="salePrice">Giá bán *</Label>
											<Input
												id="salePrice"
												type="number"
												step="1"
												min="0"
												value={form.salePrice}
												onChange={(e) =>
													updateFormField("salePrice", e.target.value)
												}
												required
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="minStock">Mức tồn kho tối thiểu</Label>
											<Input
												id="minStock"
												type="number"
												min="0"
												value={form.minStock}
												onChange={(e) =>
													updateFormField("minStock", e.target.value)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="createdAt">Ngày tạo</Label>
											<Input
												id="createdAt"
												value={formatDateTime(formMeta.createdAt)}
												disabled
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="updatedAt">Ngày cập nhật</Label>
											<Input
												id="updatedAt"
												value={formatDateTime(formMeta.updatedAt)}
												disabled
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<Label htmlFor="indication">Chỉ định</Label>
											<Textarea
												id="indication"
												value={form.indication}
												onChange={(e) =>
													updateFormField("indication", e.target.value)
												}
												rows={3}
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<Label htmlFor="description">Ghi chú</Label>
											<Textarea
												id="description"
												value={form.description}
												onChange={(e) =>
													updateFormField("description", e.target.value)
												}
												rows={3}
											/>
										</div>
									</div>
								</div>
							</div>
							<DialogFooter>
								<Button type="submit">
									{editingId ? "Lưu thay đổi" : "Tạo sản phẩm"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Danh sách sản phẩm</CardTitle>
						<div className="flex items-center gap-2">
							<div className="relative w-56">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Tìm kiếm sản phẩm..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8"
								/>
							</div>
							<Select
								value={activeFilter}
								onValueChange={(v) =>
									v && setActiveFilter(v as typeof activeFilter)
								}
							>
								<SelectTrigger className="w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Tất cả</SelectItem>
									<SelectItem value="active">Đang theo dõi</SelectItem>
									<SelectItem value="inactive">Ngừng theo dõi</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{products === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải...
						</div>
					) : filteredProducts?.length === 0 ? (
						<div className="py-8 text-center">
							<Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<p className="text-muted-foreground">Không tìm thấy sản phẩm</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Mã SKU</TableHead>
									<TableHead>Tên</TableHead>
									<TableHead>Danh mục</TableHead>
									<TableHead>Đơn vị</TableHead>
									<TableHead className="text-right">Giá nhập</TableHead>
									<TableHead className="text-right">Giá bán</TableHead>
									<TableHead className="text-center">Tồn kho</TableHead>
									<TableHead className="text-center">Trạng thái</TableHead>
									<TableHead className="text-center">Theo dõi</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredProducts?.map((product) => (
									<TableRow key={product._id}>
										<TableCell className="font-mono text-sm">
											{product.sku}
										</TableCell>
										<TableCell className="font-medium">
											{product.name}
										</TableCell>
										<TableCell>{getCategoryName(product.categoryId)}</TableCell>
										<TableCell>{getUnitLabel(product.unit)}</TableCell>
										<TableCell className="text-right">
											{formatCurrency(product.purchasePrice)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(product.salePrice)}
										</TableCell>
										<TableCell className="text-center">
											<span
												className={
													product.isLowStock ? "font-bold text-red-500" : ""
												}
											>
												{product.totalStock}
											</span>
										</TableCell>
										<TableCell className="text-center">
											{product.isLowStock ? (
												<Badge variant="destructive" className="gap-1">
													<AlertTriangle className="h-3 w-3" />
													Sắp hết hàng
												</Badge>
											) : product.isActive ? (
												<Badge variant="default">Đang bán</Badge>
											) : (
												<Badge variant="secondary">Ngừng bán</Badge>
											)}
										</TableCell>
										<TableCell className="text-center">
											<Button
												variant={product.isActive ? "outline" : "secondary"}
												size="sm"
												className="gap-1.5 text-xs"
												onClick={() => handleToggleActive(product)}
											>
												{product.isActive ? (
													<>
														<EyeOff className="h-3.5 w-3.5" />
														Ngừng theo dõi
													</>
												) : (
													<>
														<Eye className="h-3.5 w-3.5 text-teal-600" />
														Theo dõi lại
													</>
												)}
											</Button>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleEdit(product)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													setDeletingId(product._id);
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

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Xóa sản phẩm</DialogTitle>
						<DialogDescription>
							Bạn có chắc muốn xóa sản phẩm này? Hành động này không thể hoàn
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

			{/* Toggle Active Confirmation Dialog */}
			<Dialog
				open={!!toggleConfirmProduct}
				onOpenChange={(open) => !open && setToggleConfirmProduct(null)}
			>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{toggleConfirmProduct?.isActive ? (
								<EyeOff className="h-5 w-5 text-orange-500" />
							) : (
								<Eye className="h-5 w-5 text-teal-600" />
							)}
							{toggleConfirmProduct?.isActive
								? "Ngừng theo dõi sản phẩm"
								: "Theo dõi lại sản phẩm"}
						</DialogTitle>
						<DialogDescription>
							<div className="space-y-2 pt-1">
								<p>
									Bạn đang{" "}
									<strong>
										{toggleConfirmProduct?.isActive
											? "ngừng theo dõi"
											: "kích hoạt theo dõi lại"}
									</strong>{" "}
									sản phẩm:
								</p>
								<p className="rounded-md bg-muted px-3 py-2 font-medium text-foreground text-sm">
									{toggleConfirmProduct?.name}{" "}
									<span className="font-mono text-muted-foreground">
										({toggleConfirmProduct?.sku})
									</span>
								</p>
								{toggleConfirmProduct?.isActive ? (
									<p className="text-orange-600 text-sm">
										⚠️ Sản phẩm này sẽ bị ẩn khỏi danh sách bán hàng và không thể
										chọn khi tạo phiếu nhập/xuất mới. Dữ liệu lịch sử vẫn được
										giữ nguyên.
									</p>
								) : (
									<p className="text-sm text-teal-600">
										✅ Sản phẩm này sẽ được hiển thị lại và có thể sử dụng trong
										các phiếu nhập/xuất.
									</p>
								)}
							</div>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setToggleConfirmProduct(null)}
						>
							Hủy
						</Button>
						<Button
							variant={
								toggleConfirmProduct?.isActive ? "destructive" : "default"
							}
							onClick={handleConfirmToggle}
						>
							{toggleConfirmProduct?.isActive
								? "Ngừng theo dõi"
								: "Theo dõi lại"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Quick Add Category Dialog */}
			<Dialog open={quickCategoryOpen} onOpenChange={setQuickCategoryOpen}>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FolderPlus className="h-5 w-5 text-teal-600" />
							Thêm nhanh danh mục
						</DialogTitle>
						<DialogDescription>Tạo danh mục sản phẩm mới.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="categoryName">Tên danh mục *</Label>
							<Input
								id="categoryName"
								value={quickCategoryName}
								onChange={(e) => setQuickCategoryName(e.target.value)}
								placeholder="Ví dụ: Kháng sinh, Giảm đau"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										void handleQuickAddCategory();
									}
								}}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setQuickCategoryOpen(false)}
						>
							Hủy
						</Button>
						<Button onClick={handleQuickAddCategory}>Tạo danh mục</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Quick Add Unit Dialog */}
			<Dialog open={quickUnitOpen} onOpenChange={setQuickUnitOpen}>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Ruler className="h-5 w-5 text-teal-600" />
							Thêm đơn vị mới
						</DialogTitle>
						<DialogDescription>Thêm đơn vị đo tùy chỉnh.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="unitName">Tên đơn vị *</Label>
							<Input
								id="unitName"
								value={newUnitName}
								onChange={(e) => setNewUnitName(e.target.value)}
								placeholder="Ví dụ: Gói, Vỉ, Mẻ"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										void handleQuickAddUnit();
									}
								}}
							/>
						</div>
						<p className="text-muted-foreground text-xs">
							Đơn vị này sẽ có sẵn cho tất cả sản phẩm.
						</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setQuickUnitOpen(false)}>
							Hủy
						</Button>
						<Button onClick={handleQuickAddUnit}>Thêm đơn vị</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
