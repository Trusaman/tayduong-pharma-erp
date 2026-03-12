import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Calculator, Save, Search } from "lucide-react";
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

const discountTypeLabels = {
	Doctor: "BS",
	hospital: "NT, KD",
	payment: "Thanh toán",
	CTV: "CTV",
	Salesman: "Salesman",
	Manager: "Quản lý",
} as const;

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

	const [yearText, monthText] = period.split("-");
	const year = Number(yearText);
	const month = Number(monthText);

	const preview = useQuery(api.discountCalculations.previewMonthly, {
		month,
		year,
	});
	const saveMonthly = useMutation(api.discountCalculations.saveMonthly);

	const filteredEntries = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		if (!preview?.entries) return [];
		if (!keyword) return preview.entries;

		return preview.entries.filter((entry) =>
			[
				entry.orderNumber,
				entry.salesmanName,
				entry.customerName,
				entry.productName,
				entry.ruleName,
			].some((value) => value.toLowerCase().includes(keyword)),
		);
	}, [preview?.entries, search]);

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
			maximumFractionDigits: 2,
		}).format(amount);

	const formatDate = (timestamp: number) =>
		new Date(timestamp).toLocaleDateString("vi-VN");

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
						onClick={() => setSaveDialogOpen(true)}
						disabled={
							preview === undefined ||
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
					<CardContent className="flex flex-col gap-2 p-4 text-sm md:flex-row md:items-center md:justify-between">
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
						</div>
						<Badge variant="secondary">
							{preview.existingCalculation.periodKey}
						</Badge>
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
																discountTypeLabels[
																	type as keyof typeof discountTypeLabels
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
					) : filteredEntries.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							Không có dòng phù hợp.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Ngày hoàn thành</TableHead>
									<TableHead>Số đơn</TableHead>
									<TableHead>Người nhận</TableHead>
									<TableHead>Khách hàng</TableHead>
									<TableHead>Sản phẩm</TableHead>
									<TableHead>Loại CK</TableHead>
									<TableHead className="text-right">% phân bổ</TableHead>
									<TableHead className="text-right">Số CK</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredEntries.map((entry) => (
									<TableRow
										key={`${entry.salesOrderItemId}-${entry.salesmanId}-${entry.discountType}`}
									>
										<TableCell>{formatDate(entry.completedAt)}</TableCell>
										<TableCell className="font-mono text-xs">
											{entry.orderNumber}
										</TableCell>
										<TableCell className="font-medium">
											{entry.salesmanName}
										</TableCell>
										<TableCell>{entry.customerName}</TableCell>
										<TableCell>{entry.productName}</TableCell>
										<TableCell>
											<Badge variant="secondary">
												{discountTypeLabels[entry.discountType]}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											{entry.allocatedPercent.toLocaleString("vi-VN", {
												maximumFractionDigits: 2,
											})}
											%
										</TableCell>
										<TableCell className="text-right font-medium text-teal-700">
											{formatCurrency(entry.discountAmount)}
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
		</div>
	);
}
