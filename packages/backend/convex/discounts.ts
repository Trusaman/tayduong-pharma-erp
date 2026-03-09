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
	Doctor: "Chiet khau BS",
	hospital: "Chiet khau NT, KD",
	payment: "Chiet khau thanh toan",
	Salesman: "Chiet khau NT, KD",
	Manager: "Chiet khau Quan ly",
} as const;

const discountTypeToField = {
	Doctor: "doctorDiscount",
	hospital: "salesDiscount",
	payment: "paymentDiscount",
	Salesman: "salesDiscount",
	Manager: "managerDiscount",
} as const;

const fieldToDiscountType = {
	doctorDiscount: "Doctor",
	salesDiscount: "hospital",
	paymentDiscount: "payment",
	managerDiscount: "Manager",
} as const;

const fieldLabels = {
	doctorDiscount: "Chiet khau BS",
	salesDiscount: "Chiet khau NT, KD",
	paymentDiscount: "Chiet khau thanh toan",
	managerDiscount: "Chiet khau Quan ly",
} as const;

const importDiscountTypeCodeMap = {
	DOCTOR: "Doctor",
	HOSPITAL: "hospital",
	PAYMENT: "payment",
	SALESMAN: "Salesman",
	MANAGER: "Manager",
} as const;

type DiscountTypeValue = keyof typeof discountTypeLabels;
type DiscountFieldName = keyof typeof fieldToDiscountType;
type DiscountDetail = {
	field: DiscountFieldName;
	discountType: DiscountTypeValue;
	salesmanId: Id<"salesmen">;
	discountPercent: number;
};

function normalizeLookupCode(value: string) {
	return value.trim().toUpperCase();
}

function parseImportNumber(value: string, fieldName: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${fieldName} khong duoc de trong`);
	}

	const cleaned = trimmed.replace(/\s+/g, "");
	if (!/^[\d.,]+$/.test(cleaned)) {
		throw new Error(`${fieldName} khong hop le`);
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
		throw new Error(`${fieldName} khong hop le`);
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

	throw new Error(`Trang thai khong hop le: ${value}`);
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
	}).format(amount)} d`;
}

function getConfiguredDiscounts(rule: {
	doctorDiscount?: { salesmanId: Id<"salesmen">; discountPercent: number };
	salesDiscount?: { salesmanId: Id<"salesmen">; discountPercent: number };
	paymentDiscount?: { salesmanId: Id<"salesmen">; discountPercent: number };
	managerDiscount?: { salesmanId: Id<"salesmen">; discountPercent: number };
	discountType?: DiscountTypeValue;
	salesmanId?: Id<"salesmen">;
	discountPercent?: number;
}) {
	const details: DiscountDetail[] = [];
	for (const field of Object.keys(fieldToDiscountType) as DiscountFieldName[]) {
		const detail = rule[field];
		if (detail?.salesmanId) {
			details.push({
				field,
				discountType: fieldToDiscountType[field],
				salesmanId: detail.salesmanId,
				discountPercent: clampPercent(detail.discountPercent),
			});
		}
	}

	if (details.length > 0) {
		return details;
	}

	if (
		rule.discountType &&
		rule.salesmanId &&
		typeof rule.discountPercent === "number"
	) {
		return [
			{
				field: discountTypeToField[rule.discountType],
				discountType: rule.discountType,
				salesmanId: rule.salesmanId,
				discountPercent: clampPercent(rule.discountPercent),
			},
		];
	}

	return [];
}

function hasMatchingSalesman(
	rule: Parameters<typeof getConfiguredDiscounts>[0],
	salesmanId: Id<"salesmen">,
) {
	return getConfiguredDiscounts(rule).some((detail) => detail.salesmanId === salesmanId);
}

function getTotalDiscountPercent(rule: Parameters<typeof getConfiguredDiscounts>[0]) {
	return clampPercent(
		getConfiguredDiscounts(rule).reduce(
			(total, detail) => total + detail.discountPercent,
			0,
		),
	);
}

async function formatDiscountDetailValue(
	ctx: MutationCtx,
	field: DiscountFieldName,
	value: unknown,
) {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const detail = value as { salesmanId?: Id<"salesmen">; discountPercent?: number };
	if (!detail.salesmanId || typeof detail.discountPercent !== "number") {
		return undefined;
	}

	const salesman = await ctx.db.get(detail.salesmanId);
	return `${fieldLabels[field]}: ${clampPercent(detail.discountPercent)}% / ${salesman?.name ?? detail.salesmanId}`;
}

