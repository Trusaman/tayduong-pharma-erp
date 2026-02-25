import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type { Id } from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Plus, BadgePercent, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/discounts")({
  component: DiscountsPage,
});

const discountTypes = ["Doctor", "hospital", "payment", "Salesman", "Manager"] as const;

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
    discountType: "Doctor" as (typeof discountTypes)[number],
    customerId: "",
    productId: "",
    salesmanId: "",
    discountPercent: "",
    createdByStaff: "",
    notes: "",
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
      toast.success("Salesman created");
      setSalesmanDialogOpen(false);
      setSalesmanForm({ name: "", code: "", phone: "", notes: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create salesman");
    }
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!discountForm.salesmanId) {
        toast.error("Please select salesman");
        return;
      }

      await createDiscount({
        name: discountForm.name,
        discountType: discountForm.discountType,
        customerId: discountForm.customerId
          ? (discountForm.customerId as Id<"customers">)
          : undefined,
        productId: discountForm.productId
          ? (discountForm.productId as Id<"products">)
          : undefined,
        salesmanId: discountForm.salesmanId as Id<"salesmen">,
        discountPercent: Number(discountForm.discountPercent),
        createdByStaff: discountForm.createdByStaff,
        notes: discountForm.notes || undefined,
      });

      toast.success("Discount rule created");
      setDiscountDialogOpen(false);
      setDiscountForm({
        name: "",
        discountType: "Doctor",
        customerId: "",
        productId: "",
        salesmanId: "",
        discountPercent: "",
        createdByStaff: "",
        notes: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create discount rule");
    }
  };

  const toggleRuleActive = async (id: Id<"discountRules">, isActive: boolean) => {
    try {
      await updateDiscount({ id, isActive: !isActive });
      toast.success("Discount rule updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update discount rule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Discounts</h2>
          <p className="text-muted-foreground">
            Manage customer/product discounts by salesman and discount type.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={salesmanDialogOpen} onOpenChange={setSalesmanDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Add Salesman
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateSalesman}>
                <DialogHeader>
                  <DialogTitle>Create Salesman</DialogTitle>
                  <DialogDescription>Add a salesman for discount assignments.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={salesmanForm.name}
                        onChange={(e) => setSalesmanForm({ ...salesmanForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code *</Label>
                      <Input
                        value={salesmanForm.code}
                        onChange={(e) => setSalesmanForm({ ...salesmanForm, code: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={salesmanForm.phone}
                        onChange={(e) => setSalesmanForm({ ...salesmanForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input
                        value={salesmanForm.notes}
                        onChange={(e) => setSalesmanForm({ ...salesmanForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Discount Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateDiscount}>
                <DialogHeader>
                  <DialogTitle>Create Discount Rule</DialogTitle>
                  <DialogDescription>
                    Staff can create different discounts for customer and medicine.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rule Name *</Label>
                      <Input
                        value={discountForm.name}
                        onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount Type *</Label>
                      <Select
                        value={discountForm.discountType}
                        onValueChange={(v) =>
                          v &&
                          setDiscountForm({
                            ...discountForm,
                            discountType: v as (typeof discountTypes)[number],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {discountTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Salesman *</Label>
                      <Select
                        value={discountForm.salesmanId}
                        onValueChange={(v) => v && setDiscountForm({ ...discountForm, salesmanId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select salesman" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesmen?.map((s) => (
                            <SelectItem key={s._id} value={s._id}>
                              {s.name} ({s.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Discount Percent (%) *</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={discountForm.discountPercent}
                        onChange={(e) =>
                          setDiscountForm({ ...discountForm, discountPercent: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Customer (optional)</Label>
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
                          <SelectValue placeholder="All customers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all-customers">All customers</SelectItem>
                          {customers?.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Medicine/Product (optional)</Label>
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
                          <SelectValue placeholder="All medicines" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all-products">All medicines</SelectItem>
                          {products?.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Created by Staff *</Label>
                      <Input
                        value={discountForm.createdByStaff}
                        onChange={(e) =>
                          setDiscountForm({ ...discountForm, createdByStaff: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={discountForm.notes}
                        onChange={(e) => setDiscountForm({ ...discountForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Rule</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discount Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules === undefined ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="text-muted-foreground">No discount rules yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Salesman</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-right">Percent</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule._id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <BadgePercent className="h-3 w-3" />
                        {rule.discountType}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.salesman?.name ?? "-"}</TableCell>
                    <TableCell>{rule.customer?.name ?? "All customers"}</TableCell>
                    <TableCell>{rule.product?.name ?? "All medicines"}</TableCell>
                    <TableCell className="text-right">{rule.discountPercent}%</TableCell>
                    <TableCell>{rule.createdByStaff}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={rule.isActive ? "secondary" : "outline"}
                        onClick={() => toggleRuleActive(rule._id, rule.isActive)}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
