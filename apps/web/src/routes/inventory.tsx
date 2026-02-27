import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowDownCircle,
	ArrowUpCircle,
	CheckCircle,
	Clock,
	Eye,
	FileText,
	PackageOpen,
	Plus,
	Search,
	Trash2,
	Warehouse,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/inventory")({
	component: InventoryPage,
});

// Transfer type labels
const IMPORT_TYPES = [
	{ value: "import", label: "Nhập từ NCC" },
	{ value: "import_return", label: "Nhập trả từ KH" },
];

const EXPORT_TYPES = [
	{ value: "export", label: "Xuất bán hàng" },
	{ value: "export_return", label: "Xuất trả NCC" },
	{ value: "export_gift", label: "Xuất tặng/khuyến mại/hàng mẫu" },
	{ value: "export_destruction", label: "Xuất hủy" },
];

const STATUS_LABELS: Record<
	string,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	draft: { label: "Nháp", variant: "secondary" },
	confirmed: { label: "Đã xác nhận", variant: "default" },
	cancelled: { label: "Đã hủy", variant: "destructive" },
};

// Default units
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

// Form interfaces
interface InventoryForm {
	productId: string;
	batchNumber: string;
	quantity: string;
	expiryDate: string;
	purchasePrice: string;
	supplierId: string;
	location: string;
}

interface QuickProductForm {
	name: string;
	sku: string;
	unit: string;
	salePrice: string;
	minStock: string;
}

interface TransferItemForm {
	productId: string;
	inventoryId: string;
	batchNumber: string;
	quantity: string;
	unitPrice: string;
	expiryDate: string;
}

interface TransferForm {
	transferType: string;
	partnerId: string;
	transferDate: string;
	notes: string;
	items: TransferItemForm[];
}

const initialInventoryForm: InventoryForm = {
	productId: "",
	batchNumber: "",
	quantity: "",
	expiryDate: "",
	purchasePrice: "",
	supplierId: "",
	location: "",
};

const initialQuickProduct: QuickProductForm = {
	name: "",
	sku: "",
	unit: "tablet",
	salePrice: "",
	minStock: "0",
};

const initialTransferItem: TransferItemForm = {
	productId: "",
	inventoryId: "",
	batchNumber: "",
	quantity: "",
	unitPrice: "",
	expiryDate: "",
};

const initialTransferForm: TransferForm = {
	transferType: "",
	partnerId: "",
	transferDate: new Date().toISOString().split("T")[0],
	notes: "",
	items: [{ ...initialTransferItem }],
};

