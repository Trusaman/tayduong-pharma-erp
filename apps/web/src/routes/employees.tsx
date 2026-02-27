import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
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

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

type Position =
  | "thử việc"
  | "học việc"
  | "chính thức"
  | "cộng tác viên"
  | "trưởng nhóm"
  | "trưởng phòng"
  | "phó giám đốc"
  | "giám đốc";

type TrackingStatus = "theo dõi" | "ngừng theo dõi";

const POSITIONS: { value: Position; label: string }[] = [
  { value: "thử việc", label: "Thử việc" },
  { value: "học việc", label: "Học việc" },
  { value: "chính thức", label: "Chính thức" },
  { value: "cộng tác viên", label: "Cộng tác viên" },
  { value: "trưởng nhóm", label: "Trưởng nhóm" },
  { value: "trưởng phòng", label: "Trưởng phòng" },
  { value: "phó giám đốc", label: "Phó giám đốc" },
  { value: "giám đốc", label: "Giám đốc" },
];

const POSITION_BADGE_COLORS: Record<Position, string> = {
  "thử việc": "bg-slate-100 text-slate-700",
  "học việc": "bg-blue-100 text-blue-700",
  "chính thức": "bg-green-100 text-green-700",
  "cộng tác viên": "bg-purple-100 text-purple-700",
  "trưởng nhóm": "bg-amber-100 text-amber-700",
  "trưởng phòng": "bg-orange-100 text-orange-700",
  "phó giám đốc": "bg-rose-100 text-rose-700",
  "giám đốc": "bg-red-100 text-red-700",
};

interface EmployeeForm {
  name: string;
  email: string;
  phone: string;
  position: Position;
  trackingStatus: TrackingStatus;
  joinedDate: string;
  resignationDate: string;
  notes: string;
}

const initialForm: EmployeeForm = {
  name: "",
  email: "",
  phone: "",
  position: "chính thức",
  trackingStatus: "theo dõi",
  joinedDate: "",
  resignationDate: "",
  notes: "",
};

