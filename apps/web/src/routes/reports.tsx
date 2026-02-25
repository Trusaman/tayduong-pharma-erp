import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  ClipboardList,
  Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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
      return { label: "Expired", variant: "destructive" as const };
    } else if (expiryDate < now + thirtyDays) {
      return { label: "< 30 days", variant: "destructive" as const };
    } else if (expiryDate < now + ninetyDays) {
      return { label: "< 90 days", variant: "outline" as const };
    }
    return { label: "OK", variant: "default" as const };
  };

  if (stats === undefined) {
    return <ReportsSkeleton />;
  }

  // Calculate report data
  const inventoryValue = inventory?.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0) || 0;
  const totalInventoryItems = inventory?.length || 0;

  // Group expiring by period
  const expiredItems = expiring?.filter(item => isExpired(item.expiryDate)) || [];
  const expiringWithin30 = expiring?.filter(item => !isExpired(item.expiryDate) && item.expiryDate < Date.now() + 30 * 24 * 60 * 60 * 1000) || [];
  const expiringWithin90 = expiring?.filter(item => !isExpired(item.expiryDate) && item.expiryDate >= Date.now() + 30 * 24 * 60 * 60 * 1000 && item.expiryDate < Date.now() + 90 * 24 * 60 * 60 * 1000) || [];

  // Order stats
  const pendingPO = purchaseOrders?.filter(o => o.status === "pending" || o.status === "partial") || [];
  const pendingSO = salesOrders?.filter(o => o.status === "pending" || o.status === "partial") || [];
  const completedSO = salesOrders?.filter(o => o.status === "completed") || [];
  const totalSalesValue = completedSO?.reduce((sum, o) => sum + o.totalAmount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">Business insights and analytics</p>
        </div>
        <Select value={selectedPeriod} onValueChange={(v) => v && setSelectedPeriod(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(inventoryValue)}</div>
            <p className="text-xs text-muted-foreground">{totalInventoryItems} batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSalesValue)}</div>
            <p className="text-xs text-muted-foreground">{completedSO?.length || 0} completed orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPO?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending SOs</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSO?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting fulfillment</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory Report</TabsTrigger>
          <TabsTrigger value="expiry">Expiry Report</TabsTrigger>
          <TabsTrigger value="lowstock">Low Stock Report</TabsTrigger>
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inventory Summary</CardTitle>
                  <CardDescription>Complete inventory status by product</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory?.slice(0, 20).map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.product?.name || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{item.product?.sku}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.purchasePrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.quantity * item.purchasePrice)}</TableCell>
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
                <CardTitle className="text-destructive text-base">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{expiredItems.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Items past expiry date</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-yellow-500 text-base">Expiring in 30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-500">{expiringWithin30.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Urgent attention needed</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-500 text-base">Expiring in 90 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{expiringWithin90.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Plan for clearance</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Expiry Details</CardTitle>
              <CardDescription>Products by expiry date</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring?.slice(0, 30).map((item) => {
                    const status = getExpiryStatus(item.expiryDate);
                    return (
                      <TableRow key={item._id}>
                        <TableCell className="font-medium">{item.product?.name || "-"}</TableCell>
                        <TableCell className="font-mono">{item.batchNumber}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
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
                Low Stock Alerts
              </CardTitle>
              <CardDescription>Products below minimum stock level</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStock && lowStock.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Current Stock</TableHead>
                      <TableHead className="text-center">Min Level</TableHead>
                      <TableHead className="text-center">Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="font-mono">{product.sku}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-red-500 font-bold">{product.totalStock}</span>
                        </TableCell>
                        <TableCell className="text-center">{product.minStock}</TableCell>
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
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All products are adequately stocked</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Order Summary</CardTitle>
              <CardDescription>Overview of all sales orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesOrders?.slice(0, 20).map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-mono">{order.orderNumber}</TableCell>
                      <TableCell>{order.customer?.name || "-"}</TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            order.status === "completed" ? "default" :
                            order.status === "cancelled" ? "destructive" :
                            order.status === "partial" ? "outline" : "secondary"
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
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mt-2" />
              <Skeleton className="h-3 w-32 mt-2" />
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
