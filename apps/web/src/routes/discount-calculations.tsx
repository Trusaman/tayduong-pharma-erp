import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Calculator, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
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
} from "@/components/ui/alert-dialog";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/discount-calculations")({
	component: DiscountCalculationsPage,
});

const discountColumnGroups = [
	{
		key: "doctor",
		label: "Chiết khấu BS",
		entryTypes: ["Doctor"],
	},
	{
		key: "sales",
		label: "Chiết khấu NT, KD",
		entryTypes: ["hospital", "Salesman"],
	},
	{
		key: "payment",
		label: "Chiết khấu thanh toán",
		entryTypes: ["payment"],
	},
	{
		key: "ctv",
		label: "Chiết khấu CTV",
		entryTypes: ["CTV"],
	},
	{
		key: "manager",
		label: "Chiết khấu Quản lý",
		entryTypes: ["Manager"],
	},
] as const;

const discountBadgeLabels = {
	Doctor: "BS",
	hospital: "NT, KD",
	payment: "Thanh toán",
	CTV: "CTV",
	Salesman: "NT, KD",
	Manager: "Quản lý",
} as const;

type DiscountColumnGroupKey = (typeof discountColumnGroups)[number]["key"];

type GroupedDiscountCell = {
	recipients: string[];
	percents: number[];
	amount: number;
};

type GroupedOrderRow = {
	key: string;
	completedAt: number;
	orderNumber: string;
	customerName: string;
	revenueAmount: number;
	totalDiscountAmount: number;
	columns: Record<DiscountColumnGroupKey, GroupedDiscountCell>;
	searchIndex: string;
};

const discountColumnKeyByType = {
	Doctor: "doctor",
	hospital: "sales",
	payment: "payment",
	CTV: "ctv",
	Salesman: "sales",
	Manager: "manager",
} as const;

function createEmptyDiscountColumns(): Record<
	DiscountColumnGroupKey,
	GroupedDiscountCell
> {
	return {
		doctor: { recipients: [], percents: [], amount: 0 },
		sales: { recipients: [], percents: [], amount: 0 },
		payment: { recipients: [], percents: [], amount: 0 },
		ctv: { recipients: [], percents: [], amount: 0 },
		manager: { recipients: [], percents: [], amount: 0 },
	};
}

function addUniqueString(values: string[], value: string) {
	if (!value || values.includes(value)) {
		return;
	}

	values.push(value);
}

function addUniqueNumber(values: number[], value: number) {
	if (values.some((current) => Math.abs(current - value) < 0.001)) {
		return;
	}

	values.push(value);
}

