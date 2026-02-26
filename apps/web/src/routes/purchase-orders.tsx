import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle,
	Eye,
	Package,
	Plus,
	Search,
	ShoppingCart,
	Trash2,
	Users,
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/purchase-orders")({
	component: PurchaseOrdersPage,
});

interface OrderItem {
	productId: string;
	quantity: string;
	unitPrice: string;
}

const initialItem: OrderItem = { productId: "", quantity: "1", unitPrice: "" };

interface QuickSupplierForm {
	name: string;
	code: string;
}

const initialQuickSupplier: QuickSupplierForm = { name: "", code: "" };

interface ReceiveItem {
	itemId: string;
	receivedQuantity: string;
	batchNumber: string;
	expiryDate: string;
}

function PurchaseOrdersPage() {
	const [search, setSearch] = useState("");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);

	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [supplierId, setSupplierId] = useState("");
	const [notes, setNotes] = useState("");
	const [expectedDate, setExpectedDate] = useState("");
	const [items, setItems] = useState<OrderItem[]>([initialItem]);
	const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
	const [quickSupplier, setQuickSupplier] =
		useState<QuickSupplierForm>(initialQuickSupplier);
	const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
	const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);

	const orders = useQuery(api.purchaseOrders.listWithSuppliers, {});
	const suppliers = useQuery(api.suppliers.list, { activeOnly: true });
	const products = useQuery(api.products.list, { activeOnly: true });
	const orderDetails = useQuery(
		api.purchaseOrders.getWithDetails,
		selectedOrderId ? { id: selectedOrderId as any } : "skip",
	);

	const createOrder = useMutation(api.purchaseOrders.create);
	const updateStatus = useMutation(api.purchaseOrders.updateStatus);
	const deleteOrder = useMutation(api.purchaseOrders.remove);
	const createSupplier = useMutation(api.suppliers.create);
	const receivePurchaseItems = useMutation(api.purchaseOrders.receiveItems);

	const filteredOrders = orders?.filter(
		(o) =>
			o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
			o.supplier?.name.toLowerCase().includes(search.toLowerCase()),
	);

	const handleAddItem = () => {
		setItems([...items, { ...initialItem }]);
	};

	const handleRemoveItem = (index: number) => {
		if (items.length > 1) {
			setItems(items.filter((_, i) => i !== index));
		}
	};

	const handleItemChange = (
		index: number,
		field: keyof OrderItem,
		value: string,
	) => {
		const newItems = [...items];
		newItems[index] = { ...newItems[index], [field]: value };
		setItems(newItems);
	};

	const handleCreateOrder = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validItems = items.filter(
				(item) => item.productId && item.quantity && item.unitPrice,
			);
			if (validItems.length === 0) {
				toast.error("Vui lòng thêm ít nhất một sản phẩm");
				return;
			}

			await createOrder({
				supplierId: supplierId as any,
				items: validItems.map((item) => ({
					productId: item.productId as any,
					quantity: Number.parseInt(item.quantity),
					unitPrice: Number.parseFloat(item.unitPrice),
				})),
				notes: notes || undefined,
				expectedDate: expectedDate
					? new Date(expectedDate).getTime()
					: undefined,
			});
			toast.success("Đã tạo đơn nhập hàng thành công");
			setCreateDialogOpen(false);
			resetForm();
		} catch (error: any) {
			toast.error(error.message || "Không thể tạo đơn");
		}
	};

	const handleStatusChange = async (orderId: string, status: string) => {
		try {
			await updateStatus({ id: orderId as any, status: status as any });
			toast.success("Đã cập nhật trạng thái đơn");
		} catch (error: any) {
			toast.error(error.message || "Không thể cập nhật trạng thái");
		}
	};

	const handleDelete = async (orderId: string) => {
		try {
			await deleteOrder({ id: orderId as any });
			toast.success("Đã xóa đơn hàng thành công");
		} catch (error: any) {
			toast.error(error.message || "Không thể xóa đơn hàng");
		}
	};

	const resetForm = () => {
		setSupplierId("");
		setNotes("");
		setExpectedDate("");
		setItems([initialItem]);
	};

	const handleQuickAddSupplier = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!quickSupplier.name.trim() || !quickSupplier.code.trim()) {
			toast.error("Vui lòng nhập đầy đủ tên và mã nhà cung cấp");
			return;
		}
		try {
			const supplierIdResult = await createSupplier({
				name: quickSupplier.name.trim(),
				code: quickSupplier.code.trim(),
			});
			toast.success("Đã tạo nhà cung cấp thành công");
			setQuickSupplierOpen(false);
			setQuickSupplier(initialQuickSupplier);
			setSupplierId(supplierIdResult as string);
		} catch (error: any) {
			toast.error(error.message || "Không thể tạo nhà cung cấp");
		}
	};

	// Initialize receive items when orderDetails is loaded for receive dialog
	useEffect(() => {
		if (receiveDialogOpen && orderDetails?.items) {
			const initialReceiveItems = orderDetails.items.map((item: any) => ({
				itemId: item._id,
				receivedQuantity: "",
				batchNumber: "",
				expiryDate: "",
			}));
			setReceiveItems(initialReceiveItems);
		}
	}, [receiveDialogOpen, orderDetails?.items]);

	const openReceiveDialog = (orderId: string) => {
		setSelectedOrderId(orderId);
		setReceiveDialogOpen(true);
	};

	const handleReceiveItemChange = (
		index: number,
		field: keyof ReceiveItem,
		value: string,
	) => {
		const newItems = [...receiveItems];
		newItems[index] = { ...newItems[index], [field]: value };
		setReceiveItems(newItems);
	};

	const handleReceiveItems = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validItems = receiveItems.filter(
				(item) => item.receivedQuantity && item.batchNumber && item.expiryDate,
			);
			if (validItems.length === 0) {
				toast.error(
					"Vui lòng nhập thông tin nhận hàng cho ít nhất một sản phẩm",
				);
				return;
			}

			await receivePurchaseItems({
				purchaseOrderId: selectedOrderId as any,
				items: validItems.map((item) => ({
					itemId: item.itemId as any,
					receivedQuantity: Number.parseInt(item.receivedQuantity),
					batchNumber: item.batchNumber,
					expiryDate: new Date(item.expiryDate).getTime(),
				})),
			});
			toast.success("Đã nhận hàng thành công và tạo bản ghi kho hàng");
			setReceiveDialogOpen(false);
			setReceiveItems([]);
		} catch (error: any) {
			toast.error(error.message || "Không thể nhận hàng");
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

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "draft":
				return <Badge variant="secondary">Bản nháp</Badge>;
			case "pending":
				return <Badge variant="outline">Chờ xử lý</Badge>;
			case "partial":
				return (
					<Badge
						variant="outline"
						className="border-yellow-500 text-yellow-500"
					>
						Một phần
					</Badge>
				);
			case "received":
				return (
					<Badge variant="default" className="bg-green-600">
						Đã nhận
					</Badge>
				);
			case "cancelled":
				return <Badge variant="destructive">Đã hủy</Badge>;
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	const viewOrderDetails = (orderId: string) => {
		setSelectedOrderId(orderId);
		setDetailDialogOpen(true);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Đơn nhập hàng</h2>
					<p className="text-muted-foreground">
						Quản lý đơn nhập hàng từ nhà cung cấp
					</p>
				</div>
				<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={resetForm}>
							<Plus className="mr-2 h-4 w-4" />
							Tạo đơn
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
						<form onSubmit={handleCreateOrder}>
							<DialogHeader>
								<DialogTitle>Tạo đơn nhập hàng</DialogTitle>
								<DialogDescription>
									Tạo đơn nhập hàng mới cho nhà cung cấp.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label>Nhà cung cấp *</Label>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 text-teal-600 text-xs hover:text-teal-700"
												onClick={() => setQuickSupplierOpen(true)}
											>
												<Plus className="mr-1 h-3 w-3" />
												Thêm nhanh
											</Button>
										</div>
										<Select
											value={supplierId}
											onValueChange={(v) => v && setSupplierId(v)}
											required
										>
											<SelectTrigger>
												<SelectValue placeholder="Chọn nhà cung cấp" />
											</SelectTrigger>
											<SelectContent>
												{suppliers?.map((s) => (
													<SelectItem key={s._id} value={s._id}>
														{s.name}
													</SelectItem>
												))}
												{(!suppliers || suppliers.length === 0) && (
													<SelectItem value="_none" disabled>
														Chưa có NCC - bấm Thêm nhanh để tạo
													</SelectItem>
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Ngày dự kiến</Label>
										<Input
											type="date"
											value={expectedDate}
											onChange={(e) => setExpectedDate(e.target.value)}
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
											onClick={handleAddItem}
										>
											<Plus className="mr-1 h-4 w-4" /> Thêm sản phẩm
										</Button>
									</div>
									{items.map((item, index) => (
										<div
											key={index}
											className="grid grid-cols-12 items-end gap-2"
										>
											<div className="col-span-5">
												<Select
													value={item.productId}
													onValueChange={(v) =>
														v && handleItemChange(index, "productId", v)
													}
												>
													<SelectTrigger className="h-9">
														<SelectValue placeholder="Sản phẩm" />
													</SelectTrigger>
													<SelectContent>
														{products?.map((p) => (
															<SelectItem key={p._id} value={p._id}>
																{p.name} ({p.sku})
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="col-span-2">
												<Input
													type="number"
													placeholder="SL"
													value={item.quantity}
													onChange={(e) =>
														handleItemChange(index, "quantity", e.target.value)
													}
													className="h-9"
													min="1"
												/>
											</div>
											<div className="col-span-4">
												<Input
													type="number"
													placeholder="Đơn giá"
													value={item.unitPrice}
													onChange={(e) =>
														handleItemChange(index, "unitPrice", e.target.value)
													}
													className="h-9"
													min="0"
												/>
											</div>
											<div className="col-span-1">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-9"
													onClick={() => handleRemoveItem(index)}
													disabled={items.length === 1}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</div>
									))}
								</div>

								<div className="space-y-2">
									<Label>Ghi chú</Label>
									<Textarea
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										placeholder="Ghi chú thêm..."
									/>
								</div>
							</div>
							<DialogFooter>
								<Button type="submit">Tạo đơn</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Danh sách đơn hàng</CardTitle>
						<div className="relative w-64">
							<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Tìm kiếm đơn hàng..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-8"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{orders === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải...
						</div>
					) : filteredOrders?.length === 0 ? (
						<div className="py-8 text-center">
							<ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<p className="text-muted-foreground">
								Không tìm thấy đơn nhập hàng
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Số đơn</TableHead>
									<TableHead>Nhà cung cấp</TableHead>
									<TableHead>Ngày đặt</TableHead>
									<TableHead>Dự kiến</TableHead>
									<TableHead className="text-right">Tổng tiền</TableHead>
									<TableHead className="text-center">Trạng thái</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredOrders?.map((order) => (
									<TableRow key={order._id}>
										<TableCell className="font-mono">
											{order.orderNumber}
										</TableCell>
										<TableCell>{order.supplier?.name || "-"}</TableCell>
										<TableCell>{formatDate(order.orderDate)}</TableCell>
										<TableCell>
											{order.expectedDate
												? formatDate(order.expectedDate)
												: "-"}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(order.totalAmount)}
										</TableCell>
										<TableCell className="text-center">
											{getStatusBadge(order.status)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => viewOrderDetails(order._id)}
											>
												<Eye className="h-4 w-4" />
											</Button>
											{order.status === "draft" && (
												<>
													<Button
														variant="ghost"
														size="icon"
														onClick={() =>
															handleStatusChange(order._id, "pending")
														}
													>
														<CheckCircle className="h-4 w-4 text-green-500" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleDelete(order._id)}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</>
											)}
											{order.status === "pending" && (
												<>
													<Button
														variant="ghost"
														size="icon"
														onClick={() => openReceiveDialog(order._id)}
														title="Nhận hàng"
													>
														<Package className="h-4 w-4 text-teal-600" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														onClick={() =>
															handleStatusChange(order._id, "cancelled")
														}
													>
														<XCircle className="h-4 w-4 text-destructive" />
													</Button>
												</>
											)}
											{order.status === "partial" && (
												<Button
													variant="ghost"
													size="icon"
													onClick={() => openReceiveDialog(order._id)}
													title="Nhận thêm hàng"
												>
													<Package className="h-4 w-4 text-teal-600" />
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Order Details Dialog */}
			<Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>
							Chi tiết đơn - {orderDetails?.orderNumber}
						</DialogTitle>
					</DialogHeader>
					{orderDetails && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-muted-foreground text-sm">Nhà cung cấp</p>
									<p className="font-medium">{orderDetails.supplier?.name}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Trạng thái</p>
									{getStatusBadge(orderDetails.status)}
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Ngày đặt</p>
									<p>{formatDate(orderDetails.orderDate)}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Tổng tiền</p>
									<p className="font-bold">
										{formatCurrency(orderDetails.totalAmount)}
									</p>
								</div>
							</div>

							{orderDetails.notes && (
								<div>
									<p className="text-muted-foreground text-sm">Ghi chú</p>
									<p>{orderDetails.notes}</p>
								</div>
							)}

							<div>
								<p className="mb-2 font-medium text-sm">Sản phẩm</p>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Sản phẩm</TableHead>
											<TableHead className="text-right">SL</TableHead>
											<TableHead className="text-right">Đơn giá</TableHead>
											<TableHead className="text-right">Thành tiền</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{orderDetails.items?.map((item: any) => (
											<TableRow key={item._id}>
												<TableCell>{item.product?.name}</TableCell>
												<TableCell className="text-right">
													{item.quantity}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.unitPrice)}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.quantity * item.unitPrice)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDetailDialogOpen(false)}
						>
							Đóng
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Quick Add Supplier Dialog */}
			<Dialog open={quickSupplierOpen} onOpenChange={setQuickSupplierOpen}>
				<DialogContent className="sm:max-w-[400px]">
					<form onSubmit={handleQuickAddSupplier}>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Users className="h-5 w-5 text-teal-600" />
								Thêm nhanh nhà cung cấp
							</DialogTitle>
							<DialogDescription>
								Tạo nhà cung cấp mới nhanh chóng.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="supplierName">Tên NCC *</Label>
									<Input
										id="supplierName"
										value={quickSupplier.name}
										onChange={(e) =>
											setQuickSupplier({
												...quickSupplier,
												name: e.target.value,
											})
										}
										placeholder="VD: Công ty ABC"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="supplierCode">Mã NCC *</Label>
									<Input
										id="supplierCode"
										value={quickSupplier.code}
										onChange={(e) =>
											setQuickSupplier({
												...quickSupplier,
												code: e.target.value,
											})
										}
										placeholder="VD: NCC001"
										required
									/>
								</div>
							</div>
							<p className="text-muted-foreground text-xs">
								Bạn có thể cập nhật thêm thông tin sau tại trang Nhà cung cấp.
							</p>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setQuickSupplierOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit">Tạo NCC</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Receive Items Dialog */}
			<Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
					<form onSubmit={handleReceiveItems}>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Package className="h-5 w-5 text-teal-600" />
								Nhận hàng - {orderDetails?.orderNumber}
							</DialogTitle>
							<DialogDescription>
								Nhập thông tin lô hàng để tạo bản ghi kho hàng.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							{orderDetails?.items?.map((item: any, index: number) => {
								const remainingQty =
									item.quantity - (item.receivedQuantity || 0);
								if (remainingQty <= 0) return null;

								return (
									<div
										key={item._id}
										className="space-y-3 rounded-lg border p-4"
									>
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium">{item.product?.name}</p>
												<p className="text-muted-foreground text-sm">
													Cần nhận: {remainingQty} / {item.quantity} | Đơn giá:{" "}
													{formatCurrency(item.unitPrice)}
												</p>
											</div>
										</div>
										<div className="grid grid-cols-3 gap-3">
											<div className="space-y-1">
												<Label className="text-xs">SL nhận *</Label>
												<Input
													type="number"
													min="1"
													max={remainingQty}
													value={receiveItems[index]?.receivedQuantity || ""}
													onChange={(e) =>
														handleReceiveItemChange(
															index,
															"receivedQuantity",
															e.target.value,
														)
													}
													placeholder="SL"
													className="h-8"
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">Số lô *</Label>
												<Input
													value={receiveItems[index]?.batchNumber || ""}
													onChange={(e) =>
														handleReceiveItemChange(
															index,
															"batchNumber",
															e.target.value,
														)
													}
													placeholder="VD: LOT001"
													className="h-8"
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">HSD *</Label>
												<Input
													type="date"
													value={receiveItems[index]?.expiryDate || ""}
													onChange={(e) =>
														handleReceiveItemChange(
															index,
															"expiryDate",
															e.target.value,
														)
													}
													className="h-8"
												/>
											</div>
										</div>
									</div>
								);
							})}
							{orderDetails?.items?.every(
								(item: any) => item.quantity <= (item.receivedQuantity || 0),
							) && (
								<p className="py-4 text-center text-muted-foreground">
									Tất cả sản phẩm đã được nhận đủ.
								</p>
							)}
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setReceiveDialogOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit">Xác nhận nhận hàng</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