async function formatHistoryValue(
	ctx: MutationCtx,
	field: string,
	value: unknown,
) {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}

	if ((Object.keys(fieldLabels) as string[]).includes(field)) {
		return await formatDiscountDetailValue(ctx, field as DiscountFieldName, value);
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
			return value ? "Hoat dong" : "Tam dung";
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
			if (args.customerId && rule.customerId !== args.customerId) return false;
			if (args.productId && rule.productId !== args.productId) return false;
			if (args.salesmanId && !hasMatchingSalesman(rule, args.salesmanId)) {
				return false;
			}
			return getConfiguredDiscounts(rule).length > 0;
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

		const result = await Promise.all(
			rules.map(async (rule) => {
				const customer = rule.customerId ? await ctx.db.get(rule.customerId) : null;
				const product = rule.productId ? await ctx.db.get(rule.productId) : null;
				const configuredDiscounts = getConfiguredDiscounts(rule);

				return await Promise.all(
					configuredDiscounts.map(async (detail) => ({
						...rule,
						customer,
						product,
						salesman: await ctx.db.get(detail.salesmanId),
						salesmanId: detail.salesmanId,
						discountType: detail.discountType,
						discountPercent: detail.discountPercent,
						totalDiscountPercent: getTotalDiscountPercent(rule),
						editHistory: rule.editHistory ?? [],
					})),
				);
			}),
		);

		return result.flat();
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
		const field = discountTypeToField[args.discountType];
		const detail = {
			salesmanId: args.salesmanId,
			discountPercent: clampPercent(args.discountPercent),
		};
		const ruleGroupId = args.ruleGroupId?.trim() || undefined;
		const notes = args.notes?.trim() ? args.notes.trim() : undefined;
		const unitPrice =
			typeof args.unitPrice === "number" ? clampAmount(args.unitPrice) : undefined;

		if (ruleGroupId) {
			const existing = await ctx.db
				.query("discountRules")
				.withIndex("by_rule_group", (q) => q.eq("ruleGroupId", ruleGroupId))
				.first();

			if (existing) {
				const patch: Partial<typeof existing> & Record<string, unknown> = {
					name: args.name,
					customerId: args.customerId,
					productId: args.productId,
					unitPrice,
					createdByStaff: args.createdByStaff,
					notes,
					updatedAt: now,
				};
				patch[field] = detail;
				await ctx.db.patch(existing._id, patch);
				return existing._id;
			}
		}

		const insertDoc: Record<string, unknown> = {
			name: args.name,
			ruleGroupId,
			customerId: args.customerId,
			productId: args.productId,
			unitPrice,
			createdByStaff: args.createdByStaff,
			notes,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		};
		insertDoc[field] = detail;

		return await ctx.db.insert("discountRules", insertDoc as any);
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
		const nextCustomerId =
			args.customerId === undefined ? existing.customerId : (args.customerId ?? undefined);
		const nextProductId =
			args.productId === undefined ? existing.productId : (args.productId ?? undefined);
		const nextUnitPrice =
			args.unitPrice === undefined
				? existing.unitPrice
				: args.unitPrice === null
					? undefined
					: clampAmount(args.unitPrice);
		const nextCreatedByStaff = args.createdByStaff ?? existing.createdByStaff;
		const nextNotes =
			args.notes === undefined ? existing.notes : args.notes?.trim() ? args.notes.trim() : undefined;
		const nextIsActive = typeof args.isActive === "boolean" ? args.isActive : existing.isActive;

		const existingConfigured = getConfiguredDiscounts(existing);
		const targetDiscountType =
			args.discountType ?? existing.discountType ?? existingConfigured[0]?.discountType;
		const targetField = targetDiscountType ? discountTypeToField[targetDiscountType] : undefined;
		const existingDetail = targetField
			? existingConfigured.find((detail) => detail.field === targetField)
			: undefined;

		if ((args.salesmanId !== undefined || args.discountPercent !== undefined) && !targetField) {
			throw new Error("Discount type is required to update the discount detail");
		}

		let nextDetail = existingDetail
			? {
					salesmanId: existingDetail.salesmanId,
					discountPercent: existingDetail.discountPercent,
				}
			: undefined;

		if (targetField && (args.salesmanId !== undefined || args.discountPercent !== undefined)) {
			if (!nextDetail && args.salesmanId === undefined) {
				throw new Error("Salesman is required when creating a new discount detail");
			}

			nextDetail = {
				salesmanId: args.salesmanId ?? nextDetail!.salesmanId,
				discountPercent:
					typeof args.discountPercent === "number"
						? clampPercent(args.discountPercent)
						: nextDetail?.discountPercent ?? 0,
			};
		}

		const changes: Array<{ field: string; from?: string; to?: string }> = [];
		const pushChange = async (field: string, previous: unknown, next: unknown) => {
			if (JSON.stringify(previous) === JSON.stringify(next)) return;
			changes.push({
				field,
				from: await formatHistoryValue(ctx, field, previous),
				to: await formatHistoryValue(ctx, field, next),
			});
		};

		await pushChange("name", existing.name, nextName);
		await pushChange("customerId", existing.customerId, nextCustomerId);
		await pushChange("productId", existing.productId, nextProductId);
		await pushChange("unitPrice", existing.unitPrice, nextUnitPrice);
		await pushChange("createdByStaff", existing.createdByStaff, nextCreatedByStaff);
		await pushChange("notes", existing.notes, nextNotes);
		await pushChange("isActive", existing.isActive, nextIsActive);
		if (targetField && nextDetail) {
			await pushChange(targetField, existingDetail, nextDetail);
		}

		const patch: Partial<typeof existing> & Record<string, unknown> = {
			name: nextName,
			customerId: nextCustomerId,
			productId: nextProductId,
			unitPrice: nextUnitPrice,
			createdByStaff: nextCreatedByStaff,
			notes: nextNotes,
			isActive: nextIsActive,
			updatedAt: now,
		};
		if (targetField && nextDetail) {
			patch[targetField] = nextDetail;
		}

		const editorName = updatedByStaff?.trim();
		if (editorName && changes.length > 0) {
			patch.editHistory = [
				...(existing.editHistory ?? []),
				{
					editedAt: now,
					editedBy: editorName,
					changes,
				},
			];
		}

		await ctx.db.patch(id, patch);
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
			throw new Error("File import khong co du lieu");
		}

		const [customers, products, salesmen] = await Promise.all([
			ctx.db.query("customers").collect(),
			ctx.db.query("products").collect(),
			ctx.db.query("salesmen").collect(),
		]);

		const customerByCode = new Map(customers.map((item) => [normalizeLookupCode(item.code), item]));
		const productBySku = new Map(products.map((item) => [normalizeLookupCode(item.sku), item]));
		const salesmanByCode = new Map(salesmen.map((item) => [normalizeLookupCode(item.code), item]));

		const errors: string[] = [];
		const preparedRows = new Map<string, {
			name: string;
			customerId?: Id<"customers">;
			productId?: Id<"products">;
			unitPrice?: number;
			createdByStaff: string;
			notes?: string;
			isActive: boolean;
			details: Partial<Record<DiscountFieldName, { salesmanId: Id<"salesmen">; discountPercent: number }>>;
		}>();

		for (const [index, row] of args.rows.entries()) {
			const rowNumber = index + 2;
			try {
				const ruleName = row.name.trim();
				if (!ruleName) throw new Error("Ten quy tac khong duoc de trong");

				const discountTypeCode = normalizeLookupCode(row.discountTypeCode);
				const mappedDiscountType = importDiscountTypeCodeMap[discountTypeCode as keyof typeof importDiscountTypeCodeMap];
				if (!mappedDiscountType) {
					throw new Error(`Ma loai chiet khau khong hop le: ${row.discountTypeCode}`);
				}
				const field = discountTypeToField[mappedDiscountType];

				const customerCode = row.customerCode?.trim() ?? "";
				if (!customerCode && row.customerName?.trim()) {
					throw new Error("Khach hang phai dung ma, khong import theo ten");
				}
				const productSku = row.productSku?.trim() ?? "";
				if (!productSku && row.productName?.trim()) {
					throw new Error("San pham phai dung SKU, khong import theo ten");
				}

				const customer = customerCode ? customerByCode.get(normalizeLookupCode(customerCode)) : undefined;
				if (customerCode && !customer) {
					throw new Error(`Khong tim thay khach hang theo ma: ${customerCode}`);
				}
				const product = productSku ? productBySku.get(normalizeLookupCode(productSku)) : undefined;
				if (productSku && !product) {
					throw new Error(`Khong tim thay san pham theo SKU: ${productSku}`);
				}

				const salesmanCode = row.salesmanCode.trim();
				if (!salesmanCode) throw new Error("Ma nguoi nhan khong duoc de trong");
				const salesman = salesmanByCode.get(normalizeLookupCode(salesmanCode));
				if (!salesman) {
					throw new Error(`Khong tim thay nguoi nhan theo ma: ${salesmanCode}`);
				}

				const discountPercent = parseImportNumber(row.discountPercent, "Ty le chiet khau");
				if (discountPercent < 0 || discountPercent > 100) {
					throw new Error("Ty le chiet khau phai nam trong khoang 0-100");
				}

				const unitPriceRaw = row.unitPrice?.trim() ?? "";
				const unitPrice = unitPriceRaw ? parseImportNumber(unitPriceRaw, "Don gia") : undefined;
				if (typeof unitPrice === "number" && unitPrice < 0) {
					throw new Error("Don gia khong duoc am");
				}

				const createdByStaff = row.createdByStaff.trim();
				if (!createdByStaff) throw new Error("Nguoi tao khong duoc de trong");
				const notes = row.notes?.trim() ? row.notes.trim() : undefined;
				const isActive = parseImportStatus(row.status ?? "active");

				const groupingKey = [
					ruleName,
					customer?._id ?? "all-customers",
					product?._id ?? "all-products",
					typeof unitPrice === "number" ? String(unitPrice) : "all-prices",
					createdByStaff,
					notes ?? "",
					isActive ? "active" : "inactive",
				].join("||");

				const existingGroup = preparedRows.get(groupingKey) ?? {
					name: ruleName,
					customerId: customer?._id,
					productId: product?._id,
					unitPrice,
					createdByStaff,
					notes,
					isActive,
					details: {},
				};

				if (existingGroup.details[field]) {
					throw new Error(`Trung loai chiet khau ${discountTypeLabels[mappedDiscountType]} trong cung mot quy tac`);
				}

				existingGroup.details[field] = {
					salesmanId: salesman._id,
					discountPercent,
				};
				preparedRows.set(groupingKey, existingGroup);
			} catch (error) {
				errors.push(`Dong ${rowNumber}: ${error instanceof Error ? error.message : "Loi du lieu"}`);
			}
		}

		if (errors.length > 0) {
			throw new Error(`Du lieu import khong hop le:\n${errors.join("\n")}`);
		}

		let inactiveCount = 0;
		for (const prepared of preparedRows.values()) {
			const now = Date.now();
			await ctx.db.insert("discountRules", {
				name: prepared.name,
				customerId: prepared.customerId,
				productId: prepared.productId,
				unitPrice:
					typeof prepared.unitPrice === "number"
						? clampAmount(prepared.unitPrice)
						: undefined,
				createdByStaff: prepared.createdByStaff,
				notes: prepared.notes,
				doctorDiscount: prepared.details.doctorDiscount,
				salesDiscount: prepared.details.salesDiscount,
				paymentDiscount: prepared.details.paymentDiscount,
				managerDiscount: prepared.details.managerDiscount,
				isActive: prepared.isActive,
				createdAt: now,
				updatedAt: now,
			});
			if (!prepared.isActive) inactiveCount += 1;
		}

		return {
			success: true,
			createdCount: preparedRows.size,
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
		if (args.productIds.length === 0) {
			return {} as Record<string, { totalPercent: number; rules: { id: string; name: string; discountType: string; discountPercent: number }[] }>;
		}

		const rules = await ctx.db
			.query("discountRules")
			.withIndex("by_active", (q) => q.eq("isActive", true))
			.collect();

		const byProduct: Record<string, { totalPercent: number; rules: { id: string; name: string; discountType: string; discountPercent: number }[] }> = {};

		for (const productId of args.productIds) {
			const matched = rules.filter((rule) => {
				const customerMatch = !rule.customerId || rule.customerId === args.customerId;
				const productMatch = !rule.productId || rule.productId === productId;
				return customerMatch && productMatch;
			});

			const flattenedRules = matched.flatMap((rule) =>
				getConfiguredDiscounts(rule).map((detail) => ({
					id: String(rule._id),
					name: rule.name,
					discountType: detail.discountType,
					discountPercent: detail.discountPercent,
				})),
			);

			byProduct[productId] = {
				totalPercent: clampPercent(
					flattenedRules.reduce((sum, rule) => sum + rule.discountPercent, 0),
				),
				rules: flattenedRules,
			};
		}

		return byProduct;
	},
});
