import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const positionValidator = v.union(
	v.literal("thử việc"),
	v.literal("học việc"),
	v.literal("chính thức"),
	v.literal("cộng tác viên"),
	v.literal("trưởng nhóm"),
	v.literal("trưởng phòng"),
	v.literal("phó giám đốc"),
	v.literal("giám đốc"),
);

const trackingStatusValidator = v.union(
	v.literal("theo dõi"),
	v.literal("ngừng theo dõi"),
);

const genderValidator = v.union(v.literal("nam"), v.literal("nu"));

const bankAccountValidator = v.object({
	accountNumber: v.string(),
	bankName: v.string(),
	branch: v.string(),
	bankProvinceCity: v.string(),
});

const uploadedImageInputValidator = v.object({
	storageId: v.id("_storage"),
	originalFileName: v.string(),
	contentType: v.string(),
	size: v.number(),
});

const toSlug = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "employee";

const buildEmployeeImageMetadata = (
	upload: {
		storageId: Id<"_storage">;
		originalFileName: string;
		contentType: string;
		size: number;
	},
	args: {
		employeeCode?: string;
		name?: string;
	},
	imageType: "portrait" | "identity-card",
) => {
	const uploadedAt = Date.now();
	const date = new Date(uploadedAt);
	const timestamp = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}`;
	const identifier = toSlug(
		args.employeeCode?.trim() || args.name?.trim() || "employee",
	);
	const extension = upload.originalFileName.includes(".")
		? upload.originalFileName.split(".").pop()?.toLowerCase() || "bin"
		: upload.contentType.split("/").pop()?.toLowerCase() || "bin";
	const fileName = `${identifier}-${imageType}-${timestamp}.${extension}`;
	const logicalPath = `employees/${identifier}/${imageType}/${fileName}`;

	return {
		storageId: upload.storageId,
		logicalPath,
		fileName,
		originalFileName: upload.originalFileName,
		contentType: upload.contentType,
		size: upload.size,
		uploadedAt,
	};
};

async function deleteEmployeeImageIfNeeded(
	ctx: { storage: { delete: (storageId: Id<"_storage">) => Promise<void> } },
	image:
		| {
				storageId: Id<"_storage">;
		  }
		| undefined,
) {
	if (!image) return;
	await ctx.storage.delete(image.storageId);
}

async function attachEmployeeImageUrls<
	T extends {
		portraitImage?: { storageId: Id<"_storage"> };
		identityCardImage?: { storageId: Id<"_storage"> };
	},
>(
	ctx: {
		storage: { getUrl: (storageId: Id<"_storage">) => Promise<string | null> };
	},
	employee: T,
) {
	const [portraitImageUrl, identityCardImageUrl] = await Promise.all([
		employee.portraitImage
			? ctx.storage.getUrl(employee.portraitImage.storageId)
			: Promise.resolve(null),
		employee.identityCardImage
			? ctx.storage.getUrl(employee.identityCardImage.storageId)
			: Promise.resolve(null),
	]);

	return {
		...employee,
		portraitImageUrl,
		identityCardImageUrl,
	};
}

export const list = query({
	args: {
		trackingStatus: v.optional(trackingStatusValidator),
	},
	handler: async (ctx, args) => {
		const trackingStatus = args.trackingStatus;
		if (trackingStatus) {
			const employees = await ctx.db
				.query("employees")
				.withIndex("by_trackingStatus", (q) =>
					q.eq("trackingStatus", trackingStatus),
				)
				.order("asc")
				.collect();
			return await Promise.all(
				employees.map((employee) => attachEmployeeImageUrls(ctx, employee)),
			);
		}
		const employees = await ctx.db.query("employees").order("asc").collect();
		return await Promise.all(
			employees.map((employee) => attachEmployeeImageUrls(ctx, employee)),
		);
	},
});

export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		return await ctx.storage.generateUploadUrl();
	},
});

export const deleteUploadedFile = mutation({
	args: { storageId: v.id("_storage") },
	handler: async (ctx, args) => {
		await ctx.storage.delete(args.storageId);
		return null;
	},
});

export const create = mutation({
	args: {
		portraitUpload: v.optional(uploadedImageInputValidator),
		identityCardUpload: v.optional(uploadedImageInputValidator),
		employeeCode: v.optional(v.string()),
		name: v.string(),
		gender: v.optional(genderValidator),
		birthDate: v.optional(v.number()),
		identityNumber: v.optional(v.string()),
		identityIssuedDate: v.optional(v.number()),
		identityIssuedPlace: v.optional(v.string()),
		nationality: v.optional(v.string()),
		passportNumber: v.optional(v.string()),
		email: v.string(),
		phone: v.string(),
		department: v.optional(v.string()),
		taxId: v.optional(v.string()),
		agreedSalary: v.optional(v.number()),
		salaryCoefficient: v.optional(v.number()),
		insuranceSalary: v.optional(v.number()),
		contractType: v.optional(v.string()),
		dependentCount: v.optional(v.number()),
		customerSupplierGroup: v.optional(v.string()),
		bankAccounts: v.optional(v.array(bankAccountValidator)),
		position: positionValidator,
		trackingStatus: trackingStatusValidator,
		joinedDate: v.number(),
		resignationDate: v.optional(v.number()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const portraitImage = args.portraitUpload
			? buildEmployeeImageMetadata(args.portraitUpload, args, "portrait")
			: undefined;
		const identityCardImage = args.identityCardUpload
			? buildEmployeeImageMetadata(
					args.identityCardUpload,
					args,
					"identity-card",
				)
			: undefined;
		return await ctx.db.insert("employees", {
			portraitImage,
			identityCardImage,
			employeeCode: args.employeeCode,
			name: args.name,
			gender: args.gender,
			birthDate: args.birthDate,
			identityNumber: args.identityNumber,
			identityIssuedDate: args.identityIssuedDate,
			identityIssuedPlace: args.identityIssuedPlace,
			nationality: args.nationality,
			passportNumber: args.passportNumber,
			email: args.email,
			phone: args.phone,
			department: args.department,
			taxId: args.taxId,
			agreedSalary: args.agreedSalary,
			salaryCoefficient: args.salaryCoefficient,
			insuranceSalary: args.insuranceSalary,
			contractType: args.contractType,
			dependentCount: args.dependentCount,
			customerSupplierGroup: args.customerSupplierGroup,
			bankAccounts: args.bankAccounts,
			position: args.position,
			trackingStatus: args.trackingStatus,
			joinedDate: args.joinedDate,
			resignationDate: args.resignationDate,
			notes: args.notes,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("employees"),
		portraitUpload: v.optional(uploadedImageInputValidator),
		identityCardUpload: v.optional(uploadedImageInputValidator),
		removePortraitImage: v.optional(v.boolean()),
		removeIdentityCardImage: v.optional(v.boolean()),
		employeeCode: v.optional(v.string()),
		name: v.optional(v.string()),
		gender: v.optional(genderValidator),
		birthDate: v.optional(v.number()),
		identityNumber: v.optional(v.string()),
		identityIssuedDate: v.optional(v.number()),
		identityIssuedPlace: v.optional(v.string()),
		nationality: v.optional(v.string()),
		passportNumber: v.optional(v.string()),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		department: v.optional(v.string()),
		taxId: v.optional(v.string()),
		agreedSalary: v.optional(v.number()),
		salaryCoefficient: v.optional(v.number()),
		insuranceSalary: v.optional(v.number()),
		contractType: v.optional(v.string()),
		dependentCount: v.optional(v.number()),
		customerSupplierGroup: v.optional(v.string()),
		bankAccounts: v.optional(v.array(bankAccountValidator)),
		position: v.optional(positionValidator),
		trackingStatus: v.optional(trackingStatusValidator),
		joinedDate: v.optional(v.number()),
		resignationDate: v.optional(v.number()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const {
			id,
			portraitUpload,
			identityCardUpload,
			removePortraitImage,
			removeIdentityCardImage,
			...rest
		} = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Không tìm thấy nhân viên");

		// Validate: ngừng theo dõi phải có resignationDate
		const newStatus = rest.trackingStatus ?? existing.trackingStatus;
		const newResignationDate = rest.resignationDate ?? existing.resignationDate;
		if (newStatus === "ngừng theo dõi" && !newResignationDate) {
			throw new Error(
				'Cần nhập ngày thôi việc khi chuyển sang "Ngừng theo dõi"',
			);
		}

		const patchData: Record<string, unknown> = {
			...rest,
			updatedAt: Date.now(),
		};

		const shouldDeletePortraitAfterPatch =
			(removePortraitImage || !!portraitUpload) && !!existing.portraitImage;
		const shouldDeleteIdentityAfterPatch =
			(removeIdentityCardImage || !!identityCardUpload) &&
			!!existing.identityCardImage;

		if (removePortraitImage) {
			patchData.portraitImage = undefined;
		}

		if (removeIdentityCardImage) {
			patchData.identityCardImage = undefined;
		}

		if (portraitUpload) {
			patchData.portraitImage = buildEmployeeImageMetadata(
				portraitUpload,
				{
					employeeCode: rest.employeeCode ?? existing.employeeCode,
					name: rest.name ?? existing.name,
				},
				"portrait",
			);
		}

		if (identityCardUpload) {
			patchData.identityCardImage = buildEmployeeImageMetadata(
				identityCardUpload,
				{
					employeeCode: rest.employeeCode ?? existing.employeeCode,
					name: rest.name ?? existing.name,
				},
				"identity-card",
			);
		}

		await ctx.db.patch(id, patchData);

		if (shouldDeletePortraitAfterPatch) {
			await deleteEmployeeImageIfNeeded(ctx, existing.portraitImage);
		}

		if (shouldDeleteIdentityAfterPatch) {
			await deleteEmployeeImageIfNeeded(ctx, existing.identityCardImage);
		}
	},
});

export const remove = mutation({
	args: { id: v.id("employees") },
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) throw new Error("Không tìm thấy nhân viên");
		await ctx.db.delete(args.id);
		await deleteEmployeeImageIfNeeded(ctx, existing.portraitImage);
		await deleteEmployeeImageIfNeeded(ctx, existing.identityCardImage);
	},
});
