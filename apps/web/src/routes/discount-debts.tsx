import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { History, Search, Wallet } from "lucide-react";
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

function DiscountDebtsPage() {
	const [periodKey, setPeriodKey] = useState("all");
	const [paymentStatus, setPaymentStatus] = useState("all");
	const [search, setSearch] = useState("");
	const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
	const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
	const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
	const [amount, setAmount] = useState("");
	const [paymentDate, setPaymentDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [paidBy, setPaidBy] = useState("");
	const [notes, setNotes] = useState("");

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
	const payments = useQuery(
		api.discountCalculations.getDebtPayments,
		selectedDebt
			? { debtId: selectedDebt._id as Id<"employeeDiscountDebts"> }
			: "skip",
	);
	const recordPayment = useMutation(api.discountCalculations.recordDebtPayment);

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

	const stats = useMemo(() => {
		return filteredDebts.reduce(
			(result, debt) => {
				result.totalDebt += debt.totalDebtAmount;
				result.totalPaid += debt.paidAmount;
				result.totalRemaining += debt.remainingAmount;
				return result;
			},
			{ totalDebt: 0, totalPaid: 0, totalRemaining: 0 },
		);
	}, [filteredDebts]);

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
			maximumFractionDigits: 2,
		}).format(value);

	const statusLabel = {
		unpaid: "Chưa thanh toán",
		partial: "Thanh toán một phần",
		paid: "Đã thanh toán",
	} as const;

	const openPaymentDialog = (debtId: string) => {
		setSelectedDebtId(debtId);
		setAmount("");
		setPaidBy("");
		setNotes("");
		setPaymentDate(new Date().toISOString().slice(0, 10));
		setPaymentDialogOpen(true);
	};

	const openHistoryDialog = (debtId: string) => {
		setSelectedDebtId(debtId);
		setHistoryDialogOpen(true);
	};

	const handleRecordPayment = async () => {
		if (!selectedDebt) return;

		try {
			await recordPayment({
				debtId: selectedDebt._id as Id<"employeeDiscountDebts">,
				amount: Number(amount),
				paymentDate: new Date(paymentDate).getTime(),
				paidBy,
				notes: notes.trim() || undefined,
			});
			toast.success("Đã ghi nhận thanh toán công nợ chiết khấu");
			setPaymentDialogOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể ghi nhận thanh toán",
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
									<TableHead className="text-center">Lịch sử</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredDebts.map((debt) => (
									<TableRow key={debt._id}>
										<TableCell>
											<div>
												<p className="font-medium">
													{debt.salesmanNameSnapshot}
												</p>
												<p className="text-muted-foreground text-xs">
													Lưu bởi {debt.calculation?.savedBy ?? "-"}
												</p>
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
										<TableCell className="text-center">
											{debt.paymentCount}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => openHistoryDialog(debt._id)}
												>
													<History className="mr-2 h-4 w-4" />
													Lịch sử
												</Button>
												<Button
													size="sm"
													onClick={() => openPaymentDialog(debt._id)}
													disabled={debt.remainingAmount <= 0}
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
				</CardContent>
			</Card>

			<Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>Ghi nhận thanh toán công nợ</DialogTitle>
						<DialogDescription>
							{selectedDebt?.salesmanNameSnapshot} - còn lại{" "}
							{formatCurrency(selectedDebt?.remainingAmount ?? 0)}
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
						<Button
							variant="outline"
							onClick={() => setPaymentDialogOpen(false)}
						>
							Hủy
						</Button>
						<Button onClick={handleRecordPayment}>Ghi nhận thanh toán</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
				<DialogContent className="sm:max-w-[640px]">
					<DialogHeader>
						<DialogTitle>Lịch sử thanh toán</DialogTitle>
						<DialogDescription>
							{selectedDebt?.salesmanNameSnapshot} - kỳ{" "}
							{selectedDebt?.periodKey}
						</DialogDescription>
					</DialogHeader>
					{payments === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải lịch sử...
						</div>
					) : payments.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Chưa có thanh toán nào.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Ngày</TableHead>
									<TableHead className="text-right">Số tiền</TableHead>
									<TableHead>Người thực hiện</TableHead>
									<TableHead>Ghi chú</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{payments.map((payment) => (
									<TableRow key={payment._id}>
										<TableCell>
											{new Date(payment.paymentDate).toLocaleDateString(
												"vi-VN",
											)}
										</TableCell>
										<TableCell className="text-right font-medium text-teal-700">
											{formatCurrency(payment.amount)}
										</TableCell>
										<TableCell>{payment.paidBy}</TableCell>
										<TableCell>{payment.notes ?? "-"}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
