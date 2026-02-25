import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  Plus,
  Search,
  ClipboardList,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/sales-orders")({
  component: SalesOrdersPage,
});

interface OrderItem {
  productId: string;
  quantity: string;
  unitPrice: string;
}

const initialItem: OrderItem = { productId: "", quantity: "1", unitPrice: "" };

function SalesOrdersPage() {
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([initialItem]);

  const orders = useQuery(api.salesOrders.listWithCustomers, {});
  const customers = useQuery(api.customers.list, { activeOnly: true });
  const products = useQuery(api.products.list, { activeOnly: true });
  const orderDetails = useQuery(
    api.salesOrders.getWithDetails,
    selectedOrderId ? { id: selectedOrderId as any } : "skip"
  );

  const createOrder = useMutation(api.salesOrders.create);
  const updateStatus = useMutation(api.salesOrders.updateStatus);
  const deleteOrder = useMutation(api.salesOrders.remove);

  const filteredOrders = orders?.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddItem = () => {
    setItems([...items, { ...initialItem }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validItems = items.filter((item) => item.productId && item.quantity && item.unitPrice);
      if (validItems.length === 0) {
        toast.error("Please add at least one item");
        return;
      }

      await createOrder({
        customerId: customerId as any,
        items: validItems.map((item) => ({
          productId: item.productId as any,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })),
        notes: notes || undefined,
      });
      toast.success("Sales order created successfully");
      setCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
    }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await updateStatus({ id: orderId as any, status: status as any });
      toast.success("Order status updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const handleDelete = async (orderId: string) => {
    try {
      await deleteOrder({ id: orderId as any });
      toast.success("Order deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete order");
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setNotes("");
    setItems([initialItem]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("vi-VN");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "partial":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Partial</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const viewOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Orders</h2>
          <p className="text-muted-foreground">Manage customer sales orders</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateOrder}>
              <DialogHeader>
                <DialogTitle>Create Sales Order</DialogTitle>
                <DialogDescription>
                  Create a new sales order for a customer.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={customerId} onValueChange={(v) => v && setCustomerId(v)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Items *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Select
                          value={item.productId}
                          onValueChange={(v) => v && handleItemChange(index, "productId", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((p) => (
                              <SelectItem key={p._id} value={p._id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          className="h-9"
                          min="1"
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                          className="h-9"
                          min="0"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Order</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orders List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orders === undefined ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredOrders?.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No sales orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-mono">{order.orderNumber}</TableCell>
                    <TableCell>{order.customer?.name || "-"}</TableCell>
                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => viewOrderDetails(order._id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {order.status === "draft" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(order._id, "pending")}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(order._id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {order.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(order._id, "cancelled")}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Order Details - {orderDetails?.orderNumber}</DialogTitle>
          </DialogHeader>
          {orderDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{orderDetails.customer?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(orderDetails.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p>{formatDate(orderDetails.orderDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-bold">{formatCurrency(orderDetails.totalAmount)}</p>
                </div>
              </div>

              {orderDetails.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{orderDetails.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Fulfilled</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.items?.map((item: any) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.fulfilledQuantity || 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