function getCurrentMonthValue() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function DiscountCalculationsPage() {
	const [period, setPeriod] = useState(getCurrentMonthValue);
	const [search, setSearch] = useState("");
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [savedBy, setSavedBy] = useState("");
	const [notes, setNotes] = useState("");
	const [isRecalculating, setIsRecalculating] = useState(false);
	const [recalculateDialogOpen, setRecalculateDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const [yearText, monthText] = period.split("-");
	const year = Number(yearText);
	const month = Number(monthText);

	const preview = useQuery(api.discountCalculations.previewMonthly, {
		month,
		year,
	});
	const currentUser = useQuery(api.auth.getCurrentUser);
	const repairMonthlySourceOrders = useMutation(
		api.discountCalculations.repairMonthlySourceOrders,
	);
	const deleteMonthlyCalculation = useMutation(
		api.discountCalculations.deleteMonthlyCalculation,
	);
	const saveMonthly = useMutation(api.discountCalculations.saveMonthly);

	const groupedRows = useMemo(() => {
		if (!preview?.entries) return [];

		const rows = new Map<
			string,
			Omit<GroupedOrderRow, "searchIndex"> & { itemIds: Set<string> }
		>();

		for (const entry of preview.entries) {
			const rowKey = String(entry.salesOrderId);
			const columnKey = discountColumnKeyByType[entry.discountType];
			const existing = rows.get(rowKey);

			if (existing) {
				existing.completedAt = Math.max(
					existing.completedAt,
					entry.completedAt,
				);

				if (!existing.itemIds.has(String(entry.salesOrderItemId))) {
					existing.revenueAmount += entry.revenueAmount;
					existing.itemIds.add(String(entry.salesOrderItemId));
				}

				existing.totalDiscountAmount += entry.discountAmount;

				const cell = existing.columns[columnKey];
				addUniqueString(cell.recipients, entry.salesmanName);
				addUniqueNumber(cell.percents, entry.allocatedPercent);
				cell.amount += entry.discountAmount;
				continue;
			}

			const columns = createEmptyDiscountColumns();
			columns[columnKey] = {
				recipients: [entry.salesmanName],
				percents: [entry.allocatedPercent],
				amount: entry.discountAmount,
			};

			rows.set(rowKey, {
				key: rowKey,
				completedAt: entry.completedAt,
				orderNumber: entry.orderNumber,
				customerName: entry.customerName,
				revenueAmount: entry.revenueAmount,
				totalDiscountAmount: entry.discountAmount,
				columns,
				itemIds: new Set([String(entry.salesOrderItemId)]),
			});
		}

		return Array.from(rows.values())
			.map((row) => ({
				...row,
				revenueAmount: Number(row.revenueAmount.toFixed(2)),
				totalDiscountAmount: Number(row.totalDiscountAmount.toFixed(2)),
				columns: Object.fromEntries(
					Object.entries(row.columns).map(([key, cell]) => [
						key,
						{
							...cell,
							amount: Number(cell.amount.toFixed(2)),
							percents: [...cell.percents].sort((left, right) => left - right),
							recipients: [...cell.recipients].sort((left, right) =>
								left.localeCompare(right, "vi"),
							),
						},
					]),
				) as Record<DiscountColumnGroupKey, GroupedDiscountCell>,
				searchIndex: [
					row.orderNumber,
					row.customerName,
					...discountColumnGroups.flatMap((group) => {
						const cell = row.columns[group.key];
						return [
							...cell.recipients,
							...cell.percents.map((percent) => String(percent)),
						];
					}),
				]
					.join(" ")
					.toLowerCase(),
			}))
			.sort((left, right) => {
				if (right.completedAt !== left.completedAt) {
					return right.completedAt - left.completedAt;
				}

				return right.totalDiscountAmount - left.totalDiscountAmount;
			});
	}, [preview?.entries]);

	const filteredRows = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		if (!keyword) return groupedRows;

		return groupedRows.filter((row) => row.searchIndex.includes(keyword));
	}, [groupedRows, search]);

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
			maximumFractionDigits: 2,
		}).format(amount);

	const formatDate = (timestamp: number) =>
		new Date(timestamp).toLocaleDateString("vi-VN");

	const formatDateTime = (timestamp: number) =>
		new Date(timestamp).toLocaleString("vi-VN");

	const formatPercentList = (percents: number[]) => {
		if (percents.length === 0) return "-";

		return percents
			.map(
				(percent) =>
					`${percent.toLocaleString("vi-VN", {
						maximumFractionDigits: 2,
					})}%`,
			)
			.join(" / ");
	};

	const formatRecipientList = (recipients: string[]) => {
		if (recipients.length === 0) return "-";
		return recipients.join(", ");
	};

	const handleSave = async () => {
		try {
			const result = await saveMonthly({
				month,
				year,
				savedBy,
				notes: notes.trim() || undefined,
			});
			toast.success(
				`Đã lưu bảng tính ${result.periodKey} cho ${result.recipientCount} người nhận`,
			);
			setSaveDialogOpen(false);
			setSavedBy("");
			setNotes("");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể lưu bảng tính tháng",
			);
		}
	};

	const handleRecalculate = async () => {
		setRecalculateDialogOpen(false);
		setIsRecalculating(true);

		try {
			const result = await repairMonthlySourceOrders({
				month,
				year,
				recalculatedBy:
					currentUser?.name?.trim() || currentUser?.email?.trim() || "Không rõ",
			});
			const existingCalculationNotice = preview?.existingCalculation
				? " Bảng tháng đã lưu chưa tự cập nhật, hãy lưu lại nếu cần chốt số mới."
				: "";

			if (result.repairedOrderCount === 0) {
				toast.success(
					`Đã rà ${result.completedOrderCount} đơn trong kỳ ${result.periodKey} nhưng không có đơn nào cần cập nhật.${existingCalculationNotice}`,
				);
				return;
			}

			toast.success(
				`${result.recalculatedBy} đã tính lại ${result.repairedOrderCount} đơn và ${result.repairedItemCount} dòng chiết khấu trong kỳ ${result.periodKey}.${existingCalculationNotice}`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể tính lại chiết khấu cho các đơn hoàn thành",
			);
		} finally {
			setIsRecalculating(false);
		}
	};

	const handleDeleteMonthlyCalculation = async () => {
		if (!preview?.existingCalculation) return;

		try {
			const result = await deleteMonthlyCalculation({
				calculationId: preview.existingCalculation._id,
			});
			toast.success(`Đã xóa bảng công nợ tháng ${result.periodKey}`);
			setDeleteDialogOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể xóa bảng công nợ tháng",
			);
		}
	};

	const existingCalculationDebtCount =
		preview?.existingCalculationSummary?.debtCount ?? 0;
	const existingCalculationPaymentCount =
		preview?.existingCalculationSummary?.totalPaymentCount ?? 0;

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Tính chiết khấu</h2>
					<p className="text-muted-foreground">
						Tính chi tiết chiết khấu theo từng đơn hoàn thành và lưu bảng chốt
						tháng.
					</p>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						type="month"
						value={period}
						onChange={(event) => setPeriod(event.target.value)}
						className="w-full sm:w-[180px]"
					/>
					<Button
						variant="outline"
						onClick={() => setRecalculateDialogOpen(true)}
						disabled={preview === undefined || isRecalculating}
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`}
						/>
						Tính lại chiết khấu
					</Button>
					<Button
						onClick={() => setSaveDialogOpen(true)}
						disabled={
							preview === undefined ||
							isRecalculating ||
							preview.entries.length === 0 ||
							preview.totals.unassignedTotalAmount > 0
						}
					>
						<Save className="mr-2 h-4 w-4" />
						Lưu bảng tháng
					</Button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[
					{
						label: "Đơn hoàn thành trong kỳ",
						value: preview?.totals.completedOrderCount ?? 0,
					},
					{
						label: "Đơn có chiết khấu",
						value: preview?.totals.discountedOrderCount ?? 0,
					},
					{
						label: "Người nhận chiết khấu",
						value: preview?.totals.recipientCount ?? 0,
					},
					{
						label: "Tổng chiết khấu cần chi",
						value: formatCurrency(preview?.totals.totalDiscountAmount ?? 0),
					},
				].map((stat) => (
					<Card key={stat.label}>
						<CardContent className="p-4">
							<p className="text-muted-foreground text-xs">{stat.label}</p>
							<p className="mt-1 font-bold text-2xl">{stat.value}</p>
						</CardContent>
					</Card>
				))}
			</div>

			{preview?.existingCalculation ? (
				<Card className="border-teal-200 bg-teal-50/60">
					<CardContent className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-center md:justify-between">
						<div>
							<p className="font-medium text-teal-700">
								Tháng này đã có bảng tính lưu
							</p>
							<p className="text-muted-foreground">
								Người lưu: {preview.existingCalculation.savedBy} - Cập nhật lúc{" "}
								{new Date(preview.existingCalculation.updatedAt).toLocaleString(
									"vi-VN",
								)}
							</p>
							<p className="text-muted-foreground text-xs">
								{existingCalculationDebtCount} công nợ,{" "}
								{existingCalculationPaymentCount} thanh toán đã ghi nhận
							</p>
						</div>
						<div className="flex items-center gap-2 self-start md:self-auto">
							<Badge variant="secondary">
								{preview.existingCalculation.periodKey}
							</Badge>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setDeleteDialogOpen(true)}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Xóa công nợ theo tháng
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			{preview && preview.recentRecalculations.length > 0 ? (
				<Card className="border-slate-200 bg-slate-50/70">
					<CardHeader>
						<CardTitle>Lịch sử tính lại gần đây</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						{preview.recentRecalculations.map((log) => (
							<div
								key={log._id}
								className="flex flex-col gap-1 rounded-md border bg-background/70 p-3 md:flex-row md:items-center md:justify-between"
							>
								<div>
									<p className="font-medium text-foreground">
										{log.recalculatedBy} - {formatDateTime(log.createdAt)}
									</p>
									<p className="text-muted-foreground">
										Da ra {log.completedOrderCount} don, cap nhat{" "}
										{log.repairedOrderCount} don / {log.repairedItemCount} dong.
									</p>
								</div>
								<Badge variant="outline">{log.periodKey}</Badge>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			{preview && preview.totals.unassignedTotalAmount > 0 ? (
				<Card className="border-amber-200 bg-amber-50/70">
					<CardContent className="space-y-2 p-4 text-sm">
						<p className="font-medium text-amber-700">
							Có {preview.totals.unassignedEntryCount} dòng chiết khấu chưa xác
							định người nhận.
						</p>
						<p className="text-muted-foreground">
							Tổng giá trị chưa thể chốt công nợ:{" "}
							{formatCurrency(preview.totals.unassignedTotalAmount)}. Hãy kiểm
							tra lại cấu hình chiết khấu hoặc các đơn có giảm giá tay trước khi
							lưu bảng tháng.
						</p>
					</CardContent>
				</Card>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>Tổng hợp theo người nhận</CardTitle>
				</CardHeader>
				<CardContent>
					{preview === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tính toán...
						</div>
					) : preview.recipients.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Không có dòng chiết khấu nào trong kỳ này.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Người nhận</TableHead>
									<TableHead className="text-center">Số đơn</TableHead>
									<TableHead className="text-center">Số dòng</TableHead>
									<TableHead>Phân bổ theo loại</TableHead>
									<TableHead className="text-right">Tổng phải chi</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{preview.recipients.map((recipient) => (
									<TableRow key={recipient.salesmanId}>
										<TableCell className="font-medium">
											{recipient.salesmanName}
										</TableCell>
										<TableCell className="text-center">
											{recipient.orderCount}
										</TableCell>
										<TableCell className="text-center">
											{recipient.entriesCount}
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-2">
												{Object.entries(recipient.byType)
													.filter(([, amount]) => amount > 0)
													.map(([type, amount]) => (
														<Badge
															key={`${recipient.salesmanId}-${type}`}
															variant="outline"
														>
															{
																discountBadgeLabels[
																	type as keyof typeof discountBadgeLabels
																]
															}
															: {formatCurrency(amount)}
														</Badge>
													))}
											</div>
										</TableCell>
										<TableCell className="text-right font-semibold text-teal-700">
											{formatCurrency(recipient.totalDiscountAmount)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<CardTitle>Chi tiết từng đơn thành công</CardTitle>
						<div className="relative w-full lg:w-72">
							<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Số đơn, người nhận, khách, sản phẩm..."
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								className="pl-8"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{preview === undefined ? (
						<div className="py-8 text-center text-muted-foreground">
							Đang tải dữ liệu...
						</div>
					) : filteredRows.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Không có đơn hàng phù hợp.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead rowSpan={2}>Ngày hoàn thành</TableHead>
									<TableHead rowSpan={2}>Số đơn</TableHead>
									<TableHead rowSpan={2}>Khách hàng</TableHead>
									<TableHead rowSpan={2} className="text-right">
										Giá trị đơn
									</TableHead>
									{discountColumnGroups.map((group) => (
										<TableHead
											key={group.key}
											colSpan={2}
											className="text-center"
										>
											{group.label}
										</TableHead>
									))}
									<TableHead rowSpan={2} className="text-right">
										Tổng chiết khấu
									</TableHead>
								</TableRow>
								<TableRow>
									{discountColumnGroups.map((group) => (
										<Fragment key={`${group.key}-subcolumns`}>
											<TableHead className="text-center">Tỷ lệ</TableHead>
											<TableHead>Người nhận</TableHead>
										</Fragment>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredRows.map((row) => (
									<TableRow key={row.key}>
										<TableCell>{formatDate(row.completedAt)}</TableCell>
										<TableCell className="font-mono text-xs">
											{row.orderNumber}
										</TableCell>
										<TableCell className="font-medium">
											{row.customerName}
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatCurrency(row.revenueAmount)}
										</TableCell>
										{discountColumnGroups.map((group) => {
											const cell = row.columns[group.key];

											return (
												<Fragment key={`${row.key}-${group.key}`}>
													<TableCell className="text-center text-xs">
														{formatPercentList(cell.percents)}
													</TableCell>
													<TableCell className="max-w-[180px] whitespace-normal text-xs">
														{formatRecipientList(cell.recipients)}
													</TableCell>
												</Fragment>
											);
										})}
										<TableCell className="text-right font-medium text-teal-700">
											{formatCurrency(row.totalDiscountAmount)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>Lưu bảng tính chiết khấu tháng</DialogTitle>
						<DialogDescription>
							Lưu snapshot để tạo công nợ chiết khấu cho từng người nhận trong
							kỳ {period}.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="space-y-2">
							<Label>Người lưu *</Label>
							<Input
								value={savedBy}
								onChange={(event) => setSavedBy(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Ghi chú</Label>
							<Textarea
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								placeholder="Ví dụ: chốt kỳ lương tháng, giữ lại 1 phần để đối soát..."
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
							Hủy
						</Button>
						<Button onClick={handleSave}>
							<Calculator className="mr-2 h-4 w-4" />
							Lưu và tạo công nợ
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={recalculateDialogOpen}
				onOpenChange={setRecalculateDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Tính lại chiết khấu cho kỳ {period}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Hệ thống sẽ lấy các đơn có trạng thái hoàn thành trong tháng đang
							chọn, áp dụng chính sách chiết khấu đang hoạt động và ghi đè lại
							chiết khấu trên từng dòng đơn hàng. Nếu tháng này đã có bảng chốt,
							snapshot công nợ hiện tại sẽ không tự cập nhật.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isRecalculating}>
							Hủy
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRecalculate}
							disabled={isRecalculating}
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`}
							/>
							Xác nhận tính lại
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Xóa bảng công nợ tháng {period}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{`Cảnh báo: thao tác này sẽ xóa toàn bộ snapshot công nợ của kỳ ${preview?.existingCalculation?.periodKey}, gồm ${existingCalculationDebtCount} công nợ và ${existingCalculationPaymentCount} thanh toán đã ghi nhận. Dữ liệu công nợ tháng này sẽ bị xóa vĩnh viễn để bạn có thể lưu lại bảng mới từ dữ liệu đã tính lại.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Hủy</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground"
							onClick={handleDeleteMonthlyCalculation}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Xóa công nợ theo tháng
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
