import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Plus, Trash2, Search, Warehouse, AlertTriangle, Clock } from "lucide-react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

interface InventoryForm {
  productId: string;
  batchNumber: string;
  quantity: string;
  expiryDate: string;
  purchasePrice: string;
  supplierId: string;
  location: string;
}

const initialForm: InventoryForm = {
  productId: "",
  batchNumber: "",
  quantity: "",
  expiryDate: "",
  purchasePrice: "",
  supplierId: "",
  location: "",
};

function InventoryPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<InventoryForm>(initialForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inventory = useQuery(api.inventory.listWithProducts, {});
  const products = useQuery(api.products.list, { activeOnly: true });
  const suppliers = useQuery(api.suppliers.list, { activeOnly: true });
  const lowStock = useQuery(api.inventory.getLowStock, {});
  const expiring = useQuery(api.inventory.getExpiring, { withinDays: 30 });

  const createInventory = useMutation(api.inventory.create);
  const deleteInventory = useMutation(api.inventory.remove);

  const filteredInventory = inventory?.filter(
    (item) =>
      item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInventory({
        productId: form.productId as any,
        batchNumber: form.batchNumber,
        quantity: parseInt(form.quantity),
        expiryDate: new Date(form.expiryDate).getTime(),
        purchasePrice: parseFloat(form.purchasePrice),
        supplierId: form.supplierId ? (form.supplierId as any) : undefined,
        location: form.location || undefined,
      });
      toast.success("Inventory batch added successfully");
      setDialogOpen(false);
      setForm(initialForm);
    } catch (error: any) {
      toast.error(error.message || "Failed to add inventory");
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteInventory({ id: deletingId as any });
      toast.success("Inventory record deleted");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete inventory");
    }
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

  const isExpiringSoon = (expiryDate: number) => {
    const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return expiryDate < thirtyDays;
  };

  const isExpired = (expiryDate: number) => {
    return expiryDate < Date.now();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
          <p className="text-muted-foreground">Manage stock levels and batches</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(initialForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Inventory Batch</DialogTitle>
                <DialogDescription>
                  Add a new inventory batch to the system.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="product">Product *</Label>
                  <Select
                    value={form.productId}
                    onValueChange={(value) => setForm({ ...form, productId: value ?? "" })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name} ({p.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="batchNumber">Batch Number *</Label>
                    <Input
                      id="batchNumber"
                      value={form.batchNumber}
                      onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date *</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price *</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      step="1"
                      min="0"
                      value={form.purchasePrice}
                      onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Select
                      value={form.supplierId}
                      onValueChange={(value) => setForm({ ...form, supplierId: value ?? "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g., Shelf A-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Add Batch</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive text-base">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alert ({lowStock?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock && lowStock.length > 0 ? (
              <div className="space-y-2 text-sm">
                {lowStock.slice(0, 3).map((p) => (
                  <div key={p._id} className="flex justify-between">
                    <span>{p.name}</span>
                    <Badge variant="destructive">{p.totalStock} / {p.minStock}</Badge>
                  </div>
                ))}
                {lowStock.length > 3 && (
                  <p className="text-muted-foreground">+{lowStock.length - 3} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No low stock alerts</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-500 text-base">
              <Clock className="h-4 w-4" />
              Expiring Soon ({expiring?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiring && expiring.length > 0 ? (
              <div className="space-y-2 text-sm">
                {expiring.slice(0, 3).map((item) => (
                  <div key={item._id} className="flex justify-between">
                    <span>{item.product?.name || "Unknown"}</span>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                      {formatDate(item.expiryDate)}
                    </Badge>
                  </div>
                ))}
                {expiring.length > 3 && (
                  <p className="text-muted-foreground">+{expiring.length - 3} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No items expiring soon</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Batches</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {inventory === undefined ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredInventory?.length === 0 ? (
            <div className="text-center py-8">
              <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No inventory found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory?.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-mono">{item.batchNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.product?.name || "-"}</p>
                        <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={item.quantity === 0 ? "text-red-500" : ""}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {formatDate(item.expiryDate)}
                        {isExpired(item.expiryDate) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                        {!isExpired(item.expiryDate) && isExpiringSoon(item.expiryDate) && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                            Soon
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(item.purchasePrice)}</TableCell>
                    <TableCell>{item.supplier?.name || "-"}</TableCell>
                    <TableCell>{item.location || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeletingId(item._id); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Inventory Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this inventory record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
