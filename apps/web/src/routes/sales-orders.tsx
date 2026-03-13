import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle,
	ClipboardList,
	Eye,
	Pencil,
	Plus,
	Search,
	Trash2,
	TriangleAlert,
	Truck,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
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
	rowId: string;
	productId: string;
	quantity: string;
	unitPrice: string;
	discountPercent: string;
	hasManualDiscount: boolean;
}

let orderItemSequence = 0;

function createOrderItem(): OrderItem {
	orderItemSequence += 1;
	return {
		rowId: `order-item-${orderItemSequence}`,
		productId: "",
		quantity: "1",
		unitPrice: "",
		discountPercent: "",
		hasManualDiscount: false,
	};
}

const getMonthInputValue = (timestamp: number) => {
	const date = new Date(timestamp);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${date.getFullYear()}-${month}`;
};

function SalesOrdersPage() {
	const [search, setSearch] = useState("");
	const [monthFilter, setMonthFilter] = useState("");
	const [formDialogOpen, setFormDialogOpen] = useState(false);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
	const [selectedOrderIds, setSelectedOrderIds] = useState<Id<"salesOrders">[]>(
		[],
	);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
	const [customerId, setCustomerId] = useState("");
	const [salesmanId, setSalesmanId] = useState("");
	const [notes, setNotes] = useState("");
	const [updatedByName, setUpdatedByName] = useState("");
	const [items, setItems] = useState<OrderItem[]>(() => [createOrderItem()]);

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
	const editingOrderDetails = useQuery(
		api.salesOrders.getWithDetails,
		editingOrderId ? { id: editingOrderId as Id<"salesOrders"> } : "skip",
	);
	const employees = useQuery(api.employees.list, {});
	const statusLogs = useQuery(
		api.salesOrders.getStatusLogs,
		selectedOrderId
			? { salesOrderId: selectedOrderId as Id<"salesOrders"> }
			: "skip",
	);
	const createOrder = useMutation(api.salesOrders.create);
	const updateOrder = useMutation(api.salesOrders.update);
	const updateStatus = useMutation(api.salesOrders.updateStatus);
	const deleteOrder = useMutation(api.salesOrders.remove);
	const isEditingOrder = editingOrderId !== null;
	const editingOrderHasFulfilledItems =
		editingOrderDetails?.items.some((item) => item.fulfilledQuantity > 0) ??
		false;

	const filteredOrders = orders?.filter((order) => {
		const matchesSearch =
			order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
			(order.customer?.name ?? "").toLowerCase().includes(search.toLowerCase());
		const matchesMonth =
			!monthFilter || getMonthInputValue(order.orderDate) === monthFilter;
		return matchesSearch && matchesMonth;
	});
	const visibleOrderIds = filteredOrders?.map((order) => order._id) ?? [];
	const selectedOrders =
		filteredOrders?.filter((order) => selectedOrderIds.includes(order._id)) ??
		[];
	const allVisibleOrdersSelected =
		visibleOrderIds.length > 0 &&
		visibleOrderIds.every((id) => selectedOrderIds.includes(id));

	const handleAddItem = () => {
		setItems([...items, createOrderItem()]);
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

	useEffect(() => {
		if (!applicableDiscounts) {
			return;
		}

		setItems((currentItems) => {
			let hasChanges = false;
			const nextItems = currentItems.map((item) => {
				if (!item.productId || item.hasManualDiscount) {
					return item;
				}

				const autoDiscount = applicableDiscounts[item.productId]?.totalPercent;
				const nextDiscountPercent =
					typeof autoDiscount === "number" ? String(autoDiscount) : "";

				if (item.discountPercent === nextDiscountPercent) {
					return item;
				}

				hasChanges = true;
				return {
					...item,
					discountPercent: nextDiscountPercent,
				};
			});

			return hasChanges ? nextItems : currentItems;
		});
	}, [applicableDiscounts]);

	useEffect(() => {
		if (!editingOrderDetails || !editingOrderId) {
			return;
		}

		setCustomerId(editingOrderDetails.customerId);
		setSalesmanId(editingOrderDetails.salesmanId ?? "");
		setNotes(editingOrderDetails.notes ?? "");
		setUpdatedByName("");
		setItems(
			editingOrderDetails.items.length > 0
				? editingOrderDetails.items.map((item) => ({
						...createOrderItem(),
						productId: item.productId,
						quantity: String(item.quantity),
						unitPrice: String(item.baseUnitPrice ?? item.unitPrice),
						discountPercent:
							item.discountPercent !== undefined
								? String(item.discountPercent)
								: "",
						hasManualDiscount: item.discountPercent !== undefined,
					}))
				: [createOrderItem()],
		);
	}, [editingOrderDetails, editingOrderId]);

	useEffect(() => {
		setSelectedOrderIds((current) =>
			current.filter((id) => filteredOrders?.some((order) => order._id === id)),
		);
	}, [filteredOrders]);

	const handleOrderSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const validItems = items.filter(
				(item) => item.productId && item.quantity && item.unitPrice,
			);
			if (validItems.length === 0) {
				toast.error("Vui lòng thêm ít nhất một sản phẩm");
				return;
			}

			const payload = {
				customerId: customerId as Id<"customers">,
				salesmanId: salesmanId ? (salesmanId as Id<"salesmen">) : undefined,
				items: validItems.map((item) => ({
					productId: item.productId as Id<"products">,
					quantity: Number(item.quantity),
					unitPrice: Number(item.unitPrice),
					manualDiscountPercent:
						item.hasManualDiscount && item.discountPercent !== ""
							? Number(item.discountPercent)
							: undefined,
				})),
				notes: notes || undefined,
			};

			if (editingOrderId) {
				if (!updatedByName.trim()) {
					toast.error("Vui lòng nhập tên người sửa đơn");
					return;
				}

				await updateOrder({
					id: editingOrderId as Id<"salesOrders">,
					...payload,
					updatedByName: updatedByName.trim(),
				});
				toast.success("Đã cập nhật đơn bán hàng thành công");
			} else {
				await createOrder(payload);
				toast.success("Đã tạo đơn bán hàng thành công");
			}

			setFormDialogOpen(false);
			setEditingOrderId(null);
			resetForm();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: isEditingOrder
						? "Không thể cập nhật đơn"
						: "Không thể tạo đơn",
			);
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
				deliveryEmployeeId: deliveryEmployeeId
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
			setSelectedOrderIds((current) => current.filter((id) => id !== orderId));
			toast.success("Đã xóa đơn hàng thành công");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xóa đơn hàng",
			);
		}
	};

	const toggleOrderSelection = (
		orderId: Id<"salesOrders">,
		checked: boolean,
	) => {
		setSelectedOrderIds((current) => {
			if (checked) {
				return current.includes(orderId) ? current : [...current, orderId];
			}
			return current.filter((id) => id !== orderId);
		});
	};

	const toggleSelectAllOrders = (checked: boolean) => {
		setSelectedOrderIds((current) => {
			if (checked) {
				return Array.from(new Set([...current, ...visibleOrderIds]));
			}
			return current.filter((id) => !visibleOrderIds.includes(id));
		});
	};

	const handleBulkDelete = async () => {
		if (selectedOrderIds.length === 0) return;

		try {
			await Promise.all(selectedOrderIds.map((id) => deleteOrder({ id })));
			toast.success(`Đã xóa ${selectedOrderIds.length} đơn hàng thành công`);
			setSelectedOrderIds([]);
			setBulkDeleteDialogOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể xóa các đơn hàng đã chọn",
			);
		}
	};

	const resetForm = () => {
		setCustomerId("");
		setSalesmanId("");
		setNotes("");
		setUpdatedByName("");
		setItems([createOrderItem()]);
	};

	const handleFormDialogChange = (open: boolean) => {
		setFormDialogOpen(open);
		if (!open) {
			setEditingOrderId(null);
			resetForm();
		}
	};

	const getAutoDiscountPercent = (productId: string) => {
		if (!productId) {
			return undefined;
		}

		return applicableDiscounts?.[productId]?.totalPercent;
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

	const getEditFieldLabel = (field: string) => {
		const labels: Record<string, string> = {
			customer: "Khách hàng",
			salesman: "Nhân viên bán hàng",
			items: "Danh sách sản phẩm",
			notes: "Ghi chú",
		};

		return labels[field] ?? field;
	};

	const getHistoryValue = (value: string | undefined) => {
		return value?.trim() ? value : "Không có";
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

	const handleEditOrder = (orderId: string) => {
		setEditingOrderId(orderId);
		setFormDialogOpen(true);
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
				<Button
					onClick={() => {
						setEditingOrderId(null);
						resetForm();
						setFormDialogOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Tạo đơn
				</Button>
				<Dialog open={formDialogOpen} onOpenChange={handleFormDialogChange}>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
						{isEditingOrder && !editingOrderDetails ? (
							<div className="py-10 text-center text-muted-foreground">
								Đang tải dữ liệu đơn hàng...
							</div>
						) : (
							<form onSubmit={handleOrderSubmit}>
								<DialogHeader>
									<DialogTitle>
										{isEditingOrder ? "Sửa đơn bán hàng" : "Tạo đơn bán hàng"}
									</DialogTitle>
									<DialogDescription>
										{isEditingOrder
											? "Cập nhật thông tin đơn bán hàng hiện tại."
											: "Tạo đơn bán hàng mới cho khách."}
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									{isEditingOrder && (
										<>
											<div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
												<p className="font-medium">Thông tin chỉnh sửa</p>
												<p className="mt-1">
													{editingOrderHasFulfilledItems
														? "Đơn đã có giao hàng nên chỉ cho sửa ghi chú. Các trường cấu trúc được khóa để tránh lệch tồn kho và đối soát."
														: "Bạn có thể sửa toàn bộ thông tin đơn và hệ thống sẽ lưu lịch sử thay đổi. Ô %CK đang giữ theo giá trị hiện tại; xóa ô này nếu muốn áp dụng lại chiết khấu tự động."}
												</p>
											</div>
											<div className="space-y-2">
												<Label>Người sửa đơn *</Label>
												<Input
													value={updatedByName}
													onChange={(e) => setUpdatedByName(e.target.value)}
													placeholder="Nhập tên người sửa"
													required
												/>
											</div>
										</>
									)}
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Khách hàng *</Label>
											<Select
												value={customerId}
												onValueChange={(v) => v && setCustomerId(v)}
												required
												disabled={editingOrderHasFulfilledItems}
											>
												<SelectTrigger>
													<SelectValue placeholder="Chọn khách hàng">
														{customerId
															? (customers?.find((c) => c._id === customerId)
																	?.name ?? "Chọn khách hàng")
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
												disabled={editingOrderHasFulfilledItems}
											>
												<SelectTrigger>
													<SelectValue placeholder="Chọn nhân viên">
														{salesmanId
															? (salesmen?.find((s) => s._id === salesmanId)
																	?.name ?? "Chọn nhân viên")
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
												disabled={editingOrderHasFulfilledItems}
											>
												<Plus className="mr-1 h-4 w-4" /> Thêm sản phẩm
											</Button>
										</div>
										{/* Header labels */}
										<div className="grid grid-cols-12 gap-2 px-1">
											<div className="col-span-4 font-medium text-muted-foreground text-xs">
												Sản phẩm
											</div>
											<div className="col-span-2 font-medium text-muted-foreground text-xs">
												Số lượng
											</div>
											<div className="col-span-2 font-medium text-muted-foreground text-xs">
												Đơn giá
											</div>
											<div className="col-span-2 font-medium text-muted-foreground text-xs">
												%CK
											</div>
											<div className="col-span-2 text-right font-medium text-muted-foreground text-xs">
												Thành tiền
											</div>
										</div>
										{items.map((item, index) => (
											<div key={item.rowId} className="space-y-1">
												<div className="grid grid-cols-12 items-center gap-2">
													<div className="col-span-4">
														<Select
															value={item.productId}
															onValueChange={(v) => {
																if (!v) return;
																handleItemChange(index, "productId", v);
																// Pre-fill discount from rules when product changes
																const auto = getAutoDiscountPercent(v);
																if (
																	auto !== undefined &&
																	!items[index].hasManualDiscount
																) {
																	handleItemChange(
																		index,
																		"discountPercent",
																		String(auto),
																	);
																}
															}}
															disabled={editingOrderHasFulfilledItems}
														>
															<SelectTrigger className="h-10">
																<SelectValue placeholder="Sản phẩm">
																	{item.productId
																		? (products?.find(
																				(p) => p._id === item.productId,
																			)?.name ?? "Sản phẩm")
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
																handleItemChange(
																	index,
																	"quantity",
																	e.target.value,
																)
															}
															className="h-10"
															min="1"
															disabled={editingOrderHasFulfilledItems}
														/>
													</div>
													<div className="col-span-2">
														<Input
															type="number"
															placeholder="0"
															value={item.unitPrice}
															onChange={(e) =>
																handleItemChange(
																	index,
																	"unitPrice",
																	e.target.value,
																)
															}
															className="h-10"
															min="0"
															disabled={editingOrderHasFulfilledItems}
														/>
													</div>
													{/* Discount % input */}
													<div className="col-span-2">
														<div className="relative">
															<Input
																type="number"
																placeholder={
																	item.productId &&
																	getAutoDiscountPercent(item.productId) !==
																		undefined
																		? String(
																				getAutoDiscountPercent(item.productId),
																			)
																		: "0"
																}
																value={item.discountPercent}
																onChange={(e) => {
																	const value = e.target.value;
																	setItems((currentItems) => {
																		const nextItems = [...currentItems];
																		nextItems[index] = {
																			...nextItems[index],
																			discountPercent: value,
																			hasManualDiscount: value !== "",
																		};
																		return nextItems;
																	});
																}}
																className="h-10 pr-6"
																min="0"
																max="100"
																disabled={editingOrderHasFulfilledItems}
															/>
															<span className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground text-xs">
																%
															</span>
														</div>
													</div>
													<div className="col-span-2 flex items-center justify-end gap-1">
														{(() => {
															const qty = Number(item.quantity);
															const price = Number(item.unitPrice);
															const disc =
																item.discountPercent !== ""
																	? Number(item.discountPercent)
																	: getAutoDiscountPercent(item.productId) || 0;
															const total =
																qty && price
																	? qty * price * (1 - disc / 100)
																	: null;
															return (
																<span className="font-medium text-sm tabular-nums">
																	{total !== null ? formatCurrency(total) : "—"}
																</span>
															);
														})()}
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-8 w-8 shrink-0"
															onClick={() => handleRemoveItem(index)}
															disabled={
																items.length === 1 ||
																editingOrderHasFulfilledItems
															}
														>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</div>
												</div>
											</div>
										))}
										{/* Total summary */}
										{items.some((i) => i.quantity && i.unitPrice) && (
											<div className="mt-2 space-y-1 rounded-md border bg-muted/40 px-4 py-3">
												{(() => {
													const subtotal = items.reduce(
														(sum, i) =>
															i.quantity && i.unitPrice
																? sum + Number(i.quantity) * Number(i.unitPrice)
																: sum,
														0,
													);
													const totalDiscount = items.reduce((sum, i) => {
														if (!i.quantity || !i.unitPrice) return sum;
														const pct =
															i.discountPercent !== ""
																? Number(i.discountPercent)
																: getAutoDiscountPercent(i.productId) || 0;
														return (
															sum +
															Number(i.quantity) *
																Number(i.unitPrice) *
																(pct / 100)
														);
													}, 0);
													const grandTotal = subtotal - totalDiscount;
													return (
														<>
															<div className="flex justify-between text-sm">
																<span className="text-muted-foreground">
																	Tổng cộng
																</span>
																<span className="font-medium">
																	{formatCurrency(subtotal)}
																</span>
															</div>
															{totalDiscount > 0 && (
																<div className="flex justify-between text-sm">
																	<span className="text-muted-foreground">
																		Chiết khấu
																	</span>
																	<span className="font-medium text-teal-700">
																		- {formatCurrency(totalDiscount)}
																	</span>
																</div>
															)}
															<div className="mt-1 flex justify-between border-t pt-1 text-sm">
																<span className="font-semibold">Thực thu</span>
																<span className="font-bold text-primary">
																	{formatCurrency(grandTotal)}
																</span>
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
									<Button type="submit">
										{isEditingOrder ? "Lưu thay đổi" : "Tạo đơn"}
									</Button>
								</DialogFooter>
							</form>
						)}
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<CardTitle>Danh sách đơn hàng</CardTitle>
							<p className="mt-1 text-muted-foreground text-sm">
								Bạn có thể chọn và xóa tất cả đơn hàng đang hiển thị.
							</p>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<div className="relative w-full sm:w-64">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Tìm kiếm đơn hàng..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8"
								/>
							</div>
							<Input
								type="month"
								value={monthFilter}
								onChange={(e) => setMonthFilter(e.target.value)}
								className="w-full sm:w-44"
							/>
							{monthFilter && (
								<Button variant="outline" onClick={() => setMonthFilter("")}>
									Xóa lọc tháng
								</Button>
							)}
							<AlertDialog
								open={bulkDeleteDialogOpen}
								onOpenChange={setBulkDeleteDialogOpen}
							>
								<Button
									variant="destructive"
									disabled={selectedOrderIds.length === 0}
									onClick={() => setBulkDeleteDialogOpen(true)}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Xóa đã chọn ({selectedOrderIds.length})
								</Button>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogMedia className="bg-destructive/10 text-destructive">
											<TriangleAlert className="h-5 w-5" />
										</AlertDialogMedia>
										<AlertDialogTitle>Xóa nhiều đơn hàng</AlertDialogTitle>
										<AlertDialogDescription>
											Bạn sắp xóa {selectedOrders.length} đơn hàng đang chọn.
											Hành động này không thể hoàn tác.
										</AlertDialogDescription>
									</AlertDialogHeader>
									{selectedOrders.length > 0 && (
										<div className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
											{selectedOrders.map((order) => (
												<div
													key={order._id}
													className="flex items-center justify-between gap-3"
												>
													<span className="font-mono text-xs">
														{order.orderNumber}
													</span>
													<span className="truncate text-muted-foreground">
														{order.customer?.name || "-"}
													</span>
												</div>
											))}
										</div>
									)}
									<AlertDialogFooter>
										<AlertDialogCancel>Hủy</AlertDialogCancel>
										<AlertDialogAction
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											onClick={handleBulkDelete}
										>
											Xóa các đơn đã chọn
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
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
									<TableHead className="w-12 text-center">
										<Checkbox
											checked={allVisibleOrdersSelected}
											onCheckedChange={(checked) =>
												toggleSelectAllOrders(checked === true)
											}
											disabled={visibleOrderIds.length === 0}
											aria-label="Chọn tất cả đơn hàng hiển thị"
										/>
									</TableHead>
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
										<TableCell className="text-center">
											<Checkbox
												checked={selectedOrderIds.includes(order._id)}
												onCheckedChange={(checked) =>
													toggleOrderSelection(order._id, checked === true)
												}
												aria-label={`Chọn đơn ${order.orderNumber}`}
											/>
										</TableCell>
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
												title="Sửa đơn"
												onClick={() => handleEditOrder(order._id)}
											>
												<Pencil className="h-4 w-4 text-amber-600" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => viewOrderDetails(order._id)}
											>
												<Eye className="h-4 w-4" />
											</Button>
											{order.status === "draft" && (
												<Button
													variant="ghost"
													size="icon"
													title="Xác nhận đơn"
													onClick={() => openStatusDialog(order._id, "pending")}
												>
													<CheckCircle className="h-4 w-4 text-green-500" />
												</Button>
											)}
											{order.status === "pending" && (
												<>
													<Button
														variant="ghost"
														size="icon"
														title="Giao hàng"
														onClick={() =>
															openStatusDialog(order._id, "delivering")
														}
													>
														<Truck className="h-4 w-4 text-blue-500" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														title="Hủy đơn"
														onClick={() =>
															openStatusDialog(order._id, "cancelled")
														}
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
													onClick={() =>
														openStatusDialog(order._id, "completed")
													}
												>
													<CheckCircle className="h-4 w-4 text-green-600" />
												</Button>
											)}
											<Button
												variant="ghost"
												size="icon"
												title="Xóa đơn"
												onClick={() => handleDelete(order._id)}
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
									<p className="text-muted-foreground text-sm">
										Nhân viên bán hàng
									</p>
									<p className="font-medium">
										{orderDetails.salesman?.name || "-"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">
										Nhân viên giao hàng
									</p>
									<p className="font-medium">
										{orderDetails.deliveryEmployee?.name || "-"}
									</p>
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
								<div>
									<p className="text-muted-foreground text-sm">
										Tổng chiết khấu
									</p>
									<p className="font-bold text-teal-700">
										{formatCurrency(orderDetails.totalDiscountAmount || 0)}
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
												<TableCell className="text-right">
													{item.quantity}
												</TableCell>
												<TableCell className="text-right">
													{item.fulfilledQuantity || 0}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.baseUnitPrice ?? item.unitPrice)}
												</TableCell>
												<TableCell className="text-right">
													{item.discountPercent ?? 0}%
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.discountAmount ?? 0)}
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

							{/* Status history timeline */}
							<div>
								<p className="mb-3 font-medium text-sm">Lịch sử trạng thái</p>
								{statusLogs === undefined ? (
									<p className="text-muted-foreground text-sm">Đang tải...</p>
								) : statusLogs.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										Chưa có lịch sử thay đổi.
									</p>
								) : (
									<ol className="relative ml-3 space-y-4 border-muted-foreground/20 border-l">
										{statusLogs.map((log) => (
											<li key={log._id} className="ml-4">
												<div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
												<div className="flex flex-col gap-0.5">
													<div className="flex items-center gap-2">
														{getStatusBadge(log.fromStatus)}
														<span className="text-muted-foreground text-xs">
															→
														</span>
														{getStatusBadge(log.toStatus)}
													</div>
													<p className="text-muted-foreground text-xs">
														{formatDateTime(log.createdAt)} —{" "}
														<span className="font-medium text-foreground">
															{log.changedByName}
														</span>
													</p>
													{log.deliveryEmployee && (
														<p className="text-muted-foreground text-xs">
															Giao bởi:{" "}
															<span className="font-medium text-foreground">
																{log.deliveryEmployee.name}
															</span>
														</p>
													)}
													{log.comment && (
														<p className="text-muted-foreground text-xs italic">
															"{log.comment}"
														</p>
													)}
												</div>
											</li>
										))}
									</ol>
								)}
							</div>

							<div>
								<p className="mb-3 font-medium text-sm">Lịch sử chỉnh sửa</p>
								{orderDetails.editHistory &&
								orderDetails.editHistory.length > 0 ? (
									<div className="space-y-3">
										{[...orderDetails.editHistory]
											.sort((left, right) => right.editedAt - left.editedAt)
											.map((entry, entryIndex) => (
												<div
													key={`${entry.editedAt}-${entry.editedBy}-${entryIndex}`}
													className="rounded-lg border bg-card p-4 shadow-sm"
												>
													<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
														<div className="flex items-center gap-2">
															<Badge variant="secondary">Người sửa</Badge>
															<div className="font-medium text-sm">
																{entry.editedBy}
															</div>
														</div>
														<div className="text-muted-foreground text-xs">
															{formatDateTime(entry.editedAt)}
														</div>
													</div>
													<div className="mt-3 space-y-3">
														{entry.changes.map((change, changeIndex) => (
															<div
																key={`${change.field}-${changeIndex}`}
																className="rounded-md border bg-muted/30 p-3 text-sm"
															>
																<Badge variant="outline">
																	{getEditFieldLabel(change.field)}
																</Badge>
																<div className="mt-3 grid gap-2 sm:grid-cols-2">
																	<div className="rounded-md border border-muted-foreground/30 border-dashed bg-background p-3">
																		<div className="text-[11px] text-muted-foreground uppercase tracking-wide">
																			Từ
																		</div>
																		<div className="mt-1 whitespace-pre-wrap break-words text-xs">
																			{getHistoryValue(change.from)}
																		</div>
																	</div>
																	<div className="rounded-md border border-primary/20 bg-primary/5 p-3">
																		<div className="text-[11px] text-primary uppercase tracking-wide">
																			Thành
																		</div>
																		<div className="mt-1 whitespace-pre-wrap break-words text-xs">
																			{getHistoryValue(change.to)}
																		</div>
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Chưa có lịch sử chỉnh sửa.
									</p>
								)}
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

			{/* Status Change Dialog */}
			<Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<form onSubmit={handleStatusChange}>
						<DialogHeader>
							<DialogTitle>Cập nhật trạng thái</DialogTitle>
							<DialogDescription>
								Chuyển sang:{" "}
								<strong>
									{getStatusLabel(pendingStatusChange?.toStatus ?? "")}
								</strong>
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
										onValueChange={(v) => setDeliveryEmployeeId(v ?? "")}
									>
										<SelectTrigger>
											<SelectValue placeholder="Chọn nhân viên giao">
												{deliveryEmployeeId
													? (employees?.find(
															(e) => e._id === deliveryEmployeeId,
														)?.name ?? "Chọn nhân viên giao")
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
							<Button
								type="button"
								variant="outline"
								onClick={() => setStatusDialogOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit">Xác nhận</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
