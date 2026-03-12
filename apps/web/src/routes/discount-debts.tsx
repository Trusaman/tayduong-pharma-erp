import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FileText, History, Pencil, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
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

export const Route = createFileRoute("/discount-debts")({
	component: DiscountDebtsPage,
});

const discountBadgeLabels = {
	Doctor: "BS",
	hospital: "NT, KD",
	payment: "Thanh toán",
	CTV: "CTV",
	Salesman: "NT, KD",
	Manager: "Quản lý",
} as const;

type DiscountTypeKey = keyof typeof discountBadgeLabels;

type DebtOrderDetail = {
	salesOrderId: Id<"salesOrders">;
	orderNumber: string;
	orderDate: number;
	completedAt: number;
	customerNameSnapshot: string;
	totalDiscountAmount: number;
	paidAmount: number;
	remainingAmount: number;
	paymentCount: number;
	paymentStatus: "unpaid" | "partial" | "paid";
	lastPaidAt?: number;
	latestPayment: {
		amount: number;
		paymentDate: number;
		paidBy: string;
		createdAt: number;
		updatedAt?: number;
	} | null;
	byType: Record<DiscountTypeKey, number>;
	entryDetails: Array<{
		salesOrderItemId: Id<"salesOrderItems">;
		productNameSnapshot: string;
		quantity: number;
		discountType: DiscountTypeKey;
		ruleName: string;
		allocatedPercent: number;
		discountAmount: number;
	}>;
};

type DebtOrderPayment = {
	_id: Id<"employeeDiscountDebtOrderPayments">;
	amount: number;
	paymentDate: number;
	paidBy: string;
	notes?: string;
	createdAt: number;
	updatedAt?: number;
};

