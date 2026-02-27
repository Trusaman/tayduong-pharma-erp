import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
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

interface ProductForm {
	name: string;
	sku: string;
	categoryId: string;
	description: string;
	unit: string;
	purchasePrice: string;
	salePrice: string;
	minStock: string;
}

const initialForm: ProductForm = {
	name: "",
	sku: "",
	categoryId: "",
	description: "",
	unit: "tablet",
	purchasePrice: "",
	salePrice: "",
	minStock: "0",
};

function ProductsPage() {
	const [search, setSearch] = useState("");
	const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<ProductForm>(initialForm);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [toggleConfirmProduct, setToggleConfirmProduct] = useState<any>(null);

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
			setForm({ ...form, categoryId: categoryId as string });
		} catch (error: any) {
			toast.error(error.message || "Không thể tạo danh mục");
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
			setForm({ ...form, unit: unitLower });
			setQuickUnitOpen(false);
			setNewUnitName("");
		} catch (error: any) {
			toast.error(error.message || "Không thể thêm đơn vị");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (editingId) {
				await updateProduct({
					id: editingId as any,
					name: form.name,
					sku: form.sku,
					categoryId: form.categoryId ? (form.categoryId as any) : undefined,
					description: form.description || undefined,
					unit: form.unit,
					purchasePrice: Number.parseFloat(form.purchasePrice),
					salePrice: Number.parseFloat(form.salePrice),
					minStock: Number.parseInt(form.minStock),
				});
				toast.success("Đã cập nhật sản phẩm thành công");
			} else {
				await createProduct({
					name: form.name,
					sku: form.sku,
					categoryId: form.categoryId ? (form.categoryId as any) : undefined,
					description: form.description || undefined,
					unit: form.unit,
					purchasePrice: Number.parseFloat(form.purchasePrice),
					salePrice: Number.parseFloat(form.salePrice),
					minStock: Number.parseInt(form.minStock),
				});
				toast.success("Đã tạo sản phẩm thành công");
			}
			setDialogOpen(false);
			setForm(initialForm);
			setEditingId(null);
		} catch (error: any) {
			toast.error(error.message || "Không thể lưu sản phẩm");
		}
	};

	const handleEdit = (product: any) => {
		setEditingId(product._id);
		setForm({
			name: product.name,
			sku: product.sku,
			categoryId: product.categoryId || "",
			description: product.description || "",
			unit: product.unit,
			purchasePrice: product.purchasePrice.toString(),
			salePrice: product.salePrice.toString(),
			minStock: product.minStock.toString(),
		});
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deletingId) return;
		try {
			await deleteProduct({ id: deletingId as any });
			toast.success("Đã xóa sản phẩm thành công");
			setDeleteDialogOpen(false);
			setDeletingId(null);
		} catch (error: any) {
			toast.error(error.message || "Không thể xóa sản phẩm");
		}
	};

	const handleToggleActive = (product: any) => {
		setToggleConfirmProduct(product);
	};

	const handleConfirmToggle = async () => {
		if (!toggleConfirmProduct) return;
		try {
			await updateProduct({
				id: toggleConfirmProduct._id as any,
				isActive: !toggleConfirmProduct.isActive,
			});
			toast.success(
				toggleConfirmProduct.isActive
					? `Đã ngừng theo dõi "${toggleConfirmProduct.name}"`
					: `Đã theo dõi lại "${toggleConfirmProduct.name}"`,
			);
		} catch (error: any) {
			toast.error(error.message || "Không thể cập nhật trạng thái");
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

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Sản phẩm</h2>
					<p className="text-muted-foreground">Quản lý danh mục sản phẩm</p>
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
							Thêm sản phẩm
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[500px]">
						<form onSubmit={handleSubmit}>
							<DialogHeader>
								<DialogTitle>
									{editingId ? "Sửa sản phẩm" : "Thêm sản phẩm"}
								</DialogTitle>
								<DialogDescription>
									Nhập thông tin sản phẩm bên dưới.
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
										<Label htmlFor="sku">Mã SKU *</Label>
										<Input
											id="sku"
											value={form.sku}
											onChange={(e) =>
												setForm({ ...form, sku: e.target.value })
											}
											required
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="category">Danh mục</Label>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-6 px-2 text-teal-600 text-xs hover:text-teal-700"
												onClick={() => setQuickCategoryOpen(true)}
											>
												<FolderPlus className="mr-1 h-3 w-3" />
												Thêm
											</Button>
										</div>
										<Select
											value={form.categoryId || ""}
											onValueChange={(v) =>
												v &&
												v !== "_none" &&
												setForm({ ...form, categoryId: v })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Chọn danh mục">
													{form.categoryId &&
														categories?.find((c) => c._id === form.categoryId)
															?.name}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{categories?.map((cat) => (
													<SelectItem key={cat._id} value={cat._id}>
														{cat.name}
													</SelectItem>
												))}
												{(!categories || categories.length === 0) && (
													<SelectItem value="_none" disabled>
														Chưa có danh mục - bấm Thêm để tạo
													</SelectItem>
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="unit">Đơn vị *</Label>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-6 px-2 text-teal-600 text-xs hover:text-teal-700"
												onClick={() => setQuickUnitOpen(true)}
											>
												<Ruler className="mr-1 h-3 w-3" />
												Thêm
											</Button>
										</div>
										<Select
											value={form.unit}
											onValueChange={(v) => v && setForm({ ...form, unit: v })}
											required
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
								</div>
								<div className="space-y-2">
									<Label htmlFor="description">Mô tả</Label>
									<Textarea
										id="description"
										value={form.description}
										onChange={(e) =>
											setForm({ ...form, description: e.target.value })
										}
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
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
									<div className="space-y-2">
										<Label htmlFor="salePrice">Giá bán *</Label>
										<Input
											id="salePrice"
											type="number"
											step="1"
											min="0"
											value={form.salePrice}
											onChange={(e) =>
												setForm({ ...form, salePrice: e.target.value })
											}
											required
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="minStock">Mức tồn kho tối thiểu</Label>
									<Input
										id="minStock"
										type="number"
										min="0"
										value={form.minStock}
										onChange={(e) =>
											setForm({ ...form, minStock: e.target.value })
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
									<SelectItem value="inactive">Ngưng theo dõi</SelectItem>
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
												<Badge variant="secondary">Ngưng bán</Badge>
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
													<><EyeOff className="h-3.5 w-3.5" />Ngưng theo dõi</>
												) : (
													<><Eye className="h-3.5 w-3.5 text-teal-600" />Theo dõi lại</>
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
										⚠️ Sản phẩm này sẽ bị ẩn khỏi danh sách bán
										hàng và không thể chọn khi tạo phiếu nhập/xuất
										mới. Dữ liệu lịch sử vẫn được giữ nguyên.
									</p>
								) : (
									<p className="text-teal-600 text-sm">
										✅ Sản phẩm này sẽ được hiển thị lại và có thể
										sử dụng trong các phiếu nhập/xuất.
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
							variant={toggleConfirmProduct?.isActive ? "destructive" : "default"}
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
								onKeyDown={(e) =>
									e.key === "Enter" &&
									(e.preventDefault(), handleQuickAddCategory())
								}
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
								onKeyDown={(e) =>
									e.key === "Enter" &&
									(e.preventDefault(), handleQuickAddUnit())
								}
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
