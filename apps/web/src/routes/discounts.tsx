import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Plus, Users } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
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

export const Route = createFileRoute("/discounts")({
	component: DiscountsPage,
});

const discountTypes = [
	"Doctor",
	"hospital",
	"payment",
	"Salesman",
	"Manager",
] as const;

const discountTypeLabels: Record<(typeof discountTypes)[number], string> = {
	Doctor: "Chiết khấu BS",
	hospital: "Chiết khấu NT, KD",
	payment: "Chiết khấu thanh toán",
	Salesman: "Chiết khấu NT, KD",
	Manager: "Chiết khấu Quản lý",
};

type DiscountGroupKey = "doctor" | "sales" | "payment" | "manager";

const discountGroups: Array<{ key: DiscountGroupKey; label: string }> = [
	{ key: "doctor", label: "Chiết khấu BS" },
	{ key: "sales", label: "Chiết khấu NT, KD" },
	{ key: "payment", label: "Chiết khấu thanh toán" },
	{ key: "manager", label: "Chiết khấu Quản lý" },
];

const discountTypeToGroup: Record<
	(typeof discountTypes)[number],
	DiscountGroupKey
> = {
	Doctor: "doctor",
	hospital: "sales",
	payment: "payment",
	Salesman: "sales",
	Manager: "manager",
};

const groupToDiscountType: Record<
	DiscountGroupKey,
	(typeof discountTypes)[number]
> = {
	doctor: "Doctor",
	sales: "hospital",
	payment: "payment",
	manager: "Manager",
};