function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TrackingStatus>(
    "all",
  );
  const [positionFilter, setPositionFilter] = useState<"all" | Position>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(initialForm);

  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [resignConfirm, setResignConfirm] = useState<any>(null);
  const [resignDate, setResignDate] = useState("");

  const employees = useQuery(api.employees.list, {});
  const createEmployee = useMutation(api.employees.create);
  const updateEmployee = useMutation(api.employees.update);
  const removeEmployee = useMutation(api.employees.remove);

  const filteredEmployees = employees?.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.phone.includes(search);
    const matchesStatus =
      statusFilter === "all" || e.trackingStatus === statusFilter;
    const matchesPosition =
      positionFilter === "all" || e.position === positionFilter;
    return matchesSearch && matchesStatus && matchesPosition;
  });

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("vi-VN");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.joinedDate) {
      toast.error("Vui lòng nhập ngày vào làm");
      return;
    }
    if (form.trackingStatus === "ngừng theo dõi" && !form.resignationDate) {
      toast.error(
        'Cần nhập ngày thôi việc khi trạng thái là "Ngừng theo dõi"',
      );
      return;
    }
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        position: form.position,
        trackingStatus: form.trackingStatus,
        joinedDate: new Date(form.joinedDate).getTime(),
        ...(form.resignationDate
          ? { resignationDate: new Date(form.resignationDate).getTime() }
          : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      };
      if (editingId) {
        await updateEmployee({ id: editingId as any, ...payload });
        toast.success("Đã cập nhật nhân viên");
      } else {
        await createEmployee(payload);
        toast.success("Đã thêm nhân viên");
      }
      setDialogOpen(false);
      setForm(initialForm);
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const handleEdit = (emp: any) => {
    setEditingId(emp._id);
    setForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      position: emp.position,
      trackingStatus: emp.trackingStatus,
      joinedDate: new Date(emp.joinedDate).toISOString().split("T")[0],
      resignationDate: emp.resignationDate
        ? new Date(emp.resignationDate).toISOString().split("T")[0]
        : "",
      notes: emp.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await removeEmployee({ id: deleteConfirm._id as any });
      toast.success("Đã xóa nhân viên");
    } catch (error: any) {
      toast.error(error.message || "Không thể xóa nhân viên");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleToggleTracking = (emp: any) => {
    if (emp.trackingStatus === "theo dõi") {
      setResignConfirm(emp);
      setResignDate("");
    } else {
      updateEmployee({
        id: emp._id as any,
        trackingStatus: "theo dõi",
      })
        .then(() => toast.success(`Đã theo dõi lại "${emp.name}"`))
        .catch((err: any) => toast.error(err.message));
    }
  };

  const handleConfirmResign = async () => {
    if (!resignConfirm || !resignDate) {
      toast.error("Vui lòng chọn ngày thôi việc");
      return;
    }
    try {
      await updateEmployee({
        id: resignConfirm._id as any,
        trackingStatus: "ngừng theo dõi",
        resignationDate: new Date(resignDate).getTime(),
      });
      toast.success(`Đã ngừng theo dõi "${resignConfirm.name}"`);
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    } finally {
      setResignConfirm(null);
      setResignDate("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl tracking-tight">Nhân viên</h2>
          <p className="text-muted-foreground">Quản lý thông tin nhân viên</p>
        </div>
        <Button
          onClick={() => {
            setForm(initialForm);
            setEditingId(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm nhân viên
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Tổng nhân viên",
            value: employees?.length ?? 0,
            color: "text-slate-700",
          },
          {
            label: "Đang theo dõi",
            value:
              employees?.filter((e) => e.trackingStatus === "theo dõi")
                .length ?? 0,
            color: "text-teal-600",
          },
          {
            label: "Ngừng theo dõi",
            value:
              employees?.filter((e) => e.trackingStatus === "ngừng theo dõi")
                .length ?? 0,
            color: "text-rose-600",
          },
          {
            label: "Chính thức",
            value:
              employees?.filter((e) => e.position === "chính thức").length ??
              0,
            color: "text-green-700",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className={`mt-1 font-bold text-2xl ${stat.color}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Danh sách nhân viên</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52">
                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tên, email, SĐT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={positionFilter}
                onValueChange={(v) =>
                  v && setPositionFilter(v as typeof positionFilter)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vị trí</SelectItem>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  v && setStatusFilter(v as typeof statusFilter)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="theo dõi">Đang theo dõi</SelectItem>
                  <SelectItem value="ngừng theo dõi">Ngừng theo dõi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {employees === undefined ? (
            <div className="py-8 text-center text-muted-foreground">
              Đang tải...
            </div>
          ) : filteredEmployees?.length === 0 ? (
            <div className="py-8 text-center">
              <UserCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Không tìm thấy nhân viên</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Vị trí</TableHead>
                  <TableHead>Ngày vào làm</TableHead>
                  <TableHead>Ngày thôi việc</TableHead>
                  <TableHead className="text-center">Theo dõi</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees?.map((emp) => (
                  <TableRow
                    key={emp._id}
                    className={
                      emp.trackingStatus === "ngừng theo dõi" ? "opacity-60" : ""
                    }
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        {emp.notes && (
                          <p className="text-muted-foreground text-xs">
                            {emp.notes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{emp.email}</p>
                        <p className="text-muted-foreground">{emp.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${POSITION_BADGE_COLORS[emp.position as Position]}`}
                      >
                        {emp.position}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(emp.joinedDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {emp.resignationDate
                        ? formatDate(emp.resignationDate)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant={
                          emp.trackingStatus === "theo dõi"
                            ? "outline"
                            : "secondary"
                        }
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleToggleTracking(emp)}
                      >
                        {emp.trackingStatus === "theo dõi" ? (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Theo dõi
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Ngừng
                          </>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(emp)}
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

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setForm(initialForm);
            setEditingId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Sửa nhân viên" : "Thêm nhân viên"}
              </DialogTitle>
              <DialogDescription>
                Nhập đầy đủ thông tin nhân viên.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-name">Họ tên *</Label>
                  <Input
                    id="emp-name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-phone">Số điện thoại *</Label>
                  <Input
                    id="emp-phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="emp-email">Email *</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  required
                />
              </div>

              {/* Position & Tracking Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vị trí *</Label>
                  <Select
                    value={form.position}
                    onValueChange={(v) =>
                      v && setForm({ ...form, position: v as Position })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái *</Label>
                  <Select
                    value={form.trackingStatus}
                    onValueChange={(v) =>
                      v &&
                      setForm({
                        ...form,
                        trackingStatus: v as TrackingStatus,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theo dõi">Đang theo dõi</SelectItem>
                      <SelectItem value="ngừng theo dõi">
                        Ngừng theo dõi
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-joined">Ngày vào làm *</Label>
                  <Input
                    id="emp-joined"
                    type="date"
                    value={form.joinedDate}
                    onChange={(e) =>
                      setForm({ ...form, joinedDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-resign">
                    Ngày thôi việc
                    {form.trackingStatus === "ngừng theo dõi" && " *"}
                  </Label>
                  <Input
                    id="emp-resign"
                    type="date"
                    value={form.resignationDate}
                    onChange={(e) =>
                      setForm({ ...form, resignationDate: e.target.value })
                    }
                    required={form.trackingStatus === "ngừng theo dõi"}
                  />
                </div>
              </div>

              {form.trackingStatus === "ngừng theo dõi" && (
                <p className="rounded-md bg-orange-50 px-3 py-2 text-orange-700 text-sm">
                  ⚠️ Nhân viên sẽ được đánh dấu không còn làm việc. Vui lòng
                  điền ngày thôi việc.
                </p>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="emp-notes">Ghi chú</Label>
                <Textarea
                  id="emp-notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Ghi chú thêm..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit">
                {editingId ? "Cập nhật" : "Thêm nhân viên"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resign Confirmation Dialog */}
      <Dialog
        open={!!resignConfirm}
        onOpenChange={(open) => !open && setResignConfirm(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-orange-500" />
              Xác nhận ngừng theo dõi
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-3 pt-1">
                <p>
                  Bạn đang ngừng theo dõi nhân viên{" "}
                  <strong>{resignConfirm?.name}</strong>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="resign-date-confirm">Ngày thôi việc *</Label>
                  <Input
                    id="resign-date-confirm"
                    type="date"
                    value={resignDate}
                    onChange={(e) => setResignDate(e.target.value)}
                  />
                </div>
                <p className="text-orange-600 text-sm">
                  ⚠️ Nhân viên sẽ được đánh dấu đã thôi việc. Thông tin lịch
                  sử vẫn được giữ nguyên.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResignConfirm(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmResign}
              disabled={!resignDate}
            >
              Ngừng theo dõi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa nhân viên</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa nhân viên{" "}
              <strong>{deleteConfirm?.name}</strong>? Hành động này không thể
              hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
