import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import {
	AlertTriangle,
	ClipboardList,
	DollarSign,
	Download,
	Package,
	ShoppingCart,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/reports")({
	component: ReportsPage,
});

function ReportsPage() {
	const [selectedPeriod, setSelectedPeriod] = useState("month");

	const stats = useQuery(api.dashboard.getStats);
	const inventory = useQuery(api.inventory.listWithProducts, {});
	const lowStock = useQuery(api.inventory.getLowStock, {});
	const expiring = useQuery(api.inventory.getExpiring, { withinDays: 90 });
	const purchaseOrders = useQuery(api.purchaseOrders.listWithSuppliers, {});
	const salesOrders = useQuery(api.salesOrders.listWithCustomers, {});

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
		}).format(amount);
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("vi-VN");
	};

	const isExpired = (expiryDate: number) => {
		return expiryDate < Date.now();
	};

	const getExpiryStatus = (expiryDate: number) => {
		const now = Date.now();
		const thirtyDays = 30 * 24 * 60 * 60 * 1000;
		const ninetyDays = 90 * 24 * 60 * 60 * 1000;

		if (expiryDate < now) {
			return { label: "Hết hạn", variant: "destructive" as const };
		}
		if (expiryDate < now + thirtyDays) {
			return { label: "< 30 ngày", variant: "destructive" as const };
		}
		if (expiryDate < now + ninetyDays) {
			return { label: "< 90 ngày", variant: "outline" as const };
		}
		return { label: "OK", variant: "default" as const };
	};

	if (stats === undefined) {
		return <ReportsSkeleton />;
	}

	// Calculate report data
	const inventoryValue =
		inventory?.reduce(
			(sum, item) => sum + item.quantity * item.purchasePrice,
			0,
		) || 0;
	const totalInventoryItems = inventory?.length || 0;

	// Group expiring by period
	const expiredItems =
		expiring?.filter((item) => isExpired(item.expiryDate)) || [];
	const expiringWithin30 =
		expiring?.filter(
			(item) =>
				!isExpired(item.expiryDate) &&
				item.expiryDate < Date.now() + 30 * 24 * 60 * 60 * 1000,
		) || [];
	const expiringWithin90 =
		expiring?.filter(
			(item) =>
				!isExpired(item.expiryDate) &&
				item.expiryDate >= Date.now() + 30 * 24 * 60 * 60 * 1000 &&
				item.expiryDate < Date.now() + 90 * 24 * 60 * 60 * 1000,
		) || [];

	// Order stats
	const pendingPO =
		purchaseOrders?.filter(
			(o) => o.status === "pending" || o.status === "partial",
		) || [];
	const pendingSO =
		salesOrders?.filter(
			(o) => o.status === "pending" || o.status === "partial",
		) || [];
	const completedSO =
		salesOrders?.filter((o) => o.status === "completed") || [];
	const totalSalesValue =
		completedSO?.reduce((sum, o) => sum + o.totalAmount, 0) || 0;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">Báo cáo</h2>
					<p className="text-muted-foreground">
						Thông tin kinh doanh và phân tích
					</p>
				</div>
				<Select
					value={selectedPeriod}
					onValueChange={(v) => v && setSelectedPeriod(v)}
				>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="week">Tuần này</SelectItem>
						<SelectItem value="month">Tháng này</SelectItem>
						<SelectItem value="quarter">Quý này</SelectItem>
						<SelectItem value="year">Năm nay</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Giá trị tồn kho
						</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">
							{formatCurrency(inventoryValue)}
						</div>
						<p className="text-muted-foreground text-xs">
							{totalInventoryItems} lô hàng
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Tổng doanh thu
						</CardTitle>
						<TrendingUp className="h-4 w-4 text-green-500" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl text-green-600">
							{formatCurrency(totalSalesValue)}
						</div>
						<p className="text-muted-foreground text-xs">
							{completedSO?.length || 0} đơn hoàn thành
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">ĐN nhập chờ</CardTitle>
						<ShoppingCart className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{pendingPO?.length || 0}</div>
						<p className="text-muted-foreground text-xs">Chờ giao hàng</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">ĐN bán chờ</CardTitle>
						<ClipboardList className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{pendingSO?.length || 0}</div>
						<p className="text-muted-foreground text-xs">Chờ giao hàng</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="inventory" className="space-y-4">
				<TabsList>
					<TabsTrigger value="inventory">Báo cáo tồn kho</TabsTrigger>
					<TabsTrigger value="expiry">Báo cáo hạn sử dụng</TabsTrigger>
					<TabsTrigger value="lowstock">Báo cáo tồn thấp</TabsTrigger>
					<TabsTrigger value="sales">Báo cáo bán hàng</TabsTrigger>
				</TabsList>

				<TabsContent value="inventory" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Tổng hợp tồn kho</CardTitle>
									<CardDescription>
										Trạng thái tồn kho theo sản phẩm
									</CardDescription>
								</div>
								<Button variant="outline" size="sm">
									<Download className="mr-2 h-4 w-4" />
									Xuất
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Sản phẩm</TableHead>
										<TableHead>SKU</TableHead>
										<TableHead className="text-right">Tổng SL</TableHead>
										<TableHead className="text-right">Giá TB</TableHead>
										<TableHead className="text-right">Tổng giá trị</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{inventory?.slice(0, 20).map((item) => (
										<TableRow key={item._id}>
											<TableCell className="font-medium">
												{item.product?.name || "-"}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{item.product?.sku}
											</TableCell>
											<TableCell className="text-right">
												{item.quantity}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(item.purchasePrice)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(item.quantity * item.purchasePrice)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="expiry" className="space-y-4">
					{/* Expiry Summary Cards */}
					<div className="grid gap-4 md:grid-cols-3">
						<Card className="border-destructive/50">
							<CardHeader className="pb-3">
								<CardTitle className="text-base text-destructive">
									Hết hạn
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="font-bold text-3xl text-destructive">
									{expiredItems.length}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									Sản phẩm đã hết hạn
								</p>
							</CardContent>
						</Card>
						<Card className="border-yellow-500/50">
							<CardHeader className="pb-3">
								<CardTitle className="text-base text-yellow-500">
									Hết hạn trong 30 ngày
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="font-bold text-3xl text-yellow-500">
									{expiringWithin30.length}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									Cần xử lý gấp
								</p>
							</CardContent>
						</Card>
						<Card className="border-blue-500/50">
							<CardHeader className="pb-3">
								<CardTitle className="text-base text-blue-500">
									Hết hạn trong 90 ngày
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="font-bold text-3xl text-blue-500">
									{expiringWithin90.length}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									Lên kế hoạch thanh lý
								</p>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Chi tiết hạn sử dụng</CardTitle>
							<CardDescription>Sản phẩm theo ngày hết hạn</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Sản phẩm</TableHead>
										<TableHead>Số lô</TableHead>
										<TableHead className="text-right">SL</TableHead>
										<TableHead>Hạn sử dụng</TableHead>
										<TableHead className="text-center">Trạng thái</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{expiring?.slice(0, 30).map((item) => {
										const status = getExpiryStatus(item.expiryDate);
										return (
											<TableRow key={item._id}>
												<TableCell className="font-medium">
													{item.product?.name || "-"}
												</TableCell>
												<TableCell className="font-mono">
													{item.batchNumber}
												</TableCell>
												<TableCell className="text-right">
													{item.quantity}
												</TableCell>
												<TableCell>{formatDate(item.expiryDate)}</TableCell>
												<TableCell className="text-center">
													<Badge variant={status.variant}>{status.label}</Badge>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="lowstock" className="space-y-4">
					<Card className="border-destructive/50">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-destructive">
								<AlertTriangle className="h-5 w-5" />
								Cảnh báo tồn thấp
							</CardTitle>
							<CardDescription>Sản phẩm dưới mức tồn tối thiểu</CardDescription>
						</CardHeader>
						<CardContent>
							{lowStock && lowStock.length > 0 ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Sản phẩm</TableHead>
											<TableHead>Mã SKU</TableHead>
											<TableHead className="text-center">
												Tồn hiện tại
											</TableHead>
											<TableHead className="text-center">
												Mức tối thiểu
											</TableHead>
											<TableHead className="text-center">Thiếu</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{lowStock.map((product) => (
											<TableRow key={product._id}>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell className="font-mono">
													{product.sku}
												</TableCell>
												<TableCell className="text-center">
													<span className="font-bold text-red-500">
														{product.totalStock}
													</span>
												</TableCell>
												<TableCell className="text-center">
													{product.minStock}
												</TableCell>
												<TableCell className="text-center">
													<Badge variant="destructive">
														{product.minStock - product.totalStock}
													</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<div className="py-8 text-center text-muted-foreground">
									<Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
									<p>Tất cả sản phẩm đều đủ tồn kho</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="sales" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Tổng hợp đơn bán hàng</CardTitle>
							<CardDescription>Tổng quan tất cả đơn bán hàng</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Số đơn</TableHead>
										<TableHead>Khách hàng</TableHead>
										<TableHead>Ngày</TableHead>
										<TableHead className="text-right">Thành tiền</TableHead>
										<TableHead className="text-center">Trạng thái</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{salesOrders?.slice(0, 20).map((order) => (
										<TableRow key={order._id}>
											<TableCell className="font-mono">
												{order.orderNumber}
											</TableCell>
											<TableCell>{order.customer?.name || "-"}</TableCell>
											<TableCell>{formatDate(order.orderDate)}</TableCell>
											<TableCell className="text-right">
												{formatCurrency(order.totalAmount)}
											</TableCell>
											<TableCell className="text-center">
												<Badge
													variant={
														order.status === "completed"
															? "default"
															: order.status === "cancelled"
																? "destructive"
																: order.status === "partial"
																	? "outline"
																	: "secondary"
													}
												>
													{order.status}
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ReportsSkeleton() {
	return (
		<div className="space-y-6">
			<div>
				<Skeleton className="h-8 w-32" />
				<Skeleton className="mt-2 h-4 w-48" />
			</div>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Card key={i}>
						<CardHeader className="space-y-0 pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="mt-2 h-8 w-20" />
							<Skeleton className="mt-2 h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		</div>
	);
}