function DiscountDebtsPage() {
	const [periodKey, setPeriodKey] = useState("all");
	const [paymentStatus, setPaymentStatus] = useState("all");
	const [search, setSearch] = useState("");
	const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
	const [paymentHistoryDialogOpen, setPaymentHistoryDialogOpen] =
		useState(false);
	const [amount, setAmount] = useState("");
	const [paymentDate, setPaymentDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [paidBy, setPaidBy] = useState("");
	const [notes, setNotes] = useState("");

	const currentUser = useQuery(api.auth.getCurrentUser);
	const savedMonths = useQuery(api.discountCalculations.listSavedMonths, {});
	const debts = useQuery(api.discountCalculations.listDebts, {
		periodKey: periodKey === "all" ? undefined : periodKey,
		paymentStatus:
			paymentStatus === "all"
				? undefined
				: (paymentStatus as "unpaid" | "partial" | "paid"),
	});
	const selectedDebt =
		debts?.find((debt) => debt._id === selectedDebtId) ?? null;
	const debtOrderDetails = useQuery(
		api.discountCalculations.getDebtOrderDetails,
		selectedDebt
			? { debtId: selectedDebt._id as Id<"employeeDiscountDebts"> }
			: "skip",
	);
	const selectedOrder =
		debtOrderDetails?.orders.find(
			(order: DebtOrderDetail) =>
				String(order.salesOrderId) === selectedOrderId,
		) ?? null;
	const orderPayments = useQuery(
		api.discountCalculations.getDebtOrderPaymentHistory,
		selectedDebt && selectedOrder
			? {
					debtId: selectedDebt._id as Id<"employeeDiscountDebts">,
					salesOrderId: selectedOrder.salesOrderId,
				}
			: "skip",
	);
	const recordDebtOrderPayment = useMutation(
		api.discountCalculations.recordDebtOrderPayment,
	);
	const updateDebtOrderPayment = useMutation(
		api.discountCalculations.updateDebtOrderPayment,
	);

	const filteredDebts = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		if (!debts) return [];
		if (!keyword) return debts;

		return debts.filter((debt) =>
			[debt.salesmanNameSnapshot, debt.periodKey].some((value) =>
				value.toLowerCase().includes(keyword),
			),
		);
	}, [debts, search]);

	const stats = useMemo(
		() =>
			filteredDebts.reduce(
				(result, debt) => {
					result.totalDebt += debt.totalDebtAmount;
					result.totalPaid += debt.paidAmount;
					result.totalRemaining += debt.remainingAmount;
					return result;
				},
				{ totalDebt: 0, totalPaid: 0, totalRemaining: 0 },
			),
		[filteredDebts],
	);

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
			maximumFractionDigits: 2,
		}).format(value);

	const formatDateTime = (timestamp: number) =>
		new Date(timestamp).toLocaleString("vi-VN");

	const formatDateInputValue = (timestamp: number) => {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	const statusLabel = {
		unpaid: "Chưa thanh toán",
		partial: "Thanh toán một phần",
		paid: "Đã thanh toán",
	} as const;

	const canManageOrderPayments =
		(debtOrderDetails?.legacyPaymentCount ?? 0) === 0;

	const openDebtDetailDialog = (debtId: string) => {
		setSelectedDebtId(debtId);
		setSelectedOrderId(null);
		setEditingPaymentId(null);
		setDetailDialogOpen(true);
	};

	const openOrderPaymentDialog = (
		debtId: string | null,
		order: DebtOrderDetail,
	) => {
		if (!debtId) return;

		setSelectedDebtId(debtId);
		setSelectedOrderId(String(order.salesOrderId));
		setEditingPaymentId(null);
		setAmount("");
		setPaidBy(currentUser?.name ?? currentUser?.email ?? "");
		setNotes("");
		setPaymentDate(new Date().toISOString().slice(0, 10));
		setPaymentDialogOpen(true);
	};

	const openPaymentHistoryDialog = (
		debtId: string | null,
		order: DebtOrderDetail,
	) => {
		if (!debtId) return;

		setSelectedDebtId(debtId);
		setSelectedOrderId(String(order.salesOrderId));
		setPaymentHistoryDialogOpen(true);
	};

	const openEditOrderPaymentDialog = (payment: DebtOrderPayment) => {
		setEditingPaymentId(payment._id);
		setAmount(String(payment.amount));
		setPaidBy(payment.paidBy);
		setNotes(payment.notes ?? "");
		setPaymentDate(formatDateInputValue(payment.paymentDate));
		setPaymentHistoryDialogOpen(false);
		setPaymentDialogOpen(true);
	};

	const closePaymentDialog = () => {
		setPaymentDialogOpen(false);
		setEditingPaymentId(null);
	};

	const handleSubmitOrderPayment = async () => {
		if (!selectedDebt || !selectedOrder) return;

		try {
			if (editingPaymentId) {
				await updateDebtOrderPayment({
					paymentId:
						editingPaymentId as Id<"employeeDiscountDebtOrderPayments">,
					amount: Number(amount),
					paymentDate: new Date(paymentDate).getTime(),
					paidBy,
					notes: notes.trim() || undefined,
				});
				toast.success(
					`Đã cập nhật thanh toán cho đơn ${selectedOrder.orderNumber}`,
				);
			} else {
				await recordDebtOrderPayment({
					debtId: selectedDebt._id as Id<"employeeDiscountDebts">,
					salesOrderId: selectedOrder.salesOrderId,
					amount: Number(amount),
					paymentDate: new Date(paymentDate).getTime(),
					paidBy,
					notes: notes.trim() || undefined,
				});
				toast.success(
					`Đã ghi nhận thanh toán cho đơn ${selectedOrder.orderNumber}`,
				);
			}

			closePaymentDialog();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: editingPaymentId
						? "Không thể cập nhật thanh toán theo đơn"
						: "Không thể ghi nhận thanh toán theo đơn",
			);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">
						Công nợ chiết khấu
					</h2>
					<p className="text-muted-foreground">
						Theo dõi số phải chi, đã thanh toán và công nợ còn lại của từng
						người nhận.
					</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-3">
					<Select
						value={periodKey}
						onValueChange={(value) => value && setPeriodKey(value)}
					>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Tất cả kỳ</SelectItem>
							{savedMonths?.map((month) => (
								<SelectItem key={month._id} value={month.periodKey}>
									{month.periodKey}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={paymentStatus}
						onValueChange={(value) => value && setPaymentStatus(value)}
					>
						<SelectTrigger className="w-full sm:w-[200px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Tất cả trạng thái</SelectItem>
							<SelectItem value="unpaid">Chưa thanh toán</SelectItem>
							<SelectItem value="partial">Thanh toán một phần</SelectItem>
							<SelectItem value="paid">Đã thanh toán</SelectItem>
						</SelectContent>
					</Select>
					<div className="relative w-full sm:w-[240px]">
						<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Tìm người nhận hoặc kỳ..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="pl-8"
						/>
					</div>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				{[
					{ label: "Tổng phải chi", value: formatCurrency(stats.totalDebt) },
					{ label: "Đã thanh toán", value: formatCurrency(stats.totalPaid) },
					{ label: "Còn lại", value: formatCurrency(stats.totalRemaining) },
				].map((stat) => (
					<Card key={stat.label}>
						<CardContent className="p-4">
							<p className="text-muted-foreground text-xs">{stat.label}</p>
							<p className="mt-1 font-bold text-2xl">{stat.value}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Danh sách công nợ</CardTitle>
				</CardHeader>
				<CardContent>
					{debts === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải công nợ...
						</div>
					) : filteredDebts.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Chưa có bản ghi công nợ chiết khấu.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Người nhận</TableHead>
									<TableHead>Kỳ</TableHead>
									<TableHead className="text-right">Tổng nợ</TableHead>
									<TableHead className="text-right">Đã trả</TableHead>
									<TableHead className="text-right">Còn lại</TableHead>
									<TableHead className="text-center">Trạng thái</TableHead>
									<TableHead>Chi tiết thanh toán</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredDebts.map((debt) => (
									<TableRow
										key={debt._id}
										onClick={() => openDebtDetailDialog(debt._id)}
										className="cursor-pointer"
									>
										<TableCell>
											<div>
												<p className="font-medium">
													{debt.salesmanNameSnapshot}
												</p>
												<p className="text-muted-foreground text-xs">
													Lưu bởi {debt.calculation?.savedBy ?? "-"}
												</p>
												{debt.legacyPaymentCount > 0 ? (
													<p className="text-amber-700 text-xs">
														Có {debt.legacyPaymentCount} thanh toán cũ cần tạo
														lại snapshot
													</p>
												) : null}
											</div>
										</TableCell>
										<TableCell>{debt.periodKey}</TableCell>
										<TableCell className="text-right">
											{formatCurrency(debt.totalDebtAmount)}
										</TableCell>
										<TableCell className="text-right text-teal-700">
											{formatCurrency(debt.paidAmount)}
										</TableCell>
										<TableCell className="text-right font-semibold text-rose-600">
											{formatCurrency(debt.remainingAmount)}
										</TableCell>
										<TableCell className="text-center">
											<Badge
												variant={
													debt.paymentStatus === "paid"
														? "default"
														: debt.paymentStatus === "partial"
															? "secondary"
															: "outline"
												}
											>
												{statusLabel[debt.paymentStatus]}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="text-sm">
												<p className="font-medium">{debt.paymentCount} lần</p>
												<p className="text-muted-foreground text-xs">
													{debt.latestPayment
														? `Gần nhất ${new Date(debt.latestPayment.paymentDate).toLocaleDateString("vi-VN")} - ${formatCurrency(debt.latestPayment.amount)}`
														: "Chưa có thanh toán"}
												</p>
											</div>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="outline"
												size="sm"
												onClick={(event) => {
													event.stopPropagation();
													openDebtDetailDialog(debt._id);
												}}
											>
												<FileText className="mr-2 h-4 w-4" />
												Chi tiết
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
				<DialogContent className="sm:max-w-[1100px]">
					<DialogHeader>
						<DialogTitle>Chi tiết công nợ theo đơn hàng</DialogTitle>
						<DialogDescription>
							{selectedDebt?.salesmanNameSnapshot} - kỳ{" "}
							{selectedDebt?.periodKey}
						</DialogDescription>
					</DialogHeader>
					{debtOrderDetails === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải chi tiết công nợ...
						</div>
					) : (
						<div className="space-y-4">
							{debtOrderDetails.legacyPaymentCount > 0 ? (
								<Card className="border-amber-200 bg-amber-50/70">
									<CardContent className="space-y-1 p-4 text-sm">
										<p className="font-medium text-amber-700">
											Snapshot này đang có {debtOrderDetails.legacyPaymentCount}{" "}
											thanh toán cũ theo người nhận.
										</p>
										<p className="text-muted-foreground">
											Tổng đã thanh toán kiểu cũ:{" "}
											{formatCurrency(debtOrderDetails.legacyPaidAmount)}. Để
											chuyển sang thanh toán theo từng đơn, hãy xóa công nợ
											tháng và lưu lại bảng mới sau khi tính lại.
										</p>
									</CardContent>
								</Card>
							) : null}

							<div className="grid gap-3 md:grid-cols-4">
								{[
									{ label: "Số đơn", value: debtOrderDetails.orders.length },
									{
										label: "Tổng phải chi",
										value: formatCurrency(selectedDebt?.totalDebtAmount ?? 0),
									},
									{
										label: "Đã thanh toán",
										value: formatCurrency(selectedDebt?.paidAmount ?? 0),
									},
									{
										label: "Còn lại",
										value: formatCurrency(selectedDebt?.remainingAmount ?? 0),
									},
								].map((item) => (
									<Card key={item.label}>
										<CardContent className="p-3">
											<p className="text-muted-foreground text-xs">
												{item.label}
											</p>
											<p className="mt-1 font-semibold">{item.value}</p>
										</CardContent>
									</Card>
								))}
							</div>

							{debtOrderDetails.orders.length === 0 ? (
								<div className="py-8 text-center text-muted-foreground">
									Snapshot này chưa có đơn hàng chiết khấu.
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Đơn hàng</TableHead>
											<TableHead>Chi tiết chiết khấu</TableHead>
											<TableHead className="text-right">Tổng CK</TableHead>
											<TableHead className="text-right">Đã trả</TableHead>
											<TableHead className="text-right">Còn lại</TableHead>
											<TableHead className="text-center">Trạng thái</TableHead>
											<TableHead className="text-center">Lịch sử</TableHead>
											<TableHead className="text-right">Thao tác</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{debtOrderDetails.orders.map((order: DebtOrderDetail) => (
											<TableRow key={order.salesOrderId}>
												<TableCell>
													<div>
														<p className="font-medium">{order.orderNumber}</p>
														<p className="text-muted-foreground text-xs">
															{order.customerNameSnapshot} - hoàn thành{" "}
															{new Date(order.completedAt).toLocaleDateString(
																"vi-VN",
															)}
														</p>
														{order.latestPayment ? (
															<p className="text-muted-foreground text-xs">
																Thanh toán gần nhất{" "}
																{new Date(
																	order.latestPayment.paymentDate,
																).toLocaleDateString("vi-VN")}{" "}
																- {formatCurrency(order.latestPayment.amount)}
															</p>
														) : null}
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-2">
														<div className="flex flex-wrap gap-2">
															{Object.entries(order.byType)
																.filter(([, value]) => value > 0)
																.map(([type, value]) => (
																	<Badge
																		key={`${order.salesOrderId}-${type}`}
																		variant="outline"
																	>
																		{
																			discountBadgeLabels[
																				type as DiscountTypeKey
																			]
																		}
																		: {formatCurrency(value)}
																	</Badge>
																))}
														</div>
														<div className="space-y-1 text-xs">
															{order.entryDetails.map((entry) => (
																<p
																	key={entry.salesOrderItemId}
																	className="text-muted-foreground"
																>
																	{entry.productNameSnapshot} x{entry.quantity}{" "}
																	- {discountBadgeLabels[entry.discountType]}{" "}
																	{entry.allocatedPercent}% (
																	{formatCurrency(entry.discountAmount)})
																</p>
															))}
														</div>
													</div>
												</TableCell>
												<TableCell className="text-right font-medium text-teal-700">
													{formatCurrency(order.totalDiscountAmount)}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(order.paidAmount)}
												</TableCell>
												<TableCell className="text-right font-semibold text-rose-600">
													{formatCurrency(order.remainingAmount)}
												</TableCell>
												<TableCell className="text-center">
													<Badge
														variant={
															order.paymentStatus === "paid"
																? "default"
																: order.paymentStatus === "partial"
																	? "secondary"
																	: "outline"
														}
													>
														{statusLabel[order.paymentStatus]}
													</Badge>
												</TableCell>
												<TableCell className="text-center">
													{order.paymentCount}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																openPaymentHistoryDialog(
																	selectedDebt?._id ?? null,
																	order,
																)
															}
														>
															<History className="mr-2 h-4 w-4" />
															Lịch sử TT
														</Button>
														<Button
															size="sm"
															disabled={
																!canManageOrderPayments ||
																order.remainingAmount <= 0
															}
															onClick={() =>
																openOrderPaymentDialog(
																	selectedDebt?._id ?? null,
																	order,
																)
															}
														>
															<Wallet className="mr-2 h-4 w-4" />
															Thanh toán
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>

			<Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>
							{editingPaymentId
								? "Sửa thanh toán theo đơn"
								: "Thanh toán theo đơn"}
						</DialogTitle>
						<DialogDescription>
							{selectedOrder?.orderNumber} - còn lại{" "}
							{formatCurrency(selectedOrder?.remainingAmount ?? 0)}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Số tiền thanh toán *</Label>
								<Input
									type="number"
									min="0"
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Ngày thanh toán *</Label>
								<Input
									type="date"
									value={paymentDate}
									onChange={(event) => setPaymentDate(event.target.value)}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Người thực hiện *</Label>
							<Input
								value={paidBy}
								onChange={(event) => setPaidBy(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Ghi chú</Label>
							<Textarea
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closePaymentDialog}>
							Hủy
						</Button>
						<Button onClick={handleSubmitOrderPayment}>
							{editingPaymentId ? "Lưu thay đổi" : "Ghi nhận thanh toán"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={paymentHistoryDialogOpen}
				onOpenChange={setPaymentHistoryDialogOpen}
			>
				<DialogContent className="sm:max-w-[760px]">
					<DialogHeader>
						<DialogTitle>Lịch sử thanh toán theo đơn</DialogTitle>
						<DialogDescription>
							{selectedOrder?.orderNumber} -{" "}
							{selectedOrder?.customerNameSnapshot}
						</DialogDescription>
					</DialogHeader>
					{orderPayments === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải lịch sử thanh toán...
						</div>
					) : orderPayments.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Đơn này chưa có thanh toán nào.
						</div>
					) : (
						<div className="space-y-4">
							<div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-3">
								<div>
									<p className="text-muted-foreground text-xs">
										Số lần thanh toán
									</p>
									<p className="font-semibold">{orderPayments.length}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Đã thanh toán</p>
									<p className="font-semibold text-teal-700">
										{formatCurrency(selectedOrder?.paidAmount ?? 0)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Còn lại</p>
									<p className="font-semibold text-rose-600">
										{formatCurrency(selectedOrder?.remainingAmount ?? 0)}
									</p>
								</div>
							</div>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Ngày</TableHead>
										<TableHead className="text-right">Số tiền</TableHead>
										<TableHead>Người thực hiện</TableHead>
										<TableHead>Ghi chú</TableHead>
										<TableHead>Chi tiết</TableHead>
										<TableHead className="text-right">Thao tác</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{orderPayments.map((payment: DebtOrderPayment) => (
										<TableRow key={payment._id}>
											<TableCell>
												<div>
													<p>
														{new Date(payment.paymentDate).toLocaleDateString(
															"vi-VN",
														)}
													</p>
													<p className="text-muted-foreground text-xs">
														Ghi nhận {formatDateTime(payment.createdAt)}
													</p>
												</div>
											</TableCell>
											<TableCell className="text-right font-medium text-teal-700">
												{formatCurrency(payment.amount)}
											</TableCell>
											<TableCell>{payment.paidBy}</TableCell>
											<TableCell>{payment.notes ?? "-"}</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{payment.updatedAt
													? `Cập nhật ${formatDateTime(payment.updatedAt)}`
													: "Bản gốc"}
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="outline"
													size="sm"
													disabled={!canManageOrderPayments}
													onClick={() => openEditOrderPaymentDialog(payment)}
												>
													<Pencil className="mr-2 h-4 w-4" />
													Sửa
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