function DiscountsPage() {
	const [salesmanDialogOpen, setSalesmanDialogOpen] = useState(false);
	const [discountDialogOpen, setDiscountDialogOpen] = useState(false);

	const [salesmanForm, setSalesmanForm] = useState({
		name: "",
		code: "",
		phone: "",
		notes: "",
	});

	const [discountForm, setDiscountForm] = useState({
		name: "",
		customerId: "",
		productId: "",
		createdByStaff: "",
		notes: "",
		// Separate fields for each discount type
		doctor: {
			salesmanId: "",
			percent: "",
		},
		sales: {
			salesmanId: "",
			percent: "",
		},
		payment: {
			salesmanId: "",
			percent: "",
		},
		manager: {
			salesmanId: "",
			percent: "",
		},
	});

	const salesmen = useQuery(api.salesmen.list, { activeOnly: true });
	const customers = useQuery(api.customers.list, { activeOnly: true });
	const products = useQuery(api.products.list, { activeOnly: true });
	const rules = useQuery(api.discounts.listWithDetails, { activeOnly: false });

	const createSalesman = useMutation(api.salesmen.create);
	const createDiscount = useMutation(api.discounts.create);
	const updateDiscount = useMutation(api.discounts.update);

	const handleCreateSalesman = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await createSalesman({
				name: salesmanForm.name,
				code: salesmanForm.code,
				phone: salesmanForm.phone || undefined,
				notes: salesmanForm.notes || undefined,
			});
			toast.success("Đã tạo người nhận chiết khấu");
			setSalesmanDialogOpen(false);
			setSalesmanForm({ name: "", code: "", phone: "", notes: "" });
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể tạo người nhận chiết khấu",
			);
		}
	};

	const handleCreateDiscount = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const rulesToCreate: Array<{
				discountType: (typeof discountTypes)[number];
				salesmanId: Id<"salesmen">;
				percent: number;
			}> = [];

			// Check each discount type
			for (const group of discountGroups) {
				const groupData = discountForm[group.key];
				if (
					groupData.percent &&
					Number(groupData.percent) > 0 &&
					groupData.salesmanId
				) {
					rulesToCreate.push({
						discountType: groupToDiscountType[group.key],
						salesmanId: groupData.salesmanId as Id<"salesmen">,
						percent: Number(groupData.percent),
					});
				}
			}

			if (rulesToCreate.length === 0) {
				toast.error(
					"Vui lòng nhập ít nhất một loại chiết khấu với tỷ lệ và người nhận",
				);
				return;
			}

			// Create discount rules for each type
			for (const rule of rulesToCreate) {
				await createDiscount({
					name:
						discountForm.name ||
						`${discountTypeLabels[rule.discountType]} - ${new Date().toLocaleDateString("vi-VN")}`,
					discountType: rule.discountType,
					customerId: discountForm.customerId
						? (discountForm.customerId as Id<"customers">)
						: undefined,
					productId: discountForm.productId
						? (discountForm.productId as Id<"products">)
						: undefined,
					salesmanId: rule.salesmanId,
					discountPercent: rule.percent,
					createdByStaff: discountForm.createdByStaff,
					notes: discountForm.notes || undefined,
				});
			}

			toast.success(`Đã tạo ${rulesToCreate.length} quy tắc chiết khấu`);
			setDiscountDialogOpen(false);
			setDiscountForm({
				name: "",
				customerId: "",
				productId: "",
				createdByStaff: "",
				notes: "",
				doctor: { salesmanId: "", percent: "" },
				sales: { salesmanId: "", percent: "" },
				payment: { salesmanId: "", percent: "" },
				manager: { salesmanId: "", percent: "" },
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể tạo quy tắc chiết khấu",
			);
		}
	};

	const toggleRuleActive = async (
		id: Id<"discountRules">,
		isActive: boolean,
	) => {
		try {
			await updateDiscount({ id, isActive: !isActive });
			toast.success("Đã cập nhật quy tắc chiết khấu");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể cập nhật quy tắc chiết khấu",
			);
		}
	};

	const formatDate = (timestamp: number) =>
		new Date(timestamp).toLocaleDateString("vi-VN");

	const updateGroupField = (
		groupKey: DiscountGroupKey,
		field: "salesmanId" | "percent",
		value: string,
	) => {
		setDiscountForm((prev) => ({
			...prev,
			[groupKey]: {
				...prev[groupKey],
				[field]: value,
			},
		}));
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Chiết khấu</h2>
					<p className="text-muted-foreground">
						Quản lý chiết khấu theo bác sĩ, nhà thuốc, thanh toán và quản lý.
					</p>
				</div>
				<div className="flex gap-2">
					<Dialog
						open={salesmanDialogOpen}
						onOpenChange={setSalesmanDialogOpen}
					>
						<DialogTrigger asChild>
							<Button variant="outline">
								<Users className="mr-2 h-4 w-4" />
								Thêm người nhận chiết khấu
							</Button>
						</DialogTrigger>
						<DialogContent>
							<form onSubmit={handleCreateSalesman}>
								<DialogHeader>
									<DialogTitle>Thêm người nhận chiết khấu</DialogTitle>
									<DialogDescription>
										Thêm người nhận chiết khấu mới.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Họ tên *</Label>
											<Input
												value={salesmanForm.name}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														name: e.target.value,
													})
												}
												required
											/>
										</div>
										<div className="space-y-2">
											<Label>Mã *</Label>
											<Input
												value={salesmanForm.code}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														code: e.target.value,
													})
												}
												required
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Số điện thoại</Label>
											<Input
												value={salesmanForm.phone}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														phone: e.target.value,
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Ghi chú</Label>
											<Input
												value={salesmanForm.notes}
												onChange={(e) =>
													setSalesmanForm({
														...salesmanForm,
														notes: e.target.value,
													})
												}
											/>
										</div>
									</div>
								</div>
								<DialogFooter>
									<Button type="submit">Tạo</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>

					<Dialog
						open={discountDialogOpen}
						onOpenChange={setDiscountDialogOpen}
					>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Thêm chiết khấu
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
							<form onSubmit={handleCreateDiscount}>
								<DialogHeader>
									<DialogTitle>Thêm chiết khấu</DialogTitle>
									<DialogDescription>
										Nhập tỷ lệ chiết khấu cho từng loại. Để trống nếu không áp
										dụng.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									{/* Common fields */}
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Tên quy tắc</Label>
											<Input
												value={discountForm.name}
												onChange={(e) =>
													setDiscountForm({
														...discountForm,
														name: e.target.value,
													})
												}
												placeholder="Tự động nếu để trống"
											/>
										</div>
										<div className="space-y-2">
											<Label>Người tạo *</Label>
											<Input
												value={discountForm.createdByStaff}
												onChange={(e) =>
													setDiscountForm({
														...discountForm,
														createdByStaff: e.target.value,
													})
												}
												required
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Khách hàng (tùy chọn)</Label>
											<Select
												value={discountForm.customerId || "all-customers"}
												onValueChange={(v) =>
													v &&
													setDiscountForm({
														...discountForm,
														customerId: v === "all-customers" ? "" : v,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Tất cả khách hàng" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all-customers">
														Tất cả khách hàng
													</SelectItem>
													{customers?.map((c) => (
														<SelectItem key={c._id} value={c._id}>
															{c.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Sản phẩm/Thuốc (tùy chọn)</Label>
											<Select
												value={discountForm.productId || "all-products"}
												onValueChange={(v) =>
													v &&
													setDiscountForm({
														...discountForm,
														productId: v === "all-products" ? "" : v,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Tất cả sản phẩm" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all-products">
														Tất cả sản phẩm
													</SelectItem>
													{products?.map((p) => (
														<SelectItem key={p._id} value={p._id}>
															{p.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									{/* Discount types section */}
									<div className="space-y-4 rounded-lg border p-4">
										<h4 className="font-medium text-sm">Chi tiết chiết khấu</h4>

										{discountGroups.map((group) => (
											<div
												key={group.key}
												className="grid grid-cols-3 items-end gap-4"
											>
												<div className="space-y-2">
													<Label>{group.label}</Label>
													<div className="flex items-center gap-2">
														<Input
															type="number"
															min="0"
															max="100"
															step="0.01"
															placeholder="0"
															value={discountForm[group.key].percent}
															onChange={(e) =>
																updateGroupField(
																	group.key,
																	"percent",
																	e.target.value,
																)
															}
															className="w-24"
														/>
														<span className="text-muted-foreground text-sm">
															%
														</span>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Người nhận</Label>
													<Select
														value={discountForm[group.key].salesmanId}
														onValueChange={(v) =>
															v && updateGroupField(group.key, "salesmanId", v)
														}
													>
														<SelectTrigger>
															<SelectValue placeholder="Chọn người nhận" />
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
												<div className="space-y-2">
													<Label className="opacity-0">Thành tiền</Label>
													<div className="flex h-9 items-center text-muted-foreground text-sm">
														{discountForm[group.key].percent &&
															Number(discountForm[group.key].percent) > 0
															? "Sẽ tính khi có đơn hàng"
															: "-"}
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="space-y-2">
										<Label>Ghi chú</Label>
										<Textarea
											value={discountForm.notes}
											onChange={(e) =>
												setDiscountForm({
													...discountForm,
													notes: e.target.value,
												})
											}
										/>
									</div>
								</div>
								<DialogFooter>
									<Button type="submit">Tạo quy tắc</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Danh sách chiết khấu</CardTitle>
				</CardHeader>
				<CardContent>
					{rules === undefined ? (
						<div className="text-muted-foreground">Đang tải...</div>
					) : rules.length === 0 ? (
						<div className="text-muted-foreground">
							Chưa có quy tắc chiết khấu nào
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead rowSpan={2}>Ngày hạch toán</TableHead>
										<TableHead rowSpan={2} className="text-right">
											Đơn giá
										</TableHead>
										<TableHead rowSpan={2} className="text-right">
											Chiết khấu/Lọ, viên
										</TableHead>
										<TableHead rowSpan={2} className="text-right">
											Tổng doanh số
										</TableHead>
										{discountGroups.map((group) => (
											<TableHead
												key={group.key}
												colSpan={3}
												className="text-center"
											>
												{group.label}
											</TableHead>
										))}
										<TableHead rowSpan={2} className="text-right">
											Tổng chiết khấu
										</TableHead>
										<TableHead rowSpan={2} className="text-right">
											Trạng thái
										</TableHead>
									</TableRow>
									<TableRow>
										{discountGroups.map((group) => (
											<Fragment key={`${group.key}-sub`}>
												<TableHead className="text-right">Tỷ lệ</TableHead>
												<TableHead className="text-right">Thành tiền</TableHead>
												<TableHead className="text-center">
													Người nhận
												</TableHead>
											</Fragment>
										))}
									</TableRow>
								</TableHeader>
								<TableBody>
									{rules.map((rule) => {
										const activeGroup = discountTypeToGroup[rule.discountType];

										return (
											<TableRow key={rule._id}>
												<TableCell>
													<div className="font-medium">
														{formatDate(rule.createdAt)}
													</div>
													<div className="text-muted-foreground text-xs">
														{rule.name}
													</div>
												</TableCell>
												<TableCell className="text-right">-</TableCell>
												<TableCell className="text-right">-</TableCell>
												<TableCell className="text-right">-</TableCell>
												{discountGroups.map((group) => {
													const isActiveGroup = group.key === activeGroup;

													return (
														<Fragment key={`${rule._id}-${group.key}`}>
															<TableCell className="text-right">
																{isActiveGroup
																	? `${rule.discountPercent}%`
																	: "0%"}
															</TableCell>
															<TableCell className="text-right">-</TableCell>
															<TableCell className="text-center">
																{isActiveGroup ? rule.createdByStaff : ""}
															</TableCell>
														</Fragment>
													);
												})}
												<TableCell className="text-right">-</TableCell>
												<TableCell className="text-right">
													<Button
														size="sm"
														variant={rule.isActive ? "secondary" : "outline"}
														onClick={() =>
															toggleRuleActive(rule._id, rule.isActive)
														}
													>
														{rule.isActive ? "Hoạt động" : "Tạm dừng"}
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
