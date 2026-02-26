import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import {
	AlertTriangle,
	ClipboardList,
	Clock,
	Package,
	ShoppingCart,
	TrendingUp,
	UserCircle,
	Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const stats = useQuery(api.dashboard.getStats);

	if (stats === undefined) {
		return <DashboardSkeleton />;
	}

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
		}).format(amount);
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("vi-VN");
	};

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl tracking-tight">Tổng quan</h2>
				<p className="text-muted-foreground">
					Chào mừng đến với Tây Dương Pharma ERP
				</p>
			</div>

			{/* KPI Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Sản phẩm đang bán
						</CardTitle>
						<Package className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{stats.counts.products}</div>
						<p className="text-muted-foreground text-xs">
							Tổng tồn kho: {stats.counts.totalStock} đơn vị
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Khách hàng</CardTitle>
						<UserCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{stats.counts.customers}</div>
						<p className="text-muted-foreground text-xs">
							Khách hàng đang hoạt động
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Nhà cung cấp</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{stats.counts.suppliers}</div>
						<p className="text-muted-foreground text-xs">
							Nhà cung cấp đang hoạt động
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Doanh số tháng này
						</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">
							{formatCurrency(stats.financials.monthlySales)}
						</div>
						<p className="text-muted-foreground text-xs">Tháng này</p>
					</CardContent>
				</Card>
			</div>

			{/* Alerts */}
			<div className="grid gap-4 md:grid-cols-2">
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="h-5 w-5" />
							Cảnh báo tồn kho thấp
						</CardTitle>
						<CardDescription>Sản phẩm dưới mức tồn tối thiểu</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.lowStockProducts.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Không có cảnh báo tồn kho thấp
							</p>
						) : (
							<div className="space-y-2">
								{stats.lowStockProducts.slice(0, 5).map((product) => (
									<div
										key={product._id}
										className="flex items-center justify-between"
									>
										<div>
											<p className="font-medium text-sm">{product.name}</p>
											<p className="text-muted-foreground text-xs">
												{product.sku}
											</p>
										</div>
										<Badge variant="destructive">
											{product.totalStock} / {product.minStock}
										</Badge>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="border-yellow-500/50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-yellow-500">
							<Clock className="h-5 w-5" />
							Sắp hết hạn
						</CardTitle>
						<CardDescription>Sản phẩm hết hạn trong 30 ngày</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.expiringInventory.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Không có sản phẩm sắp hết hạn
							</p>
						) : (
							<div className="space-y-2">
								{stats.expiringInventory.slice(0, 5).map((item) => (
									<div
										key={item._id}
										className="flex items-center justify-between"
									>
										<div>
											<p className="font-medium text-sm">{item.productName}</p>
											<p className="text-muted-foreground text-xs">
												Lô: {item.batchNumber}
											</p>
										</div>
										<Badge
											variant="outline"
											className="border-yellow-500 text-yellow-500"
										>
											{formatDate(item.expiryDate)}
										</Badge>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Orders */}
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShoppingCart className="h-5 w-5" />
							Đơn nhập gần đây
						</CardTitle>
						<CardDescription>
							{stats.orders.pendingPurchase} đơn hàng chờ xử lý
						</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.recentActivity.purchaseOrders.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Không có đơn nhập hàng
							</p>
						) : (
							<div className="space-y-2">
								{stats.recentActivity.purchaseOrders.map((order) => (
									<div
										key={order._id}
										className="flex items-center justify-between"
									>
										<div>
											<p className="font-medium text-sm">{order.orderNumber}</p>
											<p className="text-muted-foreground text-xs">
												{order.supplierName}
											</p>
										</div>
										<div className="text-right">
											<Badge variant={getStatusVariant(order.status)}>
												{order.status}
											</Badge>
											<p className="mt-1 text-muted-foreground text-xs">
												{formatCurrency(order.totalAmount)}
											</p>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ClipboardList className="h-5 w-5" />
							Đơn bán gần đây
						</CardTitle>
						<CardDescription>
							{stats.orders.pendingSales} đơn hàng chờ xử lý
						</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.recentActivity.salesOrders.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Không có đơn bán hàng
							</p>
						) : (
							<div className="space-y-2">
								{stats.recentActivity.salesOrders.map((order) => (
									<div
										key={order._id}
										className="flex items-center justify-between"
									>
										<div>
											<p className="font-medium text-sm">{order.orderNumber}</p>
											<p className="text-muted-foreground text-xs">
												{order.customerName}
											</p>
										</div>
										<div className="text-right">
											<Badge variant={getStatusVariant(order.status)}>
												{order.status}
											</Badge>
											<p className="mt-1 text-muted-foreground text-xs">
												{formatCurrency(order.totalAmount)}
											</p>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Financial Summary */}
			<Card>
				<CardHeader>
					<CardTitle>Tổng kết tài chính (Tháng này)</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<p className="text-muted-foreground text-sm">Tổng doanh thu</p>
							<p className="font-bold text-2xl text-green-600">
								{formatCurrency(stats.financials.monthlySales)}
							</p>
						</div>
						<div className="space-y-2">
							<p className="text-muted-foreground text-sm">Tổng nhập hàng</p>
							<p className="font-bold text-2xl text-blue-600">
								{formatCurrency(stats.financials.monthlyPurchases)}
							</p>
						</div>
						<div className="space-y-2">
							<p className="text-muted-foreground text-sm">
								Lợi nhuận ước tính
							</p>
							<p
								className={`font-bold text-2xl ${stats.financials.monthlySales - stats.financials.monthlyPurchases >= 0 ? "text-green-600" : "text-red-600"}`}
							>
								{formatCurrency(
									stats.financials.monthlySales -
										stats.financials.monthlyPurchases,
								)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "completed":
		case "received":
			return "default";
		case "pending":
		case "partial":
			return "secondary";
		case "cancelled":
			return "destructive";
		default:
			return "outline";
	}
}

function DashboardSkeleton() {
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
							<Skeleton className="mt-2 h-8 w-16" />
							<Skeleton className="mt-2 h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{[...Array(2)].map((_, i) => (
					<Card key={i}>
						<CardHeader>
							<Skeleton className="h-5 w-32" />
							<Skeleton className="mt-2 h-4 w-48" />
						</CardHeader>
						<CardContent className="space-y-2">
							{[...Array(3)].map((_, j) => (
								<Skeleton key={j} className="h-12 w-full" />
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
