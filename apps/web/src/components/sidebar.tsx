import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  UserCircle,
  ShoppingCart,
  ClipboardList,
  FileBarChart,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Suppliers", href: "/suppliers", icon: Users },
  { name: "Customers", href: "/customers", icon: UserCircle },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Sales Orders", href: "/sales-orders", icon: ClipboardList },
  { name: "Reports", href: "/reports", icon: FileBarChart },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouterState();
  const currentPath = router.location.pathname;

  return (
    <div
      className={cn(
        "flex flex-col border-r bg-white transition-all duration-300 shadow-sm",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center border-b px-3 bg-gradient-to-r from-teal-600 to-cyan-600">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <img 
            src="/image/Logo Tây Dương tách nền.png" 
            alt="Tây Dương Logo" 
            className={cn("transition-all duration-300", collapsed ? "h-10 w-10" : "h-10 w-auto")}
          />
          {!collapsed && (
            <span className="text-lg font-bold text-white">
              Tây Dương Pharma
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn("ml-auto h-8 w-8 text-white hover:bg-white/20", collapsed && "mx-auto")}
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
      <ScrollArea className="flex-1 px-2 py-4 bg-slate-50">
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = currentPath.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md"
                    : "text-slate-600 hover:bg-white hover:text-teal-700 hover:shadow-sm",
                  collapsed && "justify-center px-2"
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
        <div className="border-t p-4 bg-slate-50">
          <p className="text-xs text-muted-foreground text-center">
            © 2026 Tây Dương Pharma ERP
          </p>
        </div>
      )}
    </div>
  );
}
