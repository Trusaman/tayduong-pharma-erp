import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";

const discountTypeValidator = v.union(
	v.literal("Doctor"),
	v.literal("hospital"),
	v.literal("payment"),
	v.literal("Salesman"),
	v.literal("Manager"),
);

const discountTypeLabels = {
	Doctor: "Chiết khấu BS",
	hospital: "Chiết khấu NT, KD",
	payment: "Chiết khấu thanh toán",
	Salesman: "Chiết khấu NT, KD",
	Manager: "Chiết khấu Quản lý",
} as const;

const importDiscountTypeCodeMap = {
	DOCTOR: "Doctor",
	HOSPITAL: "hospital",
	PAYMENT: "payment",
	SALESMAN: "Salesman",
	MANAGER: "Manager",
} as const;

type DiscountTypeValue = keyof typeof discountTypeLabels;

function normalizeLookupCode(value: string) {
	return value.trim().toUpperCase();
}

function parseImportNumber(value: string, fieldName: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${fieldName} không được để trống`);
	}

	const cleaned = trimmed.replace(/\s+/g, "");
	if (!/^[\d.,]+$/.test(cleaned)) {
		throw new Error(`${fieldName} không hợp lệ`);
	}

	const commaCount = cleaned.split(",").length - 1;
	const dotCount = cleaned.split(".").length - 1;
	let normalized = cleaned;

	if (commaCount > 0 && dotCount > 0) {
		const decimalSeparator =
			cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
		const separatorIndex = cleaned.lastIndexOf(decimalSeparator);
		const integerPart = cleaned.slice(0, separatorIndex).replace(/[.,]/g, "");
		const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, "");
		normalized = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
	} else if (commaCount > 1 || dotCount > 1) {
		normalized = cleaned.replace(commaCount > 1 ? /,/g : /\./g, "");
	} else if (commaCount === 1 || dotCount === 1) {
		const separator = commaCount === 1 ? "," : ".";
		const separatorIndex = cleaned.lastIndexOf(separator);
		const digitsAfter = cleaned.length - separatorIndex - 1;
		const shouldTreatAsThousands =
			digitsAfter === 3 && !cleaned.startsWith(`0${separator}`);

		normalized = shouldTreatAsThousands
			? cleaned.replace(separator === "," ? /,/g : /\./g, "")
			: cleaned.replace(separator, ".");
	}

	const parsed = Number(normalized);
	if (!Number.isFinite(parsed)) {
		throw new Error(`${fieldName} không hợp lệ`);
	}

	return parsed;
}

function parseImportStatus(value: string) {
	const normalized = normalizeLookupCode(value || "active");
	if (
		normalized === "ACTIVE" ||
		normalized === "HOAT_DONG" ||
		normalized === "HOATDONG"
	) {
		return true;
	}

	if (
		normalized === "INACTIVE" ||
		normalized === "TAM_DUNG" ||
		normalized === "TAMDUNG"
	) {
		return false;
	}

	throw new Error(`Trạng thái không hợp lệ: ${value}`);
}

function clampPercent(percent: number) {
	if (percent < 0) return 0;
	if (percent > 100) return 100;
	return percent;
}

function clampAmount(amount: number) {
	if (amount < 0) return 0;
	return amount;
}

function formatCurrencyValue(amount: number) {
	return `${new Intl.NumberFormat("vi-VN", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount)} đ`;
}

async function formatHistoryValue(
	ctx: MutationCtx,
	field: string,
	value: unknown,
) {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}

	switch (field) {
		case "discountType":
			return (
				discountTypeLabels[value as keyof typeof discountTypeLabels] ??
				String(value)
			);
		case "customerId": {
			const customer = await ctx.db.get(value as Id<"customers">);
			return customer?.name ?? String(value);
		}
		case "productId": {
			const product = await ctx.db.get(value as Id<"products">);
			return product?.name ?? String(value);
		}
		case "salesmanId": {
			const salesman = await ctx.db.get(value as Id<"salesmen">);
			return salesman?.name ?? String(value);
		}
		case "discountPercent":
			return `${clampPercent(Number(value))}%`;
		case "unitPrice":
			return formatCurrencyValue(clampAmount(Number(value)));
		case "isActive":
			return value ? "Hoạt động" : "Tạm dừng";
		default:
			return String(value);
	}
}

export const list = query({
	args: {
		activeOnly: v.optional(v.boolean()),
		salesmanId: v.optional(v.id("salesmen")),
		customerId: v.optional(v.id("customers")),
		productId: v.optional(v.id("products")),
	},
	handler: async (ctx, args) => {
		const base = args.activeOnly
			? await ctx.db
					.query("discountRules")
					.withIndex("by_active", (q) => q.eq("isActive", true))
					.order("desc")
					.collect()
			: await ctx.db.query("discountRules").order("desc").collect();

		return base.filter((rule) => {
			if (args.salesmanId && rule.salesmanId !== args.salesmanId) return false;
			if (args.customerId && rule.customerId !== args.customerId) return false;
			if (args.productId && rule.productId !== args.productId) return false;
			return true;
		});
	},
});

export const listWithDetails = query({
	args: { activeOnly: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		const rules = args.activeOnly
			? await ctx.db
					.query("discountRules")
					.withIndex("by_active", (q) => q.eq("isActive", true))
					.order("desc")
					.collect()
			: await ctx.db.query("discountRules").order("desc").collect();

		return await Promise.all(
			rules.map(async (rule) => {
				const customer = rule.customerId
					? await ctx.db.get(rule.customerId)
					: null;
				const product = rule.productId
					? await ctx.db.get(rule.productId)
					: null;
				const salesman = await ctx.db.get(rule.salesmanId);
				return {
					...rule,
					customer,
					product,
					salesman,
					editHistory: rule.editHistory ?? [],
				};
			}),
		);
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		ruleGroupId: v.optional(v.string()),
		discountType: discountTypeValidator,
		customerId: v.optional(v.id("customers")),
		productId: v.optional(v.id("products")),
		salesmanId: v.id("salesmen"),
		discountPercent: v.number(),
		unitPrice: v.optional(v.number()),
		createdByStaff: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("discountRules", {
			name: args.name,
			ruleGroupId: args.ruleGroupId?.trim() || undefined,
			discountType: args.discountType,
			customerId: args.customerId,
			productId: args.productId,
			salesmanId: args.salesmanId,
			discountPercent: clampPercent(args.discountPercent),
			unitPrice:
				typeof args.unitPrice === "number"
					? clampAmount(args.unitPrice)
					: undefined,
			createdByStaff: args.createdByStaff,
			notes: args.notes,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("discountRules"),
		name: v.optional(v.string()),
		discountType: v.optional(discountTypeValidator),
		customerId: v.optional(v.id("customers")),
		productId: v.optional(v.id("products")),
		salesmanId: v.optional(v.id("salesmen")),
		discountPercent: v.optional(v.number()),
		unitPrice: v.optional(v.union(v.number(), v.null())),
		createdByStaff: v.optional(v.string()),
		updatedByStaff: v.optional(v.string()),
		notes: v.optional(v.union(v.string(), v.null())),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { id, updatedByStaff } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Discount rule not found");

		const now = Date.now();
		const nextName = args.name ?? existing.name;
		const nextDiscountType = args.discountType ?? existing.discountType;
		const nextCustomerId =
			args.customerId === undefined
				? existing.customerId
				: (args.customerId ?? undefined);
		const nextProductId =
			args.productId === undefined
				? existing.productId
				: (args.productId ?? undefined);
		const nextSalesmanId = args.salesmanId ?? existing.salesmanId;
		const nextDiscountPercent =
			typeof args.discountPercent === "number"
				? clampPercent(args.discountPercent)
				: existing.discountPercent;
		const nextUnitPrice =
			args.unitPrice === undefined
				? existing.unitPrice
				: args.unitPrice === null
					? undefined
					: clampAmount(args.unitPrice);
		const nextCreatedByStaff = args.createdByStaff ?? existing.createdByStaff;
		const nextNotes =
			args.notes === undefined
				? existing.notes
				: args.notes?.trim()
					? args.notes.trim()
					: undefined;
		const nextIsActive =
			typeof args.isActive === "boolean" ? args.isActive : existing.isActive;

		const changes: Array<{
			field: string;
			from?: string;
			to?: string;
		}> = [];

		const pushChange = async (
			field: string,
			previous: unknown,
			next: unknown,
		) => {
			if (previous === next) return;

			changes.push({
				field,
				from: await formatHistoryValue(ctx, field, previous),
				to: await formatHistoryValue(ctx, field, next),
			});
		};

		await pushChange("name", existing.name, nextName);
		await pushChange("discountType", existing.discountType, nextDiscountType);
		await pushChange("customerId", existing.customerId, nextCustomerId);
		await pushChange("productId", existing.productId, nextProductId);
		await pushChange("salesmanId", existing.salesmanId, nextSalesmanId);
		await pushChange(
			"discountPercent",
			existing.discountPercent,
			nextDiscountPercent,
		);
		await pushChange("unitPrice", existing.unitPrice, nextUnitPrice);
		await pushChange(
			"createdByStaff",
			existing.createdByStaff,
			nextCreatedByStaff,
		);
		await pushChange("notes", existing.notes, nextNotes);
		await pushChange("isActive", existing.isActive, nextIsActive);

		const editorName = updatedByStaff?.trim();

		await ctx.db.patch(id, {
			name: nextName,
			discountType: nextDiscountType,
			customerId: nextCustomerId,
			productId: nextProductId,
			salesmanId: nextSalesmanId,
			discountPercent: nextDiscountPercent,
			unitPrice: nextUnitPrice,
			createdByStaff: nextCreatedByStaff,
			notes: nextNotes,
			isActive: nextIsActive,
			...(editorName && changes.length > 0
				? {
						editHistory: [
							...(existing.editHistory ?? []),
							{
								editedAt: now,
								editedBy: editorName,
								changes,
							},
						],
					}
				: {}),
			updatedAt: now,
		});

		return await ctx.db.get(id);
	},
});

export const remove = mutation({
	args: { id: v.id("discountRules") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
		return { success: true };
	},
});

export const removeMany = mutation({
	args: { ids: v.array(v.id("discountRules")) },
	handler: async (ctx, args) => {
		const uniqueIds = [...new Set(args.ids)];
		for (const id of uniqueIds) {
			await ctx.db.delete(id);
		}

		return { success: true, removedCount: uniqueIds.length };
	},
});

export const importMany = mutation({
	args: {
		rows: v.array(
			v.object({
				name: v.string(),
				discountTypeCode: v.string(),
				discountTypeLabel: v.optional(v.string()),
				customerCode: v.optional(v.string()),
				customerName: v.optional(v.string()),
				productSku: v.optional(v.string()),
				productName: v.optional(v.string()),
				salesmanCode: v.string(),
				salesmanName: v.optional(v.string()),
				discountPercent: v.string(),
				unitPrice: v.optional(v.string()),
				createdByStaff: v.string(),
				notes: v.optional(v.string()),
				status: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		if (args.rows.length === 0) {
			throw new Error("File import không có dữ liệu");
		}

		const [customers, products, salesmen] = await Promise.all([
			ctx.db.query("customers").collect(),
			ctx.db.query("products").collect(),
			ctx.db.query("salesmen").collect(),
		]);

		const customerByCode = new Map(
			customers.map((item) => [normalizeLookupCode(item.code), item]),
		);
		const productBySku = new Map(
			products.map((item) => [normalizeLookupCode(item.sku), item]),
		);
		const salesmanByCode = new Map(
			salesmen.map((item) => [normalizeLookupCode(item.code), item]),
		);

		const errors: string[] = [];
		const preparedRows: Array<{
			name: string;
			discountType: DiscountTypeValue;
			customerId?: (typeof customers)[number]["_id"];
			productId?: (typeof products)[number]["_id"];
			salesmanId: (typeof salesmen)[number]["_id"];
			discountPercent: number;
			unitPrice?: number;
			createdByStaff: string;
			notes?: string;
			isActive: boolean;
		}> = [];

		for (const [index, row] of args.rows.entries()) {
			const rowNumber = index + 2;
			try {
				const ruleName = row.name.trim();
				if (!ruleName) {
					throw new Error("Tên quy tắc không được để trống");
				}

				const discountTypeCode = normalizeLookupCode(row.discountTypeCode);
				const mappedDiscountType =
					importDiscountTypeCodeMap[
						discountTypeCode as keyof typeof importDiscountTypeCodeMap
					];
				if (!mappedDiscountType) {
					throw new Error(
						`Mã loại chiết khấu không hợp lệ: ${row.discountTypeCode}`,
					);
				}

				const customerCode = row.customerCode?.trim() ?? "";
				if (!customerCode && row.customerName?.trim()) {
					throw new Error(
						"Khách hàng phải dùng mã khách hàng, không import theo tên",
					);
				}

				const productSku = row.productSku?.trim() ?? "";
				if (!productSku && row.productName?.trim()) {
					throw new Error("Sản phẩm phải dùng SKU, không import theo tên");
				}

				const customer = customerCode
					? customerByCode.get(normalizeLookupCode(customerCode))
					: undefined;
				if (customerCode && !customer) {
					throw new Error(`Không tìm thấy khách hàng theo mã: ${customerCode}`);
				}

				const product = productSku
					? productBySku.get(normalizeLookupCode(productSku))
					: undefined;
				if (productSku && !product) {
					throw new Error(`Không tìm thấy sản phẩm theo SKU: ${productSku}`);
				}

				const salesmanCode = row.salesmanCode.trim();
				if (!salesmanCode) {
					throw new Error("Mã người nhận chiết khấu không được để trống");
				}
				const salesman = salesmanByCode.get(normalizeLookupCode(salesmanCode));
				if (!salesman) {
					throw new Error(`Không tìm thấy người nhận theo mã: ${salesmanCode}`);
				}

				const discountPercent = parseImportNumber(
					row.discountPercent,
					"Tổng chiết khấu %",
				);
				if (discountPercent < 0 || discountPercent > 100) {
					throw new Error(
						"Tổng chiết khấu % phải nằm trong khoảng từ 0 đến 100",
					);
				}

				const unitPriceRaw = row.unitPrice?.trim() ?? "";
				const unitPrice = unitPriceRaw
					? parseImportNumber(unitPriceRaw, "Đơn giá")
					: undefined;
				if (typeof unitPrice === "number" && unitPrice < 0) {
					throw new Error("Đơn giá không được âm");
				}

				const createdByStaff = row.createdByStaff.trim();
				if (!createdByStaff) {
					throw new Error("Người tạo không được để trống");
				}

				const status = parseImportStatus(row.status ?? "active");

				preparedRows.push({
					name: ruleName,
					discountType: mappedDiscountType,
					customerId: customer?._id,
					productId: product?._id,
					salesmanId: salesman._id,
					discountPercent,
					unitPrice,
					createdByStaff,
					notes: row.notes?.trim() ? row.notes.trim() : undefined,
					isActive: status,
				});
			} catch (error) {
				errors.push(
					`Dòng ${rowNumber}: ${error instanceof Error ? error.message : "Lỗi dữ liệu"}`,
				);
			}
		}

		if (errors.length > 0) {
			throw new Error(`Dữ liệu import không hợp lệ:\n${errors.join("\n")}`);
		}

		let inactiveCount = 0;
		for (const prepared of preparedRows) {
			const now = Date.now();
			const ruleId = await ctx.db.insert("discountRules", {
				name: prepared.name,
				discountType: prepared.discountType,
				customerId: prepared.customerId,
				productId: prepared.productId,
				salesmanId: prepared.salesmanId,
				discountPercent: clampPercent(prepared.discountPercent),
				unitPrice:
					typeof prepared.unitPrice === "number"
						? clampAmount(prepared.unitPrice)
						: undefined,
				createdByStaff: prepared.createdByStaff,
				notes: prepared.notes,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			});

			if (!prepared.isActive) {
				inactiveCount += 1;
				await ctx.db.patch(ruleId, {
					isActive: false,
					updatedAt: Date.now(),
				});
			}
		}

		return {
			success: true,
			createdCount: preparedRows.length,
			inactiveCount,
		};
	},
});

export const getApplicableForOrder = query({
	args: {
		customerId: v.id("customers"),
		salesmanId: v.optional(v.id("salesmen")),
		productIds: v.array(v.id("products")),
	},
	handler: async (ctx, args) => {
		if (!args.salesmanId || args.productIds.length === 0) {
			return {} as Record<
				string,
				{
					totalPercent: number;
					rules: {
						id: string;
						name: string;
						discountType: string;
						discountPercent: number;
					}[];
				}
			>;
		}

		const salesmanId = args.salesmanId;

		const rules = await ctx.db
			.query("discountRules")
			.withIndex("by_salesman", (q) => q.eq("salesmanId", salesmanId))
			.filter((q) => q.eq(q.field("isActive"), true))
			.collect();

		const byProduct: Record<
			string,
			{
				totalPercent: number;
				rules: {
					id: string;
					name: string;
					discountType: string;
					discountPercent: number;
				}[];
			}
		> = {};

		for (const productId of args.productIds) {
			const matched = rules.filter((rule) => {
				const customerMatch =
					!rule.customerId || rule.customerId === args.customerId;
				const productMatch = !rule.productId || rule.productId === productId;
				return customerMatch && productMatch;
			});

			const totalPercent = clampPercent(
				matched.reduce((sum, rule) => sum + rule.discountPercent, 0),
			);

			byProduct[productId] = {
				totalPercent,
				rules: matched.map((rule) => ({
					id: String(rule._id),
					name: rule.name,
					discountType: rule.discountType,
					discountPercent: rule.discountPercent,
				})),
			};
		}

		return byProduct;
	},
});
