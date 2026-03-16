import { createFileRoute } from "@tanstack/react-router";
import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import type {
	Doc,
	Id,
} from "@tayduong-pharma-erp/backend/convex/_generated/dataModel";
import { env } from "@tayduong-pharma-erp/env/web";
import { useMutation, useQuery } from "convex/react";
import {
	Download,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
type Gender = "nam" | "nu";

interface BankAccountForm {
	rowId: string;
	accountNumber: string;
	bankName: string;
	branch: string;
	bankProvinceCity: string;
}

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

const CONTRACT_TYPES = [
	"Cư trú và có HĐLĐ từ 3 tháng trở lên",
	"Cư trú và có HĐLĐ dưới 3 tháng",
	"Không cư trú",
] as const;

let bankAccountSequence = 0;

const createBankAccount = (): BankAccountForm => ({
	rowId: `bank-account-${++bankAccountSequence}`,
	accountNumber: "",
	bankName: "",
	branch: "",
	bankProvinceCity: "",
});

interface EmployeeForm {
	employeeCode: string;
	name: string;
	gender: Gender;
	birthDate: string;
	identityNumber: string;
	identityIssuedDate: string;
	identityIssuedPlace: string;
	nationality: string;
	passportNumber: string;
	email: string;
	phone: string;
	department: string;
	position: Position;
	taxId: string;
	agreedSalary: string;
	salaryCoefficient: string;
	insuranceSalary: string;
	contractType: string;
	dependentCount: string;
	customerSupplierGroup: string;
	bankAccounts: BankAccountForm[];
	trackingStatus: TrackingStatus;
	joinedDate: string;
	resignationDate: string;
	notes: string;
}

interface EmployeeImageUploadInput {
	storageId: Id<"_storage">;
	originalFileName: string;
	contentType: string;
	size: number;
}

type EmployeeRecord = Doc<"employees">;

type EmployeeListItem = EmployeeRecord & {
	portraitImageUrl: string | null;
	identityCardImageUrl: string | null;
};

const initialForm: EmployeeForm = {
	employeeCode: "",
	name: "",
	gender: "nam",
	birthDate: "",
	identityNumber: "",
	identityIssuedDate: "",
	identityIssuedPlace: "",
	nationality: "Việt Nam",
	passportNumber: "",
	email: "",
	phone: "",
	department: "",
	position: "chính thức",
	taxId: "",
	agreedSalary: "",
	salaryCoefficient: "",
	insuranceSalary: "",
	contractType: CONTRACT_TYPES[0],
	dependentCount: "0",
	customerSupplierGroup: "",
	bankAccounts: [createBankAccount()],
	trackingStatus: "theo dõi",
	joinedDate: "",
	resignationDate: "",
	notes: "",
};

const toDateInputValue = (timestamp?: number) => {
	if (!timestamp) return "";
	return new Date(timestamp).toISOString().slice(0, 10);
};

const parseOptionalDate = (value: string) => {
	return value ? Date.parse(`${value}T00:00:00.000Z`) : undefined;
};

const parseOptionalNumber = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number.parseFloat(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalInteger = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
};

const getErrorMessage = (error: unknown, fallback: string) => {
	return error instanceof Error ? error.message : fallback;
};

const readFileAsDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			resolve(typeof reader.result === "string" ? reader.result : "");
		reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh"));
		reader.readAsDataURL(file);
	});

const validateImageFile = (file: File) => {
	if (!file.type.startsWith("image/")) {
		throw new Error("Vui lòng chọn tệp hình ảnh hợp lệ");
	}
	if (file.size > 5 * 1024 * 1024) {
		throw new Error("Dung lượng ảnh tối đa là 5MB");
	}
};

const sanitizeBankAccounts = (bankAccounts: BankAccountForm[]) => {
	const sanitized = bankAccounts.filter((account) =>
		[
			account.accountNumber,
			account.bankName,
			account.branch,
			account.bankProvinceCity,
		].some((value) => value.trim() !== ""),
	);
	return sanitized.length > 0
		? sanitized.map(({ rowId: _rowId, ...account }) => account)
		: undefined;
};

const getStorageFallbackUrl = (storageId?: Id<"_storage">) => {
	if (!storageId) return null;
	const baseUrl = env.VITE_CONVEX_SITE_URL?.replace(/\/$/, "");
	if (!baseUrl) return null;
	return `${baseUrl}/api/storage/${storageId}`;
};

