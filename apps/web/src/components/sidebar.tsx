import { Link, useRouterState } from "@tanstack/react-router";
import {
	BadgePercent,
	ChevronLeft,
	ClipboardList,
	FileBarChart,
	LayoutDashboard,
	Menu,
	Package,
	ShoppingCart,
	UserCheck,
	UserCircle,
	Users,
	Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const navigation = [
	{ name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
	{ name: "Sản phẩm", href: "/products", icon: Package },
	{ name: "Kho hàng", href: "/inventory", icon: Warehouse },
	{ name: "Nhà cung cấp", href: "/suppliers", icon: Users },
	{ name: "Khách hàng", href: "/customers", icon: UserCircle },
	{ name: "Nhân viên", href: "/employees", icon: UserCheck },
	{ name: "Đơn nhập", href: "/purchase-orders", icon: ShoppingCart },
	{ name: "Đơn bán", href: "/sales-orders", icon: ClipboardList },
	{ name: "Khuyến mãi", href: "/discounts", icon: BadgePercent },
	{ name: "Báo cáo", href: "/reports", icon: FileBarChart },
];

export default function Sidebar() {
	const [collapsed, setCollapsed] = useState(false);
	const router = useRouterState();
	const currentPath = router.location.pathname;

	return (
		<div
			className={cn(
				"flex flex-col border-r bg-white shadow-sm transition-all duration-300",
				collapsed ? "w-16" : "w-64",
			)}
		>
			{/* Header */}
			<div className="flex h-16 items-center border-b bg-gradient-to-r from-teal-600 to-cyan-600 px-3">
				<Link to="/dashboard" className="flex items-center gap-2 font-semibold">
					<img
						src="/image/Logo Tây Dương tách nền.png"
						alt="Tây Dương Logo"
						className={cn(
							"transition-all duration-300",
							collapsed ? "h-10 w-10" : "h-10 w-auto",
						)}
					/>
					{!collapsed && (
						<span className="font-bold text-lg text-white">
							Tây Dương Pharma
						</span>
					)}
				</Link>
				<Button
					variant="ghost"
					size="icon"
					className={cn(
						"ml-auto h-8 w-8 text-white hover:bg-white/20",
						collapsed && "mx-auto",
					)}
					onClick={() => setCollapsed(!collapsed)}
				>
					{collapsed ? (
						<Menu className="h-4 w-4" />
					) : (
						<ChevronLeft className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Navigation */}
			<ScrollArea className="flex-1 bg-slate-50 px-2 py-4">
				<nav className="flex flex-col gap-1">
					{navigation.map((item) => {
						const isActive = currentPath.startsWith(item.href);
						return (
							<Link
								key={item.name}
								to={item.href}
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-all duration-200",
									isActive
										? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md"
										: "text-slate-600 hover:bg-white hover:text-teal-700 hover:shadow-sm",
									collapsed && "justify-center px-2",
								)}
							>
								<item.icon className="h-5 w-5 shrink-0" />
								{!collapsed && <span>{item.name}</span>}
							</Link>
						);
					})}
				</nav>
			</ScrollArea>

			{/* Footer */}
			{!collapsed && (
				<div className="border-t bg-slate-50 p-4">
					<p className="text-center text-muted-foreground text-xs">
						© 2026 Tây Dương Pharma ERP
					</p>
				</div>
			)}
		</div>
	);
}
