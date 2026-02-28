import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle,
	ClipboardList,
	Eye,
	Plus,
	Search,
	Trash2,
	Truck,
	XCircle,
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

export const Route = createFileRoute("/sales-orders")({
	component: SalesOrdersPage,
});

interface OrderItem {
	productId: string;
	quantity: string;
	unitPrice: string;
}

const initialItem: OrderItem = { productId: "", quantity: "1", unitPrice: "" };

function SalesOrdersPage() {
	const [search, setSearch] = useState("");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [customerId, setCustomerId] = useState("");
	const [salesmanId, setSalesmanId] = useState("");
	const [notes, setNotes] = useState("");
	const [items, setItems] = useState<OrderItem[]>([initialItem]);

	// Status‑change dialog state
	const [statusDialogOpen, setStatusDialogOpen] = useState(false);
	const [pendingStatusChange, setPendingStatusChange] = useState<{
		orderId: string;
		toStatus: "pending" | "delivering" | "completed" | "cancelled";
	} | null>(null);
	const [changedByName, setChangedByName] = useState("");
	const [statusComment, setStatusComment] = useState("");
	const [deliveryEmployeeId, setDeliveryEmployeeId] = useState("");

	const orders = useQuery(api.salesOrders.listWithCustomers, {});
	const customers = useQuery(api.customers.list, { activeOnly: true });
	const salesmen = useQuery(api.salesmen.list, { activeOnly: true });
	const products = useQuery(api.products.list, { activeOnly: true });
	const selectedProductIds = Array.from(
		new Set(items.map((item) => item.productId).filter(Boolean)),
	) as Id<"products">[];
	const applicableDiscounts = useQuery(
		api.discounts.getApplicableForOrder,
		customerId && salesmanId && selectedProductIds.length > 0
			? {
				customerId: customerId as Id<"customers">,
				salesmanId: salesmanId as Id<"salesmen">,
				productIds: selectedProductIds,
			}
			: "skip",
	);
	const orderDetails = useQuery(
		api.salesOrders.getWithDetails,
		selectedOrderId ? { id: selectedOrderId as Id<"salesOrders"> } : "skip",
	);
	const employees = useQuery(api.employees.list, {});
	const statusLogs = useQuery(
		api.salesOrders.getStatusLogs,
		selectedOrderId
			? { salesOrderId: selectedOrderId as Id<"salesOrders"> }
			: "skip",
	);
	const createOrder = useMutation(api.salesOrders.create);
	const updateStatus = useMutation(api.salesOrders.updateStatus);
	const deleteOrder = useMutation(api.salesOrders.remove);

	const filteredOrders = orders?.filter(
		(o) =>
			o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
			o.customer?.name.toLowerCase().includes(search.toLowerCase()),
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
				customerId: customerId as Id<"customers">,
				salesmanId: salesmanId ? (salesmanId as Id<"salesmen">) : undefined,
				items: validItems.map((item) => ({
					productId: item.productId as Id<"products">,
					quantity: Number(item.quantity),
					unitPrice: Number(item.unitPrice),
				})),
				notes: notes || undefined,
			});
			toast.success("Đã tạo đơn bán hàng thành công");
			setCreateDialogOpen(false);
			resetForm();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không thể tạo đơn");
		}
	};

	const openStatusDialog = (
		orderId: string,
		toStatus: "pending" | "delivering" | "completed" | "cancelled",
	) => {
		setPendingStatusChange({ orderId, toStatus });
		setChangedByName("");
		setStatusComment("");
		setDeliveryEmployeeId("");
		setStatusDialogOpen(true);
	};

	const handleStatusChange = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!pendingStatusChange) return;
		try {
			await updateStatus({
				id: pendingStatusChange.orderId as Id<"salesOrders">,
				status: pendingStatusChange.toStatus,
				changedByName,
				comment: statusComment || undefined,
				deliveryEmployeeId:
					deliveryEmployeeId
						? (deliveryEmployeeId as Id<"employees">)
						: undefined,
			});
			toast.success("Đã cập nhật trạng thái đơn");
			setStatusDialogOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể cập nhật trạng thái",
			);
		}
	};

	const handleDelete = async (orderId: string) => {
		try {
			await deleteOrder({ id: orderId as Id<"salesOrders"> });
			toast.success("Đã xóa đơn hàng thành công");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xóa đơn hàng",
			);
		}
	};

	const resetForm = () => {
		setCustomerId("");
		setSalesmanId("");
		setNotes("");
		setItems([initialItem]);
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

	const formatDateTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleString("vi-VN");
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "draft":
				return <Badge variant="secondary">Bản nháp</Badge>;
			case "pending":
				return <Badge variant="outline">Chờ xử lý</Badge>;
			case "delivering":
				return (
					<Badge variant="outline" className="border-blue-500 text-blue-600">
						Đang giao hàng
					</Badge>
				);
			case "completed":
				return (
					<Badge variant="default" className="bg-green-600">
						Hoàn thành
					</Badge>
				);
			case "cancelled":
				return <Badge variant="destructive">Đã hủy</Badge>;
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	const getStatusLabel = (status: string) => {
		const map: Record<string, string> = {
			draft: "Bản nháp",
			pending: "Chờ xử lý",
			delivering: "Đang giao hàng",
			completed: "Hoàn thành",
			cancelled: "Đã hủy",
		};
		return map[status] ?? status;
	};


	const viewOrderDetails = (orderId: string) => {
		setSelectedOrderId(orderId);
		setDetailDialogOpen(true);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Đơn bán hàng</h2>
					<p className="text-muted-foreground">
						Quản lý đơn bán hàng cho khách
					</p>
				</div>
				<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={resetForm}>
							<Plus className="mr-2 h-4 w-4" />
							Tạo đơn
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
						<form onSubmit={handleCreateOrder}>
							<DialogHeader>
								<DialogTitle>Tạo đơn bán hàng</DialogTitle>
								<DialogDescription>
									Tạo đơn bán hàng mới cho khách.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Khách hàng *</Label>
										<Select
											value={customerId}
											onValueChange={(v) => v && setCustomerId(v)}
											required
										>
											<SelectTrigger>
												<SelectValue placeholder="Chọn khách hàng">
													{customerId
														? (customers?.find((c) => c._id === customerId)?.name ?? "Chọn khách hàng")
														: "Chọn khách hàng"}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{customers?.map((c) => (
													<SelectItem key={c._id} value={c._id}>
														{c.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Nhân viên bán hàng *</Label>
										<Select
											value={salesmanId}
											onValueChange={(v) => v && setSalesmanId(v)}
											required
										>
											<SelectTrigger>
												<SelectValue placeholder="Chọn nhân viên">
													{salesmanId
														? (salesmen?.find((s) => s._id === salesmanId)?.name ?? "Chọn nhân viên")
														: "Chọn nhân viên"}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{salesmen?.map((s) => (
													<SelectItem key={s._id} value={s._id}>
														{s.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
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
									{/* Header labels */}
									<div className="grid grid-cols-12 gap-2 px-1">
										<div className="col-span-5 text-muted-foreground text-xs font-medium">Sản phẩm</div>
										<div className="col-span-2 text-muted-foreground text-xs font-medium">Số lượng</div>
										<div className="col-span-3 text-muted-foreground text-xs font-medium">Đơn giá</div>
										<div className="col-span-2 text-muted-foreground text-xs font-medium text-right">Thành tiền</div>
									</div>
									{items.map((item, index) => (
										<div
											key={index}
											className="space-y-1"
										>
											<div className="grid grid-cols-12 items-center gap-2">
												<div className="col-span-5">
													<Select
														value={item.productId}
														onValueChange={(v) =>
															v && handleItemChange(index, "productId", v)
														}
													>
														<SelectTrigger className="h-10">
															<SelectValue placeholder="Sản phẩm">
																{item.productId
																	? (products?.find((p) => p._id === item.productId)?.name ?? "Sản phẩm")
																	: "Sản phẩm"}
															</SelectValue>
														</SelectTrigger>
														<SelectContent>
															{products?.map((p) => (
																<SelectItem key={p._id} value={p._id}>
																	{p.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="col-span-2">
													<Input
														type="number"
														placeholder="1"
														value={item.quantity}
														onChange={(e) =>
															handleItemChange(index, "quantity", e.target.value)
														}
														className="h-10"
														min="1"
													/>
												</div>
												<div className="col-span-3">
													<Input
														type="number"
														placeholder="0"
														value={item.unitPrice}
														onChange={(e) =>
															handleItemChange(index, "unitPrice", e.target.value)
														}
														className="h-10"
														min="0"
													/>
												</div>
												<div className="col-span-2 flex items-center justify-end gap-1">
													<span className="text-sm font-medium tabular-nums">
														{item.quantity && item.unitPrice
															? formatCurrency(Number(item.quantity) * Number(item.unitPrice))
															: "—"}
													</span>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-8 w-8 shrink-0"
														onClick={() => handleRemoveItem(index)}
														disabled={items.length === 1}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</div>
											</div>
											{item.productId &&
												item.unitPrice &&
												applicableDiscounts?.[item.productId] && (
													<p className="pl-1 text-teal-700 text-xs">
														Chiết khấu:{" "}
														{applicableDiscounts[item.productId].totalPercent}
														% → Thực tế:{" "}
														{formatCurrency(
															Number(item.unitPrice) *
															(1 -
																applicableDiscounts[item.productId]
																	.totalPercent /
																100),
														)}
													</p>
												)}
										</div>
									))}
									{/* Total summary */}
									{items.some((i) => i.quantity && i.unitPrice) && (
										<div className="mt-2 rounded-md border bg-muted/40 px-4 py-3 space-y-1">
											{(() => {
												const subtotal = items.reduce(
													(sum, i) =>
														i.quantity && i.unitPrice
															? sum + Number(i.quantity) * Number(i.unitPrice)
															: sum,
													0,
												);
												const totalDiscount = items.reduce((sum, i) => {
													if (!i.productId || !i.unitPrice || !applicableDiscounts?.[i.productId]) return sum;
													const pct = applicableDiscounts[i.productId].totalPercent;
													return sum + Number(i.quantity) * Number(i.unitPrice) * (pct / 100);
												}, 0);
												const grandTotal = subtotal - totalDiscount;
												return (
													<>
														<div className="flex justify-between text-sm">
															<span className="text-muted-foreground">Tổng cộng</span>
															<span className="font-medium">{formatCurrency(subtotal)}</span>
														</div>
														{totalDiscount > 0 && (
															<div className="flex justify-between text-sm">
																<span className="text-muted-foreground">Chiết khấu</span>
																<span className="text-teal-700 font-medium">- {formatCurrency(totalDiscount)}</span>
															</div>
														)}
														<div className="flex justify-between text-sm border-t pt-1 mt-1">
															<span className="font-semibold">Thực thu</span>
															<span className="font-bold text-primary">{formatCurrency(grandTotal)}</span>
														</div>
													</>
												);
											})()}
										</div>
									)}
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
							<ClipboardList className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<p className="text-muted-foreground">
								Không tìm thấy đơn bán hàng
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Số đơn</TableHead>
									<TableHead>Khách hàng</TableHead>
									<TableHead>Nhân viên</TableHead>
									<TableHead>Ngày đặt</TableHead>
									<TableHead className="text-right">Tổng tiền</TableHead>
									<TableHead className="text-right">Chiết khấu</TableHead>
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
										<TableCell>{order.customer?.name || "-"}</TableCell>
										<TableCell>{order.salesman?.name || "-"}</TableCell>
										<TableCell>{formatDate(order.orderDate)}</TableCell>
										<TableCell className="text-right">
											{formatCurrency(order.totalAmount)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(order.totalDiscountAmount || 0)}
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
														title="Xác nhận đơn"
														onClick={() => openStatusDialog(order._id, "pending")}
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
														title="Giao hàng"
														onClick={() => openStatusDialog(order._id, "delivering")}
													>
														<Truck className="h-4 w-4 text-blue-500" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														title="Hủy đơn"
														onClick={() => openStatusDialog(order._id, "cancelled")}
													>
														<XCircle className="h-4 w-4 text-destructive" />
													</Button>
												</>
											)}
											{order.status === "delivering" && (
												<Button
													variant="ghost"
													size="icon"
													title="Hoàn thành"
													onClick={() => openStatusDialog(order._id, "completed")}
												>
													<CheckCircle className="h-4 w-4 text-green-600" />
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
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
					<DialogHeader>
						<DialogTitle>
							Chi tiết đơn - {orderDetails?.orderNumber}
						</DialogTitle>
					</DialogHeader>
					{orderDetails && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-muted-foreground text-sm">Khách hàng</p>
									<p className="font-medium">{orderDetails.customer?.name}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Trạng thái</p>
									{getStatusBadge(orderDetails.status)}
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Nhân viên bán hàng</p>
									<p className="font-medium">{orderDetails.salesman?.name || "-"}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Nhân viên giao hàng</p>
									<p className="font-medium">{orderDetails.deliveryEmployee?.name || "-"}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Ngày đặt</p>
									<p>{formatDate(orderDetails.orderDate)}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Tổng tiền</p>
									<p className="font-bold">{formatCurrency(orderDetails.totalAmount)}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Tổng chiết khấu</p>
									<p className="font-bold text-teal-700">{formatCurrency(orderDetails.totalDiscountAmount || 0)}</p>
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
											<TableHead className="text-right">Đã giao</TableHead>
											<TableHead className="text-right">Giá gốc</TableHead>
											<TableHead className="text-right">% CK</TableHead>
											<TableHead className="text-right">Chiết khấu</TableHead>
											<TableHead className="text-right">Đơn giá</TableHead>
											<TableHead className="text-right">Thành tiền</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{orderDetails.items?.map((item) => (
											<TableRow key={item._id}>
												<TableCell>{item.product?.name}</TableCell>
												<TableCell className="text-right">{item.quantity}</TableCell>
												<TableCell className="text-right">{item.fulfilledQuantity || 0}</TableCell>
												<TableCell className="text-right">{formatCurrency(item.baseUnitPrice ?? item.unitPrice)}</TableCell>
												<TableCell className="text-right">{item.discountPercent ?? 0}%</TableCell>
												<TableCell className="text-right">{formatCurrency(item.discountAmount ?? 0)}</TableCell>
												<TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
												<TableCell className="text-right">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{/* Status history timeline */}
							<div>
								<p className="mb-3 font-medium text-sm">Lịch sử trạng thái</p>
								{statusLogs === undefined ? (
									<p className="text-muted-foreground text-sm">Đang tải...</p>
								) : statusLogs.length === 0 ? (
									<p className="text-muted-foreground text-sm">Chưa có lịch sử thay đổi.</p>
								) : (
									<ol className="relative border-l border-muted-foreground/20 ml-3 space-y-4">
										{statusLogs.map((log) => (
											<li key={log._id} className="ml-4">
												<div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
												<div className="flex flex-col gap-0.5">
													<div className="flex items-center gap-2">
														{getStatusBadge(log.fromStatus)}
														<span className="text-muted-foreground text-xs">→</span>
														{getStatusBadge(log.toStatus)}
													</div>
													<p className="text-xs text-muted-foreground">
														{formatDateTime(log.createdAt)} — <span className="font-medium text-foreground">{log.changedByName}</span>
													</p>
													{log.deliveryEmployee && (
														<p className="text-xs text-muted-foreground">Giao bởi: <span className="font-medium text-foreground">{log.deliveryEmployee.name}</span></p>
													)}
													{log.comment && (
														<p className="text-xs italic text-muted-foreground">"{log.comment}"</p>
													)}
												</div>
											</li>
										))}
									</ol>
								)}
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
							Đóng
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Status Change Dialog */}
			<Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<form onSubmit={handleStatusChange}>
						<DialogHeader>
							<DialogTitle>Cập nhật trạng thái</DialogTitle>
							<DialogDescription>
								Chuyển sang:{" "}
								<strong>{getStatusLabel(pendingStatusChange?.toStatus ?? "")}</strong>
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="space-y-2">
								<Label>Người thực hiện *</Label>
								<Input
									placeholder="Nhập tên người thực hiện"
									value={changedByName}
									onChange={(e) => setChangedByName(e.target.value)}
									required
								/>
							</div>
							{pendingStatusChange?.toStatus === "delivering" && (
								<div className="space-y-2">
									<Label>Nhân viên giao hàng</Label>
									<Select
										value={deliveryEmployeeId}
										onValueChange={(v) => setDeliveryEmployeeId(v)}
									>
										<SelectTrigger>
											<SelectValue placeholder="Chọn nhân viên giao">
												{deliveryEmployeeId
													? (employees?.find((e) => e._id === deliveryEmployeeId)?.name ?? "Chọn nhân viên giao")
													: "Chọn nhân viên giao"}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{employees?.map((emp) => (
												<SelectItem key={emp._id} value={emp._id}>
													{emp.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
							<div className="space-y-2">
								<Label>Ghi chú</Label>
								<Textarea
									placeholder="Ghi chú thêm về lần thay đổi này..."
									value={statusComment}
									onChange={(e) => setStatusComment(e.target.value)}
									rows={3}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)}>Hủy</Button>
							<Button type="submit">Xác nhận</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
