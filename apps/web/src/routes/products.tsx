import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle, FolderPlus, Ruler } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
});

// Default units - can be extended with custom units
const DEFAULT_UNITS = [
  { value: "tablet", label: "Tablet" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
  { value: "vial", label: "Vial" },
  { value: "ampoule", label: "Ampoule" },
  { value: "tube", label: "Tube" },
  { value: "sachet", label: "Sachet" },
  { value: "piece", label: "Piece" },
  { value: "capsule", label: "Capsule" },
  { value: "syringe", label: "Syringe" },
  { value: "patch", label: "Patch" },
  { value: "cream", label: "Cream" },
  { value: "ointment", label: "Ointment" },
  { value: "drops", label: "Drops" },
  { value: "inhaler", label: "Inhaler" },
  { value: "suppository", label: "Suppository" },
];


interface ProductForm {
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  minStock: string;
}

const initialForm: ProductForm = {
  name: "",
  sku: "",
  categoryId: "",
  description: "",
  unit: "tablet",
  purchasePrice: "",
  salePrice: "",
  minStock: "0",
};

function ProductsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Quick add dialogs
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickUnitOpen, setQuickUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  const products = useQuery(api.products.listWithStock, { activeOnly: false });
  const categories = useQuery(api.categories.list);
  const customUnits = useQuery(api.units.list);

  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const deleteProduct = useMutation(api.products.remove);
  const createCategory = useMutation(api.categories.create);
  const createUnit = useMutation(api.units.create);

  // Combine default units with custom units from database
  const allUnits = [...DEFAULT_UNITS, ...(customUnits?.map(u => ({ value: u.value, label: u.name })) || [])];


  const filteredProducts = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleQuickAddCategory = async () => {
    if (!quickCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    try {
      const categoryId = await createCategory({
        name: quickCategoryName.trim(),
      });
      toast.success("Category created successfully");
      setQuickCategoryOpen(false);
      setQuickCategoryName("");
      setForm({ ...form, categoryId: categoryId as string });
    } catch (error: any) {
      toast.error(error.message || "Failed to create category");
    }
  };

  const handleQuickAddUnit = async () => {
    if (!newUnitName.trim()) {
      toast.error("Please enter a unit name");
      return;
    }
    const unitLower = newUnitName.trim().toLowerCase();
    if (allUnits.some(u => u.value === unitLower)) {
      toast.error("This unit already exists");
      return;
    }
    try {
      await createUnit({ name: newUnitName.trim() });
      toast.success("Unit added successfully");
      setForm({ ...form, unit: unitLower });
      setQuickUnitOpen(false);
      setNewUnitName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to add unit");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateProduct({
          id: editingId as any,
          name: form.name,
          sku: form.sku,
          categoryId: form.categoryId ? (form.categoryId as any) : undefined,
          description: form.description || undefined,
          unit: form.unit,
          purchasePrice: parseFloat(form.purchasePrice),
          salePrice: parseFloat(form.salePrice),
          minStock: parseInt(form.minStock),
        });
        toast.success("Product updated successfully");
      } else {
        await createProduct({
          name: form.name,
          sku: form.sku,
          categoryId: form.categoryId ? (form.categoryId as any) : undefined,
          description: form.description || undefined,
          unit: form.unit,
          purchasePrice: parseFloat(form.purchasePrice),
          salePrice: parseFloat(form.salePrice),
          minStock: parseInt(form.minStock),
        });
        toast.success("Product created successfully");
      }
      setDialogOpen(false);
      setForm(initialForm);
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId || "",
      description: product.description || "",
      unit: product.unit,
      purchasePrice: product.purchasePrice.toString(),
      salePrice: product.salePrice.toString(),
      minStock: product.minStock.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteProduct({ id: deletingId as any });
      toast.success("Product deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete product");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const getCategoryName = (categoryId: string | undefined) => {
    if (!categoryId || !categories) return "-";
    const category = categories.find((c) => c._id === categoryId);
    return category?.name || "-";
  };

  const getUnitLabel = (unitValue: string) => {
    const unit = allUnits.find(u => u.value === unitValue);
    return unit?.label || unitValue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setForm(initialForm); setEditingId(null); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
                <DialogDescription>
                  Fill in the product details below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category">Category</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-teal-600 hover:text-teal-700 px-2"
                        onClick={() => setQuickCategoryOpen(true)}
                      >
                        <FolderPlus className="mr-1 h-3 w-3" />
                        New
                      </Button>
                    </div>
                    <Select
                      value={form.categoryId || ""}
                      onValueChange={(v) => v && v !== "_none" && setForm({ ...form, categoryId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category">
                          {form.categoryId && categories?.find(c => c._id === form.categoryId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat._id} value={cat._id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                        {(!categories || categories.length === 0) && (
                          <SelectItem value="_none" disabled>
                            No categories - click New to add
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="unit">Unit *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-teal-600 hover:text-teal-700 px-2"
                        onClick={() => setQuickUnitOpen(true)}
                      >
                        <Ruler className="mr-1 h-3 w-3" />
                        New
                      </Button>
                    </div>
                    <Select
                      value={form.unit}
                      onValueChange={(v) => v && setForm({ ...form, unit: v })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {allUnits.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Sale Price *</Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="1"
                      min="0"
                      value={form.salePrice}
                      onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Minimum Stock Level</Label>
                  <Input
                    id="minStock"
                    type="number"
                    min="0"
                    value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editingId ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products === undefined ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredProducts?.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No products found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts?.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{getCategoryName(product.categoryId)}</TableCell>
                    <TableCell>{getUnitLabel(product.unit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.purchasePrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.salePrice)}</TableCell>
                    <TableCell className="text-center">
                      <span className={product.isLowStock ? "text-red-500 font-bold" : ""}>
                        {product.totalStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.isLowStock ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Low Stock
                        </Badge>
                      ) : product.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeletingId(product._id); setDeleteDialogOpen(true); }}
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
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
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

      {/* Quick Add Category Dialog */}
      <Dialog open={quickCategoryOpen} onOpenChange={setQuickCategoryOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-teal-600" />
              Quick Add Category
            </DialogTitle>
            <DialogDescription>
              Create a new product category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name *</Label>
              <Input
                id="categoryName"
                value={quickCategoryName}
                onChange={(e) => setQuickCategoryName(e.target.value)}
                placeholder="e.g., Antibiotics, Pain Relief"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleQuickAddCategory())}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCategoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddCategory}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Unit Dialog */}
      <Dialog open={quickUnitOpen} onOpenChange={setQuickUnitOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-teal-600" />
              Add New Unit
            </DialogTitle>
            <DialogDescription>
              Add a custom unit of measurement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unitName">Unit Name *</Label>
              <Input
                id="unitName"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g., Sachet, Strip, Blister"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleQuickAddUnit())}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This unit will be available for all products in this session.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickUnitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddUnit}>Add Unit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