function InventoryPage() {
	// Tab state
	const [activeTab, setActiveTab] = useState("inventory");

	// Inventory tab states
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [form, setForm] = useState<InventoryForm>(initialInventoryForm);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [quickProductOpen, setQuickProductOpen] = useState(false);
	const [quickProduct, setQuickProduct] =
		useState<QuickProductForm>(initialQuickProduct);

	// Transfer voucher states
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [transferForm, setTransferForm] =
		useState<TransferForm>(initialTransferForm);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
		null,
	);
	const [transferSearch, setTransferSearch] = useState("");
	const [exportTransferSearch, setExportTransferSearch] = useState("");

	// Queries - Inventory
	const inventory = useQuery(api.inventory.listWithProducts, {});
	const products = useQuery(api.products.list, { activeOnly: true });
	const suppliers = useQuery(api.suppliers.list, { activeOnly: true });
	const customers = useQuery(api.customers.list, { activeOnly: true });
	const customUnits = useQuery(api.units.list);
	const lowStock = useQuery(api.inventory.getLowStock, {});
	const expiring = useQuery(api.inventory.getExpiring, { withinDays: 30 });

	// Options for selects (used to build consistent labels)
	const productOptions =
		products?.map((p) => ({
			value: p._id,
			label: p.sku ? `${p.sku} - ${p.name}` : p.name,
		})) ?? [];

	const customerOptions =
		customers?.map((c) => ({
			value: c._id,
			label: c.code ? `${c.code} - ${c.name}` : c.name,
		})) ?? [];

	const supplierOptions =
		suppliers?.map((s) => ({
			value: s._id,
			label: s.code ? `${s.code} - ${s.name}` : s.name,
		})) ?? [];

	const getProductLabel = (id: string) =>
		productOptions.find((p) => p.value === id)?.label ?? "";

	const getCustomerLabel = (id: string) =>
		customerOptions.find((c) => c.value === id)?.label ?? "";

	const getSupplierLabel = (id: string) =>
		supplierOptions.find((s) => s.value === id)?.label ?? "";

	// Queries - Stock Transfers
	const importTransfers = useQuery(api.stockTransfers.listWithPartners, {
		transferType: "import",
	});
	const importReturnTransfers = useQuery(api.stockTransfers.listWithPartners, {
		transferType: "import_return",
	});
	const exportTransfers = useQuery(api.stockTransfers.listWithPartners, {
		transferType: "export",
	});
	const exportReturnTransfers = useQuery(api.stockTransfers.listWithPartners, {
		transferType: "export_return",
	});
	const exportGiftTransfers = useQuery(api.stockTransfers.listWithPartners, {
		transferType: "export_gift",
	});
	const exportDestructionTransfers = useQuery(
		api.stockTransfers.listWithPartners,
		{ transferType: "export_destruction" },
	);

	const transferDetails = useQuery(
		api.stockTransfers.getWithDetails,
		selectedTransferId ? { id: selectedTransferId as any } : "skip",
	);

	// Available inventory for selected product (export)
	const [selectedProductIdForInventory, setSelectedProductIdForInventory] =
		useState<string | null>(null);
	const availableInventory = useQuery(
		api.stockTransfers.getAvailableInventory,
		selectedProductIdForInventory
			? { productId: selectedProductIdForInventory as any }
			: "skip",
	);

	// Mutations - Inventory
	const createInventory = useMutation(api.inventory.create);
	const deleteInventory = useMutation(api.inventory.remove);
	const createProduct = useMutation(api.products.create);

	// Mutations - Stock Transfers
	const createTransfer = useMutation(api.stockTransfers.create);
	const confirmTransfer = useMutation(api.stockTransfers.confirm);
	const cancelTransfer = useMutation(api.stockTransfers.cancel);
	const deleteTransfer = useMutation(api.stockTransfers.remove);

	// Combine default units with custom units from database
	const allUnits = [
		...DEFAULT_UNITS,
		...(customUnits?.map((u) => ({ value: u.value, label: u.name })) || []),
	];

	// Filter inventory
	const filteredInventory = inventory?.filter(
		(item) =>
			item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
			item.batchNumber.toLowerCase().includes(search.toLowerCase()),
	);

	// Combine import transfers
	const allImportTransfers = [
		...(importTransfers || []),
		...(importReturnTransfers || []),
	].sort((a, b) => b.createdAt - a.createdAt);

	// Combine export transfers
	const allExportTransfers = [
		...(exportTransfers || []),
		...(exportReturnTransfers || []),
		...(exportGiftTransfers || []),
		...(exportDestructionTransfers || []),
	].sort((a, b) => b.createdAt - a.createdAt);

	// Filter transfers by search
	const filteredImportTransfers = allImportTransfers.filter(
		(t) =>
			t.transferNumber.toLowerCase().includes(transferSearch.toLowerCase()) ||
			t.partner?.name?.toLowerCase().includes(transferSearch.toLowerCase()),
	);

	const filteredExportTransfers = allExportTransfers.filter(
		(t) =>
			t.transferNumber
				.toLowerCase()
				.includes(exportTransferSearch.toLowerCase()) ||
			t.partner?.name
				?.toLowerCase()
				.includes(exportTransferSearch.toLowerCase()),
	);

	// Handlers - Inventory
	const handleQuickAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const productId = await createProduct({
				name: quickProduct.name,
				sku: quickProduct.sku,
				unit: quickProduct.unit,
				purchasePrice: Number.parseFloat(form.purchasePrice) || 0,
				salePrice: Number.parseFloat(quickProduct.salePrice) || 0,
				minStock: Number.parseInt(quickProduct.minStock, 10) || 0,
			});
			toast.success("Tạo sản phẩm thành công");
			setQuickProductOpen(false);
			setQuickProduct(initialQuickProduct);
			setForm({ ...form, productId: productId as string });
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Tạo sản phẩm thất bại";
			toast.error(message);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await createInventory({
				productId: form.productId as any,
				batchNumber: form.batchNumber,
				quantity: Number.parseInt(form.quantity, 10),
				expiryDate: new Date(form.expiryDate).getTime(),
				purchasePrice: Number.parseFloat(form.purchasePrice),
				supplierId: form.supplierId ? (form.supplierId as any) : undefined,
				location: form.location || undefined,
			});
			toast.success("Thêm lô hàng thành công");
			setDialogOpen(false);
			setForm(initialInventoryForm);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Thêm kho hàng thất bại";
			toast.error(message);
		}
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		try {
			await deleteInventory({ id: deletingId as any });
			toast.success("Đã xóa bản ghi kho hàng");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Xóa kho hàng thất bại";
			toast.error(message);
		}
	};

	// Handlers - Transfer Items
	const handleAddTransferItem = () => {
		setTransferForm({
			...transferForm,
			items: [...transferForm.items, { ...initialTransferItem }],
		});
	};

	const handleRemoveTransferItem = (index: number) => {
		if (transferForm.items.length > 1) {
			setTransferForm({
				...transferForm,
				items: transferForm.items.filter((_, i) => i !== index),
			});
		}
	};

	const handleTransferItemChange = (
		index: number,
		field: keyof TransferItemForm,
		value: string,
	) => {
		const newItems = [...transferForm.items];
		newItems[index] = { ...newItems[index], [field]: value };

		if (field === "productId" && value) {
			setSelectedProductIdForInventory(value);
			newItems[index].inventoryId = "";
			newItems[index].batchNumber = "";
		}

		if (field === "inventoryId" && value) {
			const selectedInv = availableInventory?.find((inv) => inv._id === value);
			if (selectedInv) {
				newItems[index].batchNumber = selectedInv.batchNumber;
				newItems[index].expiryDate = new Date(selectedInv.expiryDate)
					.toISOString()
					.split("T")[0];
				newItems[index].unitPrice = selectedInv.purchasePrice.toString();
			}
		}

		setTransferForm({ ...transferForm, items: newItems });
	};

	useEffect(() => {
		if (!importDialogOpen && !exportDialogOpen) {
			setTransferForm(initialTransferForm);
			setSelectedProductIdForInventory(null);
		}
	}, [importDialogOpen, exportDialogOpen]);

	const handleCreateImportTransfer = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validItems = transferForm.items.filter(
				(item) =>
					item.productId &&
					item.batchNumber &&
					item.quantity &&
					item.unitPrice &&
					item.expiryDate,
			);
			if (validItems.length === 0) {
				toast.error("Vui lòng thêm ít nhất một sản phẩm");
				return;
			}

			await createTransfer({
				transferType: transferForm.transferType as any,
				partnerType:
					transferForm.transferType === "import_return"
						? "customer"
						: "supplier",
				partnerId: transferForm.partnerId
					? (transferForm.partnerId as any)
					: undefined,
				transferDate: new Date(transferForm.transferDate).getTime(),
				notes: transferForm.notes || undefined,
				items: validItems.map((item) => ({
					productId: item.productId as any,
					batchNumber: item.batchNumber,
					quantity: Number.parseInt(item.quantity, 10),
					unitPrice: Number.parseFloat(item.unitPrice),
					expiryDate: new Date(item.expiryDate).getTime(),
				})),
			});

			toast.success("Tạo phiếu nhập thành công");
			setImportDialogOpen(false);
			setTransferForm(initialTransferForm);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Tạo phiếu nhập thất bại";
			toast.error(message);
		}
	};

	const handleCreateExportTransfer = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validItems = transferForm.items.filter(
				(item) =>
					item.productId &&
					item.inventoryId &&
					item.batchNumber &&
					item.quantity &&
					item.unitPrice,
			);
			if (validItems.length === 0) {
				toast.error("Vui lòng thêm ít nhất một sản phẩm với lô hàng được chọn");
				return;
			}

			await createTransfer({
				transferType: transferForm.transferType as any,
				partnerType: ["export_return", "export_destruction"].includes(
					transferForm.transferType,
				)
					? "supplier"
					: "customer",
				partnerId: transferForm.partnerId
					? (transferForm.partnerId as any)
					: undefined,
				transferDate: new Date(transferForm.transferDate).getTime(),
				notes: transferForm.notes || undefined,
				items: validItems.map((item) => ({
					productId: item.productId as any,
					inventoryId: item.inventoryId as any,
					batchNumber: item.batchNumber,
					quantity: Number.parseInt(item.quantity, 10),
					unitPrice: Number.parseFloat(item.unitPrice),
					expiryDate: new Date(item.expiryDate).getTime(),
				})),
			});

			toast.success("Tạo phiếu xuất thành công");
			setExportDialogOpen(false);
			setTransferForm(initialTransferForm);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Tạo phiếu xuất thất bại";
			toast.error(message);
		}
	};

	const viewTransferDetails = (transferId: string) => {
		setSelectedTransferId(transferId);
		setDetailDialogOpen(true);
	};

	const handleConfirmTransfer = async () => {
		if (!selectedTransferId) return;
		try {
			await confirmTransfer({ id: selectedTransferId as any });
			toast.success("Đã xác nhận phiếu và cập nhật kho hàng");
			setDetailDialogOpen(false);
			setSelectedTransferId(null);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Xác nhận phiếu thất bại";
			toast.error(message);
		}
	};

	const handleCancelTransfer = async () => {
		if (!selectedTransferId) return;
		try {
			await cancelTransfer({ id: selectedTransferId as any });
			toast.success("Đã hủy phiếu");
			setDetailDialogOpen(false);
			setSelectedTransferId(null);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Hủy phiếu thất bại";
			toast.error(message);
		}
	};

	const handleDeleteTransfer = async () => {
		if (!selectedTransferId) return;
		try {
			await deleteTransfer({ id: selectedTransferId as any });
			toast.success("Đã xóa phiếu");
			setDetailDialogOpen(false);
			setSelectedTransferId(null);
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Xóa phiếu thất bại";
			toast.error(message);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
		}).format(amount);
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("vi-VN");
	};

	const isExpiringSoon = (expiryDate: number) => {
		const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
		return expiryDate < thirtyDays;
	};

	const isExpired = (expiryDate: number) => {
		return expiryDate < Date.now();
	};

	const getStatusBadge = (status: string) => {
		const config = STATUS_LABELS[status] || {
			label: status,
			variant: "outline" as const,
		};
		return <Badge variant={config.variant}>{config.label}</Badge>;
	};

	const getTransferTypeLabel = (type: string) => {
		const allTypes = [...IMPORT_TYPES, ...EXPORT_TYPES];
		return allTypes.find((t) => t.value === type)?.label || type;
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Kho hàng</h2>
					<p className="text-muted-foreground">
						Quản lý tồn kho và phiếu nhập/xuất
					</p>
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="bg-muted">
					<TabsTrigger value="inventory" className="data-active:bg-background">
						<Warehouse className="mr-1.5 h-4 w-4" />
						Tồn kho
					</TabsTrigger>
					<TabsTrigger value="import" className="data-active:bg-background">
						<ArrowDownCircle className="mr-1.5 h-4 w-4" />
						Phiếu nhập
					</TabsTrigger>
					<TabsTrigger value="export" className="data-active:bg-background">
						<ArrowUpCircle className="mr-1.5 h-4 w-4" />
						Phiếu xuất
					</TabsTrigger>
				</TabsList>

				{/* Tab: Tồn kho */}
				<TabsContent value="inventory" className="mt-4 space-y-6">
					<div className="flex justify-end">
						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button onClick={() => setForm(initialInventoryForm)}>
									<Plus className="mr-2 h-4 w-4" />
									Thêm lô hàng
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-[500px]">
								<form onSubmit={handleSubmit}>
									<DialogHeader>
										<DialogTitle>Thêm lô hàng</DialogTitle>
										<DialogDescription>
											Thêm lô hàng mới vào hệ thống.
										</DialogDescription>
									</DialogHeader>
									<div className="grid gap-4 py-4">
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<Label htmlFor="product">Sản phẩm *</Label>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 text-teal-600 text-xs hover:text-teal-700"
													onClick={() => setQuickProductOpen(true)}
												>
													<Plus className="mr-1 h-3 w-3" />
													Thêm nhanh SP
												</Button>
											</div>
											<Select
												value={form.productId}
												onValueChange={(value) =>
													setForm({ ...form, productId: value ?? "" })
												}
												required
											>
												<SelectTrigger>
													{form.productId ? (
														getProductLabel(form.productId)
													) : (
														<span className="text-muted-foreground">
															Chọn sản phẩm
														</span>
													)}
												</SelectTrigger>
												<SelectContent>
													{productOptions.map((p) => (
														<SelectItem key={p.value} value={p.value}>
															{p.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{products?.length === 0 && (
												<p className="text-muted-foreground text-xs">
													Chưa có sản phẩm. Sử dụng "Thêm nhanh SP" để tạo mới.
												</p>
											)}
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="batchNumber">Số lô *</Label>
												<Input
													id="batchNumber"
													value={form.batchNumber}
													onChange={(e) =>
														setForm({ ...form, batchNumber: e.target.value })
													}
													required
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="quantity">Số lượng *</Label>
												<Input
													id="quantity"
													type="number"
													min="1"
													value={form.quantity}
													onChange={(e) =>
														setForm({ ...form, quantity: e.target.value })
													}
													required
												/>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="expiryDate">Hạn sử dụng *</Label>
												<Input
													id="expiryDate"
													type="date"
													value={form.expiryDate}
													onChange={(e) =>
														setForm({ ...form, expiryDate: e.target.value })
													}
													required
												/>
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
														setForm({ ...form, purchasePrice: e.target.value })
													}
													required
												/>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="supplier">Nhà cung cấp</Label>
												<Select
													value={form.supplierId}
													onValueChange={(value) =>
														setForm({ ...form, supplierId: value ?? "" })
													}
												>
													<SelectTrigger>
														{form.supplierId ? (
															getSupplierLabel(form.supplierId)
														) : (
															<span className="text-muted-foreground">
																Chọn nhà cung cấp
															</span>
														)}
													</SelectTrigger>
													<SelectContent>
														{supplierOptions.map((s) => (
															<SelectItem key={s.value} value={s.value}>
																{s.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="location">Vị trí</Label>
												<Input
													id="location"
													value={form.location}
													onChange={(e) =>
														setForm({ ...form, location: e.target.value })
													}
													placeholder="VD: Kệ A-1"
												/>
											</div>
										</div>
									</div>
									<DialogFooter>
										<Button type="submit">Thêm lô hàng</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<Card className="border-destructive/50">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base text-destructive">
									<AlertTriangle className="h-4 w-4" />
									Cảnh báo tồn thấp ({lowStock?.length || 0})
								</CardTitle>
							</CardHeader>
							<CardContent>
								{lowStock && lowStock.length > 0 ? (
									<div className="space-y-2 text-sm">
										{lowStock.slice(0, 3).map((p) => (
											<div key={p._id} className="flex justify-between">
												<span>{p.name}</span>
												<Badge variant="destructive">
													{p.totalStock} / {p.minStock}
												</Badge>
											</div>
										))}
										{lowStock.length > 3 && (
											<p className="text-muted-foreground">
												+{lowStock.length - 3} nữa
											</p>
										)}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Không có cảnh báo tồn thấp
									</p>
								)}
							</CardContent>
						</Card>

						<Card className="border-yellow-500/50">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base text-yellow-500">
									<Clock className="h-4 w-4" />
									Sắp hết hạn ({expiring?.length || 0})
								</CardTitle>
							</CardHeader>
							<CardContent>
								{expiring && expiring.length > 0 ? (
									<div className="space-y-2 text-sm">
										{expiring.slice(0, 3).map((item) => (
											<div key={item._id} className="flex justify-between">
												<span>{item.product?.name || "Không xác định"}</span>
												<Badge
													variant="outline"
													className="border-yellow-500 text-yellow-500"
												>
													{formatDate(item.expiryDate)}
												</Badge>
											</div>
										))}
										{expiring.length > 3 && (
											<p className="text-muted-foreground">
												+{expiring.length - 3} nữa
											</p>
										)}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Không có sản phẩm sắp hết hạn
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Danh sách lô hàng</CardTitle>
								<div className="relative w-64">
									<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Tìm kiếm kho hàng..."
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										className="pl-8"
									/>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{inventory === undefined ? (
								<div className="py-8 text-center text-muted-foreground">
									Đang tải...
								</div>
							) : filteredInventory?.length === 0 ? (
								<div className="py-8 text-center">
									<Warehouse className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
									<p className="text-muted-foreground">
										Không tìm thấy kho hàng
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Số lô</TableHead>
											<TableHead>Sản phẩm</TableHead>
											<TableHead>Số lượng</TableHead>
											<TableHead>Hạn sử dụng</TableHead>
											<TableHead>Giá nhập</TableHead>
											<TableHead>Nhà cung cấp</TableHead>
											<TableHead>Vị trí</TableHead>
											<TableHead className="text-right">Thao tác</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredInventory?.map((item) => (
											<TableRow key={item._id}>
												<TableCell className="font-mono">
													{item.batchNumber}
												</TableCell>
												<TableCell>
													<div>
														<p className="font-medium">
															{item.product?.name || "-"}
														</p>
														<p className="text-muted-foreground text-xs">
															{item.product?.sku}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<span
														className={
															item.quantity === 0 ? "text-red-500" : ""
														}
													>
														{item.quantity}
													</span>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														{formatDate(item.expiryDate)}
														{isExpired(item.expiryDate) && (
															<Badge variant="destructive">Hết hạn</Badge>
														)}
														{!isExpired(item.expiryDate) &&
															isExpiringSoon(item.expiryDate) && (
																<Badge
																	variant="outline"
																	className="border-yellow-500 text-yellow-500"
																>
																	Sắp hết
																</Badge>
															)}
													</div>
												</TableCell>
												<TableCell>
													{formatCurrency(item.purchasePrice)}
												</TableCell>
												<TableCell>{item.supplier?.name || "-"}</TableCell>
												<TableCell>{item.location || "-"}</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => {
															setDeletingId(item._id);
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
				</TabsContent>

				{/* Tab: Phiếu nhập */}
				<TabsContent value="import" className="mt-4 space-y-6">
					<div className="flex justify-end">
						<Button
							onClick={() => {
								setTransferForm({
									...initialTransferForm,
									transferType: "import",
									transferDate: new Date().toISOString().split("T")[0],
								});
								setImportDialogOpen(true);
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Tạo phiếu nhập
						</Button>
					</div>

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Danh sách phiếu nhập</CardTitle>
								<div className="relative w-64">
									<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Tìm kiếm phiếu..."
										value={transferSearch}
										onChange={(e) => setTransferSearch(e.target.value)}
										className="pl-8"
									/>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{allImportTransfers === undefined ? (
								<div className="py-8 text-center text-muted-foreground">
									Đang tải...
								</div>
							) : filteredImportTransfers.length === 0 ? (
								<div className="py-8 text-center">
									<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
									<p className="text-muted-foreground">
										Không tìm thấy phiếu nhập
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Số phiếu</TableHead>
											<TableHead>Loại phiếu</TableHead>
											<TableHead>Đối tác</TableHead>
											<TableHead>Ngày chuyển</TableHead>
											<TableHead className="text-center">Trạng thái</TableHead>
											<TableHead className="text-right">Thao tác</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredImportTransfers.map((transfer) => (
											<TableRow
												key={transfer._id}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => viewTransferDetails(transfer._id)}
											>
												<TableCell className="font-mono">
													{transfer.transferNumber}
												</TableCell>
												<TableCell>
													{getTransferTypeLabel(transfer.transferType)}
												</TableCell>
												<TableCell>{transfer.partner?.name || "-"}</TableCell>
												<TableCell>
													{formatDate(transfer.transferDate)}
												</TableCell>
												<TableCell className="text-center">
													{getStatusBadge(transfer.status)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation();
															viewTransferDetails(transfer._id);
														}}
													>
														<Eye className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Tab: Phiếu xuất */}
				<TabsContent value="export" className="mt-4 space-y-6">
					<div className="flex justify-end">
						<Button
							onClick={() => {
								setTransferForm({
									...initialTransferForm,
									transferType: "export",
									transferDate: new Date().toISOString().split("T")[0],
								});
								setExportDialogOpen(true);
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Tạo phiếu xuất
						</Button>
					</div>

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Danh sách phiếu xuất</CardTitle>
								<div className="relative w-64">
									<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Tìm kiếm phiếu..."
										value={exportTransferSearch}
										onChange={(e) => setExportTransferSearch(e.target.value)}
										className="pl-8"
									/>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{allExportTransfers === undefined ? (
								<div className="py-8 text-center text-muted-foreground">
									Đang tải...
								</div>
							) : filteredExportTransfers.length === 0 ? (
								<div className="py-8 text-center">
									<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
									<p className="text-muted-foreground">
										Không tìm thấy phiếu xuất
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Số phiếu</TableHead>
											<TableHead>Loại phiếu</TableHead>
											<TableHead>Đối tác</TableHead>
											<TableHead>Ngày chuyển</TableHead>
											<TableHead className="text-center">Trạng thái</TableHead>
											<TableHead className="text-right">Thao tác</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredExportTransfers.map((transfer) => (
											<TableRow
												key={transfer._id}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => viewTransferDetails(transfer._id)}
											>
												<TableCell className="font-mono">
													{transfer.transferNumber}
												</TableCell>
												<TableCell>
													{getTransferTypeLabel(transfer.transferType)}
												</TableCell>
												<TableCell>{transfer.partner?.name || "-"}</TableCell>
												<TableCell>
													{formatDate(transfer.transferDate)}
												</TableCell>
												<TableCell className="text-center">
													{getStatusBadge(transfer.status)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation();
															viewTransferDetails(transfer._id);
														}}
													>
														<Eye className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Xóa bản ghi kho hàng</DialogTitle>
						<DialogDescription>
							Bạn có chắc muốn xóa bản ghi kho hàng này? Hành động này không thể
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

			{/* Quick Add Product Dialog */}
			<Dialog open={quickProductOpen} onOpenChange={setQuickProductOpen}>
				<DialogContent className="sm:max-w-[450px]">
					<form onSubmit={handleQuickAddProduct}>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<PackageOpen className="h-5 w-5 text-teal-600" />
								Thêm nhanh sản phẩm
							</DialogTitle>
							<DialogDescription>
								Tạo sản phẩm mới nhanh chóng. Giá nhập sẽ được lấy từ giá lô
								hàng ở trên.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="quickName">Tên sản phẩm *</Label>
									<Input
										id="quickName"
										value={quickProduct.name}
										onChange={(e) =>
											setQuickProduct({ ...quickProduct, name: e.target.value })
										}
										placeholder="VD: Paracetamol 500mg"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="quickSku">Mã SP *</Label>
									<Input
										id="quickSku"
										value={quickProduct.sku}
										onChange={(e) =>
											setQuickProduct({ ...quickProduct, sku: e.target.value })
										}
										placeholder="VD: PARA-500"
										required
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="quickUnit">Đơn vị *</Label>
									<Select
										value={quickProduct.unit}
										onValueChange={(v) =>
											v && setQuickProduct({ ...quickProduct, unit: v })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Chọn đơn vị" />
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
									<Label htmlFor="quickSalePrice">Giá bán *</Label>
									<Input
										id="quickSalePrice"
										type="number"
										min="0"
										value={quickProduct.salePrice}
										onChange={(e) =>
											setQuickProduct({
												...quickProduct,
												salePrice: e.target.value,
											})
										}
										placeholder="Giá bán"
										required
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="quickMinStock">Mức tồn tối thiểu</Label>
								<Input
									id="quickMinStock"
									type="number"
									min="0"
									value={quickProduct.minStock}
									onChange={(e) =>
										setQuickProduct({
											...quickProduct,
											minStock: e.target.value,
										})
									}
									placeholder="Mức cảnh báo tồn tối thiểu"
								/>
							</div>
							<p className="text-muted-foreground text-xs">
								Giá nhập sẽ được sao chép từ giá lô hàng (
								{form.purchasePrice
									? formatCurrency(Number.parseFloat(form.purchasePrice))
									: "chưa thiết lập"}
								).
							</p>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setQuickProductOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit">Tạo sản phẩm</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Create Import Dialog */}
			<Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
					<form onSubmit={handleCreateImportTransfer}>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<ArrowDownCircle className="h-5 w-5 text-teal-600" />
								Tạo phiếu nhập
							</DialogTitle>
							<DialogDescription>Tạo phiếu nhập kho mới.</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Loại phiếu *</Label>
									<Select
										value={transferForm.transferType}
										onValueChange={(v) =>
											v && setTransferForm({ ...transferForm, transferType: v })
										}
										required
									>
										<SelectTrigger>
											<SelectValue placeholder="Chọn loại phiếu" />
										</SelectTrigger>
										<SelectContent>
											{IMPORT_TYPES.map((type) => (
												<SelectItem key={type.value} value={type.value}>
													{type.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>
										{transferForm.transferType === "import_return"
											? "Khách hàng"
											: "Nhà cung cấp"}
									</Label>
									<Select
										value={transferForm.partnerId}
										onValueChange={(v) =>
											v && setTransferForm({ ...transferForm, partnerId: v })
										}
									>
										<SelectTrigger>
											{transferForm.partnerId ? (
												transferForm.transferType === "import_return" ? (
													getCustomerLabel(transferForm.partnerId)
												) : (
													getSupplierLabel(transferForm.partnerId)
												)
											) : (
												<span className="text-muted-foreground">
													{transferForm.transferType === "import_return"
														? "Chọn khách hàng"
														: "Chọn nhà cung cấp"}
												</span>
											)}
										</SelectTrigger>
										<SelectContent>
											{transferForm.transferType === "import_return"
												? customerOptions.map((c) => (
													<SelectItem key={c.value} value={c.value}>
														{c.label}
													</SelectItem>
												))
												: supplierOptions.map((s) => (
													<SelectItem key={s.value} value={s.value}>
														{s.label}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Ngày chuyển *</Label>
									<Input
										type="date"
										value={transferForm.transferDate}
										onChange={(e) =>
											setTransferForm({
												...transferForm,
												transferDate: e.target.value,
											})
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label>Ghi chú</Label>
									<Input
										value={transferForm.notes}
										onChange={(e) =>
											setTransferForm({
												...transferForm,
												notes: e.target.value,
											})
										}
										placeholder="Ghi chú thêm..."
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Sản phẩm *</Label>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleAddTransferItem}
									>
										<Plus className="mr-1 h-4 w-4" /> Thêm sản phẩm
									</Button>
								</div>
								{transferForm.items.map((item, index) => (
									<div key={index} className="space-y-3 rounded-lg border p-3">
										<div className="grid grid-cols-12 items-end gap-2">
											<div className="col-span-4">
												<Label className="text-xs">Sản phẩm</Label>
												<Select
													value={item.productId}
													onValueChange={(v) =>
														v && handleTransferItemChange(index, "productId", v)
													}
												>
													<SelectTrigger className="mt-1 h-9">
														{item.productId ? (
															<span>{getProductLabel(item.productId)}</span>
														) : (
															<span className="text-muted-foreground text-xs">
																Chọn SP
															</span>
														)}
													</SelectTrigger>
													<SelectContent>
														{productOptions.map((p) => (
															<SelectItem key={p.value} value={p.value}>
																{p.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="col-span-2">
												<Label className="text-xs">Số lô</Label>
												<Input
													value={item.batchNumber}
													onChange={(e) =>
														handleTransferItemChange(
															index,
															"batchNumber",
															e.target.value,
														)
													}
													placeholder="Số lô"
													className="mt-1 h-9"
												/>
											</div>
											<div className="col-span-2">
												<Label className="text-xs">Số lượng</Label>
												<Input
													type="number"
													min="1"
													value={item.quantity}
													onChange={(e) =>
														handleTransferItemChange(
															index,
															"quantity",
															e.target.value,
														)
													}
													placeholder="SL"
													className="mt-1 h-9"
												/>
											</div>
											<div className="col-span-2">
												<Label className="text-xs">Đơn giá</Label>
												<Input
													type="number"
													min="0"
													value={item.unitPrice}
													onChange={(e) =>
														handleTransferItemChange(
															index,
															"unitPrice",
															e.target.value,
														)
													}
													placeholder="Giá"
													className="mt-1 h-9"
												/>
											</div>
											<div className="col-span-1">
												<Label className="text-xs">HSD</Label>
												<Input
													type="date"
													value={item.expiryDate}
													onChange={(e) =>
														handleTransferItemChange(
															index,
															"expiryDate",
															e.target.value,
														)
													}
													className="mt-1 h-9"
												/>
											</div>
											<div className="col-span-1">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-10"
													onClick={() => handleRemoveTransferItem(index)}
													disabled={transferForm.items.length === 1}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setImportDialogOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit">Tạo phiếu nhập</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Create Export Dialog */}
			<Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
					<form onSubmit={handleCreateExportTransfer}>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<ArrowUpCircle className="h-5 w-5 text-teal-600" />
								Tạo phiếu xuất
							</DialogTitle>
							<DialogDescription>
								Tạo phiếu xuất kho. Chọn sản phẩm và lô hàng từ kho.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Loại phiếu *</Label>
									<Select
										value={transferForm.transferType}
										onValueChange={(v) =>
											v && setTransferForm({ ...transferForm, transferType: v })
										}
										required
									>
										<SelectTrigger>
											{transferForm.transferType ? (
												<span>
													{EXPORT_TYPES.find(
														(t) => t.value === transferForm.transferType,
													)?.label}
												</span>
											) : (
												<span className="text-muted-foreground">Chọn loại phiếu</span>
											)}
										</SelectTrigger>
										<SelectContent>
											{EXPORT_TYPES.map((type) => (
												<SelectItem key={type.value} value={type.value}>
													{type.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>
										{["export_return", "export_destruction"].includes(
											transferForm.transferType,
										)
											? "Nhà cung cấp"
											: "Khách hàng"}
									</Label>
									<Select
										value={transferForm.partnerId}
										onValueChange={(v) =>
											v && setTransferForm({ ...transferForm, partnerId: v })
										}
									>
										<SelectTrigger>
											{transferForm.partnerId ? (
												["export_return", "export_destruction"].includes(
													transferForm.transferType,
												) ? (
													getSupplierLabel(transferForm.partnerId)
												) : (
													getCustomerLabel(transferForm.partnerId)
												)
											) : (
												<span className="text-muted-foreground">
													{["export_return", "export_destruction"].includes(
														transferForm.transferType,
													)
														? "Chọn nhà cung cấp"
														: "Chọn khách hàng"}
												</span>
											)}
										</SelectTrigger>
										<SelectContent>
											{["export_return", "export_destruction"].includes(
												transferForm.transferType,
											)
												? supplierOptions.map((s) => (
													<SelectItem key={s.value} value={s.value}>
														{s.label}
													</SelectItem>
												))
												: customerOptions.map((c) => (
													<SelectItem key={c.value} value={c.value}>
														{c.label}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Ngày chuyển *</Label>
									<Input
										type="date"
										value={transferForm.transferDate}
										onChange={(e) =>
											setTransferForm({
												...transferForm,
												transferDate: e.target.value,
											})
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label>Ghi chú</Label>
									<Input
										value={transferForm.notes}
										onChange={(e) =>
											setTransferForm({
												...transferForm,
												notes: e.target.value,
											})
										}
										placeholder="Ghi chú thêm..."
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Sản phẩm *</Label>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleAddTransferItem}
									>
										<Plus className="mr-1 h-4 w-4" /> Thêm sản phẩm
									</Button>
								</div>
								<p className="text-muted-foreground text-xs">
									Chọn sản phẩm, sau đó chọn lô hàng từ kho hiện có để xuất.
								</p>
								{transferForm.items.map((item, index) => (
									<div key={index} className="space-y-3 rounded-lg border p-3">
										<div className="grid grid-cols-12 items-end gap-2">
											<div className="col-span-3">
												<Label className="text-xs">Sản phẩm</Label>
												<Select
													value={item.productId}
													onValueChange={(v) =>
														v && handleTransferItemChange(index, "productId", v)
													}
												>
													<SelectTrigger className="mt-1 h-9">
														{item.productId ? (
															<span>{getProductLabel(item.productId)}</span>
														) : (
															<span className="text-muted-foreground text-xs">
																Chọn SP
															</span>
														)}
													</SelectTrigger>
													<SelectContent>
														{productOptions.map((p) => (
															<SelectItem key={p.value} value={p.value}>
																{p.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="col-span-3">
												<Label className="text-xs">Lô hàng từ kho</Label>
												<Select
													value={item.inventoryId}
													onValueChange={(v) =>
														v &&
														handleTransferItemChange(index, "inventoryId", v)
													}
													disabled={!item.productId}
												>
													<SelectTrigger className="mt-1 h-9">
														{item.inventoryId ? (
															(() => {
																const inv = availableInventory?.find(
																	(i) => i._id === item.inventoryId,
																);
																return inv ? (
																	<span>{inv.batchNumber} (SL: {inv.quantity})</span>
																) : (
																	<span className="text-muted-foreground text-xs">Chọn lô</span>
																);
															})()
														) : (
															<span className="text-muted-foreground text-xs">Chọn lô</span>
														)}
													</SelectTrigger>
													<SelectContent>
														{item.productId === selectedProductIdForInventory
															? availableInventory?.map((inv) => (
																<SelectItem key={inv._id} value={inv._id}>
																	{inv.batchNumber} (SL: {inv.quantity})
																</SelectItem>
															))
															: null}
													</SelectContent>
												</Select>
											</div>
											<div className="col-span-2">
												<Label className="text-xs">Số lô</Label>
												<Input
													value={item.batchNumber}
													className="mt-1 h-9 bg-muted"
													readOnly
													placeholder="Tự động"
												/>
											</div>
											<div className="col-span-2">
												<Label className="text-xs">Số lượng</Label>
												<Input
													type="number"
													min="1"
													value={item.quantity}
													onChange={(e) =>
														handleTransferItemChange(
															index,
															"quantity",
															e.target.value,
														)
													}
													placeholder="SL"
													className="mt-1 h-9"
												/>
											</div>
											<div className="col-span-1">
												<Label className="text-xs">Đơn giá</Label>
												<Input
													type="number"
													min="0"
													value={item.unitPrice}
													onChange={(e) =>
														handleTransferItemChange(
															index,
															"unitPrice",
															e.target.value,
														)
													}
													className="mt-1 h-9"
												/>
											</div>
											<div className="col-span-1">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-10"
													onClick={() => handleRemoveTransferItem(index)}
													disabled={transferForm.items.length === 1}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setExportDialogOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit">Tạo phiếu xuất</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Transfer Detail Dialog */}
			<Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-teal-600" />
							Chi tiết phiếu - {transferDetails?.transferNumber}
						</DialogTitle>
					</DialogHeader>
					{transferDetails && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-muted-foreground text-sm">Loại phiếu</p>
									<p className="font-medium">
										{getTransferTypeLabel(transferDetails.transferType)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Trạng thái</p>
									{getStatusBadge(transferDetails.status)}
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Đối tác</p>
									<p className="font-medium">
										{transferDetails.partner?.name || "-"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Ngày chuyển</p>
									<p>{formatDate(transferDetails.transferDate)}</p>
								</div>
							</div>

							{transferDetails.notes && (
								<div>
									<p className="text-muted-foreground text-sm">Ghi chú</p>
									<p>{transferDetails.notes}</p>
								</div>
							)}

							<div>
								<p className="mb-2 font-medium text-sm">Sản phẩm</p>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Sản phẩm</TableHead>
											<TableHead>Số lô</TableHead>
											<TableHead className="text-right">SL</TableHead>
											<TableHead className="text-right">Đơn giá</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{transferDetails.items?.map((item: any) => (
											<TableRow key={item._id}>
												<TableCell>{item.product?.name}</TableCell>
												<TableCell className="font-mono">
													{item.batchNumber}
												</TableCell>
												<TableCell className="text-right">
													{item.quantity}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.unitPrice)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
					<DialogFooter className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => setDetailDialogOpen(false)}
						>
							Đóng
						</Button>
						{transferDetails?.status === "draft" && (
							<>
								<Button
									variant="default"
									className="bg-green-600 hover:bg-green-700"
									onClick={handleConfirmTransfer}
								>
									<CheckCircle className="mr-1 h-4 w-4" />
									Xác nhận
								</Button>
								<Button variant="outline" onClick={handleCancelTransfer}>
									<XCircle className="mr-1 h-4 w-4" />
									Hủy
								</Button>
								<Button variant="destructive" onClick={handleDeleteTransfer}>
									<Trash2 className="mr-1 h-4 w-4" />
									Xóa
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