const getPortraitImageUrl = (employee: EmployeeListItem) =>
	employee.portraitImageUrl ??
	getStorageFallbackUrl(employee.portraitImage?.storageId);

const getIdentityCardImageUrl = (employee: EmployeeListItem) =>
	employee.identityCardImageUrl ??
	getStorageFallbackUrl(employee.identityCardImage?.storageId);

function EmployeesPage() {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | TrackingStatus>(
		"all",
	);
	const [positionFilter, setPositionFilter] = useState<"all" | Position>("all");

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<Id<"employees"> | null>(null);
	const [form, setForm] = useState<EmployeeForm>(initialForm);
	const [activeTab, setActiveTab] = useState("general");
	const [portraitPreviewUrl, setPortraitPreviewUrl] = useState("");
	const [identityCardPreviewUrl, setIdentityCardPreviewUrl] = useState("");
	const [pendingPortraitFile, setPendingPortraitFile] = useState<File | null>(
		null,
	);
	const [pendingIdentityCardFile, setPendingIdentityCardFile] =
		useState<File | null>(null);
	const [removePortraitImage, setRemovePortraitImage] = useState(false);
	const [removeIdentityCardImage, setRemoveIdentityCardImage] = useState(false);
	const [isSavingImages, setIsSavingImages] = useState(false);

	const [deleteConfirm, setDeleteConfirm] = useState<EmployeeRecord | null>(
		null,
	);
	const [resignConfirm, setResignConfirm] = useState<EmployeeRecord | null>(
		null,
	);
	const [previewEmployee, setPreviewEmployee] =
		useState<EmployeeListItem | null>(null);
	const [resignDate, setResignDate] = useState("");

	const employees = useQuery(api.employees.list, {}) as
		| EmployeeListItem[]
		| undefined;
	const createEmployee = useMutation(api.employees.create);
	const updateEmployee = useMutation(api.employees.update);
	const removeEmployee = useMutation(api.employees.remove);
	const generateUploadUrl = useMutation(api.employees.generateUploadUrl);
	const deleteUploadedFile = useMutation(api.employees.deleteUploadedFile);

	const filteredEmployees = employees?.filter((e) => {
		const matchesSearch =
			e.name.toLowerCase().includes(search.toLowerCase()) ||
			(e.employeeCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
			(e.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
			e.email.toLowerCase().includes(search.toLowerCase()) ||
			e.phone.includes(search);
		const matchesStatus =
			statusFilter === "all" || e.trackingStatus === statusFilter;
		const matchesPosition =
			positionFilter === "all" || e.position === positionFilter;
		return matchesSearch && matchesStatus && matchesPosition;
	});
	const previewPortraitImage = previewEmployee?.portraitImage;
	const previewPortraitImageUrl = previewEmployee
		? getPortraitImageUrl(previewEmployee)
		: null;
	const previewIdentityCardImage = previewEmployee?.identityCardImage;
	const previewIdentityCardImageUrl = previewEmployee
		? getIdentityCardImageUrl(previewEmployee)
		: null;

	const formatDate = (ts: number) => new Date(ts).toLocaleDateString("vi-VN");

	const downloadFile = (url: string, fileName: string) => {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = fileName;
		anchor.rel = "noopener noreferrer";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	};

	const updateField = <K extends keyof EmployeeForm>(
		field: K,
		value: EmployeeForm[K],
	) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const updateBankAccountField = (
		index: number,
		field: keyof BankAccountForm,
		value: string,
	) => {
		setForm((current) => ({
			...current,
			bankAccounts: current.bankAccounts.map((account, accountIndex) =>
				accountIndex === index ? { ...account, [field]: value } : account,
			),
		}));
	};

	const addBankAccountRow = () => {
		setForm((current) => ({
			...current,
			bankAccounts: [...current.bankAccounts, createBankAccount()],
		}));
	};

	const removeBankAccountRow = (index: number) => {
		setForm((current) => ({
			...current,
			bankAccounts:
				current.bankAccounts.length === 1
					? [createBankAccount()]
					: current.bankAccounts.filter(
							(_, accountIndex) => accountIndex !== index,
						),
		}));
	};

	const handleImageSelection = async (
		file: File | undefined,
		type: "portrait" | "identityCard",
	) => {
		if (!file) return;
		try {
			validateImageFile(file);
			const previewUrl = await readFileAsDataUrl(file);
			if (type === "portrait") {
				setPendingPortraitFile(file);
				setPortraitPreviewUrl(previewUrl);
				setRemovePortraitImage(false);
			} else {
				setPendingIdentityCardFile(file);
				setIdentityCardPreviewUrl(previewUrl);
				setRemoveIdentityCardImage(false);
			}
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể chọn ảnh"));
		}
	};

	const clearSelectedImage = (type: "portrait" | "identityCard") => {
		if (type === "portrait") {
			setPendingPortraitFile(null);
			setPortraitPreviewUrl("");
			setRemovePortraitImage(true);
		} else {
			setPendingIdentityCardFile(null);
			setIdentityCardPreviewUrl("");
			setRemoveIdentityCardImage(true);
		}
	};

	const uploadEmployeeImage = async (
		file: File,
	): Promise<EmployeeImageUploadInput> => {
		const uploadUrl = await generateUploadUrl();
		const response = await fetch(uploadUrl, {
			method: "POST",
			headers: { "Content-Type": file.type },
			body: file,
		});

		if (!response.ok) {
			throw new Error("Không thể tải ảnh lên máy chủ");
		}

		const result = (await response.json()) as { storageId?: Id<"_storage"> };
		if (!result.storageId) {
			throw new Error("Máy chủ không trả về tệp ảnh hợp lệ");
		}

		return {
			storageId: result.storageId,
			originalFileName: file.name,
			contentType: file.type,
			size: file.size,
		};
	};

	const resetDialogState = () => {
		setForm(initialForm);
		setEditingId(null);
		setActiveTab("general");
		setPortraitPreviewUrl("");
		setIdentityCardPreviewUrl("");
		setPendingPortraitFile(null);
		setPendingIdentityCardFile(null);
		setRemovePortraitImage(false);
		setRemoveIdentityCardImage(false);
		setIsSavingImages(false);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.joinedDate) {
			toast.error("Vui lòng nhập ngày vào làm");
			return;
		}
		if (form.trackingStatus === "ngừng theo dõi" && !form.resignationDate) {
			toast.error('Cần nhập ngày thôi việc khi trạng thái là "Ngừng theo dõi"');
			return;
		}
		const uploadedStorageIds: Id<"_storage">[] = [];
		try {
			setIsSavingImages(true);
			const portraitUpload = pendingPortraitFile
				? await uploadEmployeeImage(pendingPortraitFile)
				: undefined;
			const identityCardUpload = pendingIdentityCardFile
				? await uploadEmployeeImage(pendingIdentityCardFile)
				: undefined;

			if (portraitUpload) {
				uploadedStorageIds.push(portraitUpload.storageId);
			}
			if (identityCardUpload) {
				uploadedStorageIds.push(identityCardUpload.storageId);
			}

			const payload = {
				...(portraitUpload ? { portraitUpload } : {}),
				...(identityCardUpload ? { identityCardUpload } : {}),
				employeeCode: form.employeeCode || undefined,
				name: form.name,
				gender: form.gender,
				birthDate: parseOptionalDate(form.birthDate),
				identityNumber: form.identityNumber || undefined,
				identityIssuedDate: parseOptionalDate(form.identityIssuedDate),
				identityIssuedPlace: form.identityIssuedPlace || undefined,
				nationality: form.nationality || undefined,
				passportNumber: form.passportNumber || undefined,
				email: form.email,
				phone: form.phone,
				department: form.department || undefined,
				position: form.position,
				taxId: form.taxId || undefined,
				agreedSalary: parseOptionalNumber(form.agreedSalary),
				salaryCoefficient: parseOptionalNumber(form.salaryCoefficient),
				insuranceSalary: parseOptionalNumber(form.insuranceSalary),
				contractType: form.contractType || undefined,
				dependentCount: parseOptionalInteger(form.dependentCount),
				customerSupplierGroup: form.customerSupplierGroup || undefined,
				bankAccounts: sanitizeBankAccounts(form.bankAccounts),
				trackingStatus: form.trackingStatus,
				joinedDate: Date.parse(`${form.joinedDate}T00:00:00.000Z`),
				...(editingId ? { removePortraitImage } : {}),
				...(editingId ? { removeIdentityCardImage } : {}),
				...(form.resignationDate
					? {
							resignationDate: Date.parse(
								`${form.resignationDate}T00:00:00.000Z`,
							),
						}
					: {}),
				...(form.notes ? { notes: form.notes } : {}),
			};
			if (editingId) {
				await updateEmployee({ id: editingId, ...payload });
				toast.success("Đã cập nhật nhân viên");
			} else {
				await createEmployee(payload);
				toast.success("Đã thêm nhân viên");
			}
			setDialogOpen(false);
			resetDialogState();
		} catch (error: unknown) {
			if (uploadedStorageIds.length > 0) {
				await Promise.allSettled(
					uploadedStorageIds.map((storageId) =>
						deleteUploadedFile({ storageId }),
					),
				);
			}
			toast.error(getErrorMessage(error, "Có lỗi xảy ra"));
		} finally {
			setIsSavingImages(false);
		}
	};

	const handleEdit = (emp: EmployeeListItem) => {
		setEditingId(emp._id);
		setForm({
			employeeCode: emp.employeeCode || "",
			name: emp.name,
			gender: emp.gender || "nam",
			birthDate: toDateInputValue(emp.birthDate),
			identityNumber: emp.identityNumber || "",
			identityIssuedDate: toDateInputValue(emp.identityIssuedDate),
			identityIssuedPlace: emp.identityIssuedPlace || "",
			nationality: emp.nationality || "Việt Nam",
			passportNumber: emp.passportNumber || "",
			email: emp.email,
			phone: emp.phone,
			department: emp.department || "",
			position: emp.position,
			taxId: emp.taxId || "",
			agreedSalary:
				typeof emp.agreedSalary === "number" ? String(emp.agreedSalary) : "",
			salaryCoefficient:
				typeof emp.salaryCoefficient === "number"
					? String(emp.salaryCoefficient)
					: "",
			insuranceSalary:
				typeof emp.insuranceSalary === "number"
					? String(emp.insuranceSalary)
					: "",
			contractType: emp.contractType || CONTRACT_TYPES[0],
			dependentCount:
				typeof emp.dependentCount === "number"
					? String(emp.dependentCount)
					: "0",
			customerSupplierGroup: emp.customerSupplierGroup || "",
			bankAccounts:
				emp.bankAccounts && emp.bankAccounts.length > 0
					? emp.bankAccounts.map((account) => ({
							...createBankAccount(),
							...account,
						}))
					: [createBankAccount()],
			trackingStatus: emp.trackingStatus,
			joinedDate: toDateInputValue(emp.joinedDate),
			resignationDate: toDateInputValue(emp.resignationDate),
			notes: emp.notes || "",
		});
		setPortraitPreviewUrl(getPortraitImageUrl(emp) ?? "");
		setIdentityCardPreviewUrl(getIdentityCardImageUrl(emp) ?? "");
		setPendingPortraitFile(null);
		setPendingIdentityCardFile(null);
		setRemovePortraitImage(false);
		setRemoveIdentityCardImage(false);
		setActiveTab("general");
		setDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!deleteConfirm) return;
		try {
			await removeEmployee({ id: deleteConfirm._id });
			toast.success("Đã xóa nhân viên");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Không thể xóa nhân viên"));
		} finally {
			setDeleteConfirm(null);
		}
	};

	const handlePreviewEmployee = (employee: EmployeeListItem) => {
		setPreviewEmployee(employee);
	};

	const handleToggleTracking = (emp: EmployeeRecord) => {
		if (emp.trackingStatus === "theo dõi") {
			setResignConfirm(emp);
			setResignDate("");
		} else {
			updateEmployee({
				id: emp._id,
				trackingStatus: "theo dõi",
			})
				.then(() => toast.success(`Đã theo dõi lại "${emp.name}"`))
				.catch((error: unknown) =>
					toast.error(getErrorMessage(error, "Có lỗi xảy ra")),
				);
		}
	};

	const handleConfirmResign = async () => {
		if (!resignConfirm || !resignDate) {
			toast.error("Vui lòng chọn ngày thôi việc");
			return;
		}
		try {
			await updateEmployee({
				id: resignConfirm._id,
				trackingStatus: "ngừng theo dõi",
				resignationDate: Date.parse(`${resignDate}T00:00:00.000Z`),
			});
			toast.success(`Đã ngừng theo dõi "${resignConfirm.name}"`);
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Có lỗi xảy ra"));
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
						resetDialogState();
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
							employees?.filter((e) => e.position === "chính thức").length ?? 0,
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
									<TableHead>Ảnh</TableHead>
									<TableHead>Mã NV</TableHead>
									<TableHead>Họ tên</TableHead>
									<TableHead>Đơn vị</TableHead>
									<TableHead>Liên hệ</TableHead>
									<TableHead>Mã số thuế</TableHead>
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
											emp.trackingStatus === "ngừng theo dõi"
												? "opacity-60"
												: ""
										}
									>
									<TableCell>
										{getPortraitImageUrl(emp) ? (
											<img
												src={getPortraitImageUrl(emp) ?? ""}
												alt={`Ảnh ${emp.name}`}
												className="h-12 w-12 rounded-md object-cover ring-1 ring-border"
											/>
											) : (
												<div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
													Chưa có
												</div>
											)}
										</TableCell>
										<TableCell className="font-mono text-xs">
											{emp.employeeCode || "—"}
										</TableCell>
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
										<TableCell className="text-sm">
											{emp.department || "—"}
										</TableCell>
										<TableCell>
											<div className="text-sm">
												<p>{emp.email}</p>
												<p className="text-muted-foreground">{emp.phone}</p>
											</div>
										</TableCell>
										<TableCell className="text-sm">
											{emp.taxId || "—"}
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${POSITION_BADGE_COLORS[emp.position as Position]}`}
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
												title="Xem hồ sơ ảnh"
												onClick={() => handlePreviewEmployee(emp)}
											>
												<Eye className="h-4 w-4 text-sky-600" />
											</Button>
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
						resetDialogState();
					}
				}}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[980px]">
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>
								{editingId ? "Sửa nhân viên" : "Thêm nhân viên"}
							</DialogTitle>
							<DialogDescription>
								Bổ sung đầy đủ hồ sơ nhân viên theo từng nhóm thông tin.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<Tabs value={activeTab} onValueChange={setActiveTab}>
								<TabsList className="bg-muted">
									<TabsTrigger
										value="general"
										className="data-active:bg-background"
									>
										1. Thông tin chung
									</TabsTrigger>
									<TabsTrigger
										value="other"
										className="data-active:bg-background"
									>
										2. Khác
									</TabsTrigger>
								</TabsList>

								<TabsContent value="general" className="mt-4 space-y-4">
									<div className="rounded-lg border bg-muted/20 p-4">
										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="employeeCode">Mã nhân viên</Label>
												<Input
													id="employeeCode"
													value={form.employeeCode}
													onChange={(e) =>
														updateField("employeeCode", e.target.value)
													}
													placeholder="Ví dụ: CTV-TUANANH1"
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="emp-name">Tên nhân viên *</Label>
												<Input
													id="emp-name"
													value={form.name}
													onChange={(e) => updateField("name", e.target.value)}
													required
												/>
											</div>
											<div className="space-y-2">
												<Label>Giới tính</Label>
												<div className="flex h-10 items-center gap-6 rounded-md border px-3">
													<label className="flex items-center gap-2 text-sm">
														<input
															type="radio"
															name="gender"
															checked={form.gender === "nam"}
															onChange={() => updateField("gender", "nam")}
														/>
														Nam
													</label>
													<label className="flex items-center gap-2 text-sm">
														<input
															type="radio"
															name="gender"
															checked={form.gender === "nu"}
															onChange={() => updateField("gender", "nu")}
														/>
														Nữ
													</label>
												</div>
											</div>
											<div className="space-y-2">
												<Label htmlFor="birthDate">Ngày sinh</Label>
												<Input
													id="birthDate"
													type="date"
													value={form.birthDate}
													onChange={(e) =>
														updateField("birthDate", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="position">Chức danh</Label>
												<Select
													value={form.position}
													onValueChange={(value) =>
														updateField("position", value as Position)
													}
												>
													<SelectTrigger id="position">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{POSITIONS.map((position) => (
															<SelectItem
																key={position.value}
																value={position.value}
															>
																{position.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="identityNumber">Số CCCD</Label>
												<Input
													id="identityNumber"
													value={form.identityNumber}
													onChange={(e) =>
														updateField("identityNumber", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="department">Đơn vị</Label>
												<Input
													id="department"
													value={form.department}
													onChange={(e) =>
														updateField("department", e.target.value)
													}
													placeholder="Ví dụ: Phòng kinh doanh"
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="identityIssuedDate">Ngày cấp</Label>
												<Input
													id="identityIssuedDate"
													type="date"
													value={form.identityIssuedDate}
													onChange={(e) =>
														updateField("identityIssuedDate", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="taxId">Mã số thuế</Label>
												<Input
													id="taxId"
													value={form.taxId}
													onChange={(e) => updateField("taxId", e.target.value)}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="identityIssuedPlace">Nơi cấp</Label>
												<Input
													id="identityIssuedPlace"
													value={form.identityIssuedPlace}
													onChange={(e) =>
														updateField("identityIssuedPlace", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="agreedSalary">Lương thỏa thuận</Label>
												<Input
													id="agreedSalary"
													type="number"
													min="0"
													value={form.agreedSalary}
													onChange={(e) =>
														updateField("agreedSalary", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="nationality">Quốc tịch</Label>
												<Input
													id="nationality"
													value={form.nationality}
													onChange={(e) =>
														updateField("nationality", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="salaryCoefficient">Hệ số lương</Label>
												<Input
													id="salaryCoefficient"
													type="number"
													step="0.01"
													min="0"
													value={form.salaryCoefficient}
													onChange={(e) =>
														updateField("salaryCoefficient", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="passportNumber">Số hộ chiếu</Label>
												<Input
													id="passportNumber"
													value={form.passportNumber}
													onChange={(e) =>
														updateField("passportNumber", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="insuranceSalary">Lương đóng BH</Label>
												<Input
													id="insuranceSalary"
													type="number"
													min="0"
													value={form.insuranceSalary}
													onChange={(e) =>
														updateField("insuranceSalary", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2 md:col-span-2">
												<Label htmlFor="contractType">Loại hợp đồng</Label>
												<Select
													value={form.contractType}
													onValueChange={(value) =>
														value && updateField("contractType", value)
													}
												>
													<SelectTrigger id="contractType">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{CONTRACT_TYPES.map((contractType) => (
															<SelectItem
																key={contractType}
																value={contractType}
															>
																{contractType}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="dependentCount">
													Số người phụ thuộc
												</Label>
												<Input
													id="dependentCount"
													type="number"
													min="0"
													value={form.dependentCount}
													onChange={(e) =>
														updateField("dependentCount", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2 md:col-span-2">
												<Label htmlFor="customerSupplierGroup">
													Nhóm KH, NCC
												</Label>
												<Input
													id="customerSupplierGroup"
													value={form.customerSupplierGroup}
													onChange={(e) =>
														updateField("customerSupplierGroup", e.target.value)
													}
												/>
											</div>
										</div>
									</div>

									<div className="rounded-lg border bg-muted/20 p-4">
										<div className="mb-4 flex items-center justify-between">
											<div>
												<h3 className="font-semibold text-base">
													Tài khoản ngân hàng
												</h3>
												<p className="text-muted-foreground text-sm">
													Bổ sung một hoặc nhiều tài khoản nhận lương/thanh
													toán.
												</p>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={addBankAccountRow}
											>
												Thêm tài khoản
											</Button>
										</div>
										<div className="space-y-3">
											{form.bankAccounts.map((account, index) => (
												<div
													key={account.rowId}
													className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]"
												>
													<Input
														value={account.accountNumber}
														onChange={(e) =>
															updateBankAccountField(
																index,
																"accountNumber",
																e.target.value,
															)
														}
														placeholder="Số tài khoản"
													/>
													<Input
														value={account.bankName}
														onChange={(e) =>
															updateBankAccountField(
																index,
																"bankName",
																e.target.value,
															)
														}
														placeholder="Tên ngân hàng"
													/>
													<Input
														value={account.branch}
														onChange={(e) =>
															updateBankAccountField(
																index,
																"branch",
																e.target.value,
															)
														}
														placeholder="Chi nhánh"
													/>
													<Input
														value={account.bankProvinceCity}
														onChange={(e) =>
															updateBankAccountField(
																index,
																"bankProvinceCity",
																e.target.value,
															)
														}
														placeholder="Tỉnh/TP ngân hàng"
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => removeBankAccountRow(index)}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</div>
											))}
										</div>
									</div>
								</TabsContent>

								<TabsContent value="other" className="mt-4 space-y-4">
									<div className="rounded-lg border bg-muted/20 p-4">
										<div className="mb-4 flex items-center justify-between">
											<div>
												<h3 className="font-semibold text-base">Hồ sơ ảnh</h3>
												<p className="text-muted-foreground text-sm">
													Ảnh được tải lên máy chủ và lưu kèm đường dẫn logic
													theo thư mục nhân viên.
												</p>
											</div>
											{isSavingImages && (
												<span className="text-muted-foreground text-sm">
													Đang lưu ảnh...
												</span>
											)}
										</div>
										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-3 rounded-md border bg-background p-4">
												<div className="space-y-1">
													<Label htmlFor="portraitImage">Ảnh cá nhân</Label>
													<p className="text-muted-foreground text-xs">
														PNG/JPG, tối đa 5MB.
													</p>
												</div>
												<div className="flex h-48 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
													{portraitPreviewUrl ? (
														<img
															src={portraitPreviewUrl}
															alt="Ảnh cá nhân"
															className="h-full w-full object-cover"
														/>
													) : (
														<span className="text-muted-foreground text-sm">
															Chưa có ảnh cá nhân
														</span>
													)}
												</div>
												<Input
													id="portraitImage"
													type="file"
													accept="image/*"
													onChange={(e) =>
														void handleImageSelection(
															e.target.files?.[0],
															"portrait",
														)
													}
												/>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => clearSelectedImage("portrait")}
														disabled={
															!portraitPreviewUrl && !pendingPortraitFile
														}
													>
														Gỡ ảnh
													</Button>
												</div>
											</div>
											<div className="space-y-3 rounded-md border bg-background p-4">
												<div className="space-y-1">
													<Label htmlFor="identityCardImage">
														Ảnh căn cước
													</Label>
													<p className="text-muted-foreground text-xs">
														Ảnh chụp thẻ căn cước, tối đa 5MB.
													</p>
												</div>
												<div className="flex h-48 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
													{identityCardPreviewUrl ? (
														<img
															src={identityCardPreviewUrl}
															alt="Ảnh căn cước"
															className="h-full w-full object-cover"
														/>
													) : (
														<span className="text-muted-foreground text-sm">
															Chưa có ảnh căn cước
														</span>
													)}
												</div>
												<Input
													id="identityCardImage"
													type="file"
													accept="image/*"
													onChange={(e) =>
														void handleImageSelection(
															e.target.files?.[0],
															"identityCard",
														)
													}
												/>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => clearSelectedImage("identityCard")}
														disabled={
															!identityCardPreviewUrl &&
															!pendingIdentityCardFile
														}
													>
														Gỡ ảnh
													</Button>
												</div>
											</div>
										</div>
									</div>

									<div className="rounded-lg border bg-muted/20 p-4">
										<div className="mb-4">
											<h3 className="font-semibold text-base">
												Thông tin liên hệ và quản lý
											</h3>
										</div>
										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="emp-phone">Số điện thoại *</Label>
												<Input
													id="emp-phone"
													value={form.phone}
													onChange={(e) => updateField("phone", e.target.value)}
													required
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="emp-email">Email *</Label>
												<Input
													id="emp-email"
													type="email"
													value={form.email}
													onChange={(e) => updateField("email", e.target.value)}
													required
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="emp-joined">Ngày vào làm *</Label>
												<Input
													id="emp-joined"
													type="date"
													value={form.joinedDate}
													onChange={(e) =>
														updateField("joinedDate", e.target.value)
													}
													required
												/>
											</div>
											<div className="space-y-2">
												<Label>Trạng thái theo dõi *</Label>
												<Select
													value={form.trackingStatus}
													onValueChange={(value) =>
														updateField(
															"trackingStatus",
															value as TrackingStatus,
														)
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="theo dõi">
															Đang theo dõi
														</SelectItem>
														<SelectItem value="ngừng theo dõi">
															Ngừng theo dõi
														</SelectItem>
													</SelectContent>
												</Select>
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
														updateField("resignationDate", e.target.value)
													}
													required={form.trackingStatus === "ngừng theo dõi"}
												/>
											</div>
											<div className="space-y-2 md:col-span-2">
												<Label htmlFor="emp-notes">Ghi chú</Label>
												<Textarea
													id="emp-notes"
													value={form.notes}
													onChange={(e) => updateField("notes", e.target.value)}
													placeholder="Ghi chú thêm..."
													rows={3}
												/>
											</div>
										</div>

										{form.trackingStatus === "ngừng theo dõi" && (
											<p className="mt-4 rounded-md bg-orange-50 px-3 py-2 text-orange-700 text-sm">
												Nhân viên sẽ được đánh dấu không còn làm việc. Vui lòng
												điền ngày thôi việc.
											</p>
										)}
									</div>
								</TabsContent>
							</Tabs>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDialogOpen(false)}
							>
								Hủy
							</Button>
							<Button type="submit" disabled={isSavingImages}>
								{isSavingImages
									? "Đang lưu..."
									: editingId
										? "Cập nhật"
										: "Thêm nhân viên"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Image Preview Dialog */}
			<Dialog
				open={!!previewEmployee}
				onOpenChange={(open) => !open && setPreviewEmployee(null)}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1080px]">
					<DialogHeader>
						<DialogTitle>Hồ sơ ảnh - {previewEmployee?.name}</DialogTitle>
						<DialogDescription>
							Kiểm tra ảnh cá nhân, ảnh căn cước và metadata lưu trữ trên máy
							chủ.
						</DialogDescription>
					</DialogHeader>
					{previewEmployee && (
						<div className="grid gap-6 lg:grid-cols-2">
							<div className="space-y-4 rounded-lg border bg-muted/20 p-4">
								<div className="flex items-center justify-between gap-3">
									<div>
										<h3 className="font-semibold text-base">Ảnh cá nhân</h3>
										<p className="text-muted-foreground text-sm">
											Ảnh hồ sơ dùng để nhận diện nhân sự.
										</p>
									</div>
									{previewPortraitImageUrl && previewPortraitImage && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												downloadFile(
													previewPortraitImageUrl,
													previewPortraitImage.fileName,
												)
											}
										>
											<Download className="mr-2 h-4 w-4" />
											Tải ảnh
										</Button>
									)}
								</div>
								<div className="flex h-[360px] items-center justify-center overflow-hidden rounded-lg border bg-background">
									{previewPortraitImageUrl ? (
										<img
											src={previewPortraitImageUrl}
											alt={`Ảnh cá nhân ${previewEmployee.name}`}
											className="h-full w-full object-contain"
										/>
									) : (
										<span className="text-muted-foreground text-sm">
											Chưa có ảnh cá nhân
										</span>
									)}
								</div>
								<div className="space-y-2 rounded-md border bg-background p-3 text-sm">
									<p>
										<span className="font-medium">Logical path:</span>{" "}
										{previewPortraitImage?.logicalPath || "—"}
									</p>
									<p>
										<span className="font-medium">Tên file:</span>{" "}
										{previewPortraitImage?.fileName || "—"}
									</p>
									<p>
										<span className="font-medium">Tên gốc:</span>{" "}
										{previewPortraitImage?.originalFileName || "—"}
									</p>
								</div>
							</div>

							<div className="space-y-4 rounded-lg border bg-muted/20 p-4">
								<div className="flex items-center justify-between gap-3">
									<div>
										<h3 className="font-semibold text-base">Ảnh căn cước</h3>
										<p className="text-muted-foreground text-sm">
											Ảnh dùng để đối chiếu hồ sơ hành chính.
										</p>
									</div>
									{previewIdentityCardImageUrl && previewIdentityCardImage && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												downloadFile(
													previewIdentityCardImageUrl,
													previewIdentityCardImage.fileName,
												)
											}
										>
											<Download className="mr-2 h-4 w-4" />
											Tải ảnh căn cước
										</Button>
									)}
								</div>
								<div className="flex h-[360px] items-center justify-center overflow-hidden rounded-lg border bg-background">
									{previewIdentityCardImageUrl ? (
										<img
											src={previewIdentityCardImageUrl}
											alt={`Ảnh căn cước ${previewEmployee.name}`}
											className="h-full w-full object-contain"
										/>
									) : (
										<span className="text-muted-foreground text-sm">
											Chưa có ảnh căn cước
										</span>
									)}
								</div>
								<div className="space-y-2 rounded-md border bg-background p-3 text-sm">
									<p>
										<span className="font-medium">Logical path:</span>{" "}
										{previewIdentityCardImage?.logicalPath || "—"}
									</p>
									<p>
										<span className="font-medium">Tên file:</span>{" "}
										{previewIdentityCardImage?.fileName || "—"}
									</p>
									<p>
										<span className="font-medium">Tên gốc:</span>{" "}
										{previewIdentityCardImage?.originalFileName || "—"}
									</p>
								</div>
							</div>
						</div>
					)}
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
									⚠️ Nhân viên sẽ được đánh dấu đã thôi việc. Thông tin lịch sử
									vẫn được giữ nguyên.
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
