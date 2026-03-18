import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, writeAuditLog } from "./auditLogs";

const discountTypeValidator = v.union(
	v.literal("Doctor"),
	v.literal("hospital"),
	v.literal("payment"),
	v.literal("CTV"),
	v.literal("Salesman"),
	v.literal("Manager"),
);

const discountDetailValidator = v.object({
	salesmanId: v.id("salesmen"),
	discountPercent: v.number(),
});

const importDiscountGroupValidator = v.object({
	percent: v.optional(v.string()),
	salesmanCode: v.optional(v.string()),
	salesmanName: v.optional(v.string()),
});

const discountTypeLabels = {
	Doctor: "Chiet khau BS",
	hospital: "Chiet khau NT, KD",
	payment: "Chiet khau thanh toan",
	CTV: "Chiet khau CTV",
	Salesman: "Chiet khau NT, KD",
	Manager: "Chiet khau Quan ly",
} as const;

const discountTypeToField = {
	Doctor: "doctorDiscount",
	hospital: "salesDiscount",
	payment: "paymentDiscount",
	CTV: "ctvDiscount",
	Salesman: "salesDiscount",
	Manager: "managerDiscount",
} as const;

const fieldToDiscountType = {
	doctorDiscount: "Doctor",
	salesDiscount: "hospital",
	paymentDiscount: "payment",
	ctvDiscount: "CTV",
	managerDiscount: "Manager",
} as const;

const fieldLabels = {
	doctorDiscount: "Chiet khau BS",
	salesDiscount: "Chiet khau NT, KD",
	paymentDiscount: "Chiet khau thanh toan",
	ctvDiscount: "Chiet khau CTV",
	managerDiscount: "Chiet khau Quan ly",
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

function toDiscountRuleAuditSnapshot(
	rule: Doc<"discountRules">,
	id?: Id<"discountRules">,
) {
	return {
		id: id ?? rule._id,
		name: rule.name,
		ruleGroupId: rule.ruleGroupId,
		customerId: rule.customerId,
		productId: rule.productId,
		unitPrice: rule.unitPrice,
		isActive: rule.isActive,
		doctorDiscount: rule.doctorDiscount,
		salesDiscount: rule.salesDiscount,
		paymentDiscount: rule.paymentDiscount,
		ctvDiscount: rule.ctvDiscount,
		managerDiscount: rule.managerDiscount,
		notes: rule.notes,
		updatedAt: rule.updatedAt,
	};
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
	ctvDiscount?: { salesmanId: Id<"salesmen">; discountPercent: number };
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
	return getConfiguredDiscounts(rule).some(
		(detail) => detail.salesmanId === salesmanId,
	);
}

function getTotalDiscountPercent(
	rule: Parameters<typeof getConfiguredDiscounts>[0],
) {
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

	const detail = value as {
		salesmanId?: Id<"salesmen">;
		discountPercent?: number;
	};
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
		return await formatDiscountDetailValue(
			ctx,
			field as DiscountFieldName,
			value,
		);
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
				const customer = rule.customerId
					? await ctx.db.get(rule.customerId)
					: null;
				const product = rule.productId
					? await ctx.db.get(rule.productId)
					: null;
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
			typeof args.unitPrice === "number"
				? clampAmount(args.unitPrice)
				: undefined;

		if (ruleGroupId) {
			const existing = await ctx.db
				.query("discountRules")
				.withIndex("by_rule_group", (q) => q.eq("ruleGroupId", ruleGroupId))
				.first();

			if (existing) {
				const beforeSnapshot = toDiscountRuleAuditSnapshot(existing);
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

				const updatedRule = await ctx.db.get(existing._id);
				await writeAuditLog(ctx, {
					action: AUDIT_ACTIONS.discountUpdated,
					description: `Cập nhật chính sách chiết khấu ${args.name}`,
					entityType: AUDIT_ENTITIES.discount,
					entityId: existing._id,
					before: beforeSnapshot,
					after: updatedRule
						? toDiscountRuleAuditSnapshot(updatedRule, existing._id)
						: undefined,
					metadata: {
						upsertByRuleGroup: true,
						discountType: args.discountType,
					},
				});

				return existing._id;
			}
		}

		const insertDoc: Omit<Doc<"discountRules">, "_id" | "_creationTime"> = {
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

		const ruleId = await ctx.db.insert("discountRules", insertDoc);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountCreated,
			description: `Tạo chính sách chiết khấu ${args.name}`,
			entityType: AUDIT_ENTITIES.discount,
			entityId: ruleId,
			after: {
				id: ruleId,
				name: args.name,
				ruleGroupId,
				discountType: args.discountType,
				customerId: args.customerId,
				productId: args.productId,
				salesmanId: args.salesmanId,
				discountPercent: detail.discountPercent,
				unitPrice,
			},
		});

		return ruleId;
	},
});

export const update = mutation({
	args: {
		id: v.id("discountRules"),
		name: v.optional(v.string()),
		customerId: v.optional(v.id("customers")),
		productId: v.optional(v.id("products")),
		unitPrice: v.optional(v.union(v.number(), v.null())),
		createdByStaff: v.optional(v.string()),
		updatedByStaff: v.optional(v.string()),
		notes: v.optional(v.union(v.string(), v.null())),
		isActive: v.optional(v.boolean()),
		doctorDiscount: v.optional(v.union(discountDetailValidator, v.null())),
		salesDiscount: v.optional(v.union(discountDetailValidator, v.null())),
		paymentDiscount: v.optional(v.union(discountDetailValidator, v.null())),
		ctvDiscount: v.optional(v.union(discountDetailValidator, v.null())),
		managerDiscount: v.optional(v.union(discountDetailValidator, v.null())),
	},
	handler: async (ctx, args) => {
		const { id, updatedByStaff } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Discount rule not found");

		const now = Date.now();
		const nextName = args.name ?? existing.name;
		const nextCustomerId =
			args.customerId === undefined
				? existing.customerId
				: (args.customerId ?? undefined);
		const nextProductId =
			args.productId === undefined
				? existing.productId
				: (args.productId ?? undefined);
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

		const existingDetails = {
			doctorDiscount: existing.doctorDiscount,
			salesDiscount: existing.salesDiscount,
			paymentDiscount: existing.paymentDiscount,
			ctvDiscount: existing.ctvDiscount,
			managerDiscount: existing.managerDiscount,
		};
		const nextDetails = {
			doctorDiscount:
				args.doctorDiscount === undefined
					? existing.doctorDiscount
					: args.doctorDiscount === null
						? undefined
						: {
								salesmanId: args.doctorDiscount.salesmanId,
								discountPercent: clampPercent(
									args.doctorDiscount.discountPercent,
								),
							},
			salesDiscount:
				args.salesDiscount === undefined
					? existing.salesDiscount
					: args.salesDiscount === null
						? undefined
						: {
								salesmanId: args.salesDiscount.salesmanId,
								discountPercent: clampPercent(
									args.salesDiscount.discountPercent,
								),
							},
			paymentDiscount:
				args.paymentDiscount === undefined
					? existing.paymentDiscount
					: args.paymentDiscount === null
						? undefined
						: {
								salesmanId: args.paymentDiscount.salesmanId,
								discountPercent: clampPercent(
									args.paymentDiscount.discountPercent,
								),
							},
			ctvDiscount:
				args.ctvDiscount === undefined
					? existing.ctvDiscount
					: args.ctvDiscount === null
						? undefined
						: {
								salesmanId: args.ctvDiscount.salesmanId,
								discountPercent: clampPercent(args.ctvDiscount.discountPercent),
							},
			managerDiscount:
				args.managerDiscount === undefined
					? existing.managerDiscount
					: args.managerDiscount === null
						? undefined
						: {
								salesmanId: args.managerDiscount.salesmanId,
								discountPercent: clampPercent(
									args.managerDiscount.discountPercent,
								),
							},
		};

		const changes: Array<{ field: string; from?: string; to?: string }> = [];
		const pushChange = async (
			field: string,
			previous: unknown,
			next: unknown,
		) => {
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
		await pushChange(
			"createdByStaff",
			existing.createdByStaff,
			nextCreatedByStaff,
		);
		await pushChange("notes", existing.notes, nextNotes);
		await pushChange("isActive", existing.isActive, nextIsActive);
		await pushChange(
			"doctorDiscount",
			existingDetails.doctorDiscount,
			nextDetails.doctorDiscount,
		);
		await pushChange(
			"salesDiscount",
			existingDetails.salesDiscount,
			nextDetails.salesDiscount,
		);
		await pushChange(
			"paymentDiscount",
			existingDetails.paymentDiscount,
			nextDetails.paymentDiscount,
		);
		await pushChange(
			"ctvDiscount",
			existingDetails.ctvDiscount,
			nextDetails.ctvDiscount,
		);
		await pushChange(
			"managerDiscount",
			existingDetails.managerDiscount,
			nextDetails.managerDiscount,
		);

		const patch: Partial<typeof existing> & Record<string, unknown> = {
			name: nextName,
			customerId: nextCustomerId,
			productId: nextProductId,
			unitPrice: nextUnitPrice,
			createdByStaff: nextCreatedByStaff,
			notes: nextNotes,
			isActive: nextIsActive,
			doctorDiscount: nextDetails.doctorDiscount,
			salesDiscount: nextDetails.salesDiscount,
			paymentDiscount: nextDetails.paymentDiscount,
			ctvDiscount: nextDetails.ctvDiscount,
			managerDiscount: nextDetails.managerDiscount,
			updatedAt: now,
		};

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
		const updatedRule = await ctx.db.get(id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountUpdated,
			description: `Cập nhật chính sách chiết khấu ${existing.name}`,
			entityType: AUDIT_ENTITIES.discount,
			entityId: id,
			before: toDiscountRuleAuditSnapshot(existing),
			after: updatedRule
				? toDiscountRuleAuditSnapshot(updatedRule, id)
				: undefined,
			metadata: {
				updatedByStaff: updatedByStaff?.trim() || undefined,
				changedFieldsCount: changes.length,
			},
		});

		return updatedRule;
	},
});

export const remove = mutation({
	args: { id: v.id("discountRules") },
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		await ctx.db.delete(args.id);

		if (existing) {
			await writeAuditLog(ctx, {
				action: AUDIT_ACTIONS.discountDeleted,
				description: `Xóa chính sách chiết khấu ${existing.name}`,
				entityType: AUDIT_ENTITIES.discount,
				entityId: args.id,
				before: toDiscountRuleAuditSnapshot(existing, args.id),
			});
		}

		return { success: true };
	},
});

export const removeMany = mutation({
	args: { ids: v.array(v.id("discountRules")) },
	handler: async (ctx, args) => {
		const uniqueIds = [...new Set(args.ids)];
		const removedRules: Array<{ id: Id<"discountRules">; name: string }> = [];
		for (const id of uniqueIds) {
			const existing = await ctx.db.get(id);
			await ctx.db.delete(id);
			if (existing) {
				removedRules.push({ id, name: existing.name });
			}
		}

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountDeleted,
			description: `Xóa hàng loạt ${removedRules.length} chính sách chiết khấu`,
			entityType: AUDIT_ENTITIES.discount,
			metadata: {
				count: removedRules.length,
				rules: removedRules,
			},
		});

		return { success: true, removedCount: uniqueIds.length };
	},
});

export const importMany = mutation({
	args: {
		rows: v.array(
			v.object({
				name: v.string(),
				customerCode: v.optional(v.string()),
				customerName: v.optional(v.string()),
				productSku: v.optional(v.string()),
				productName: v.optional(v.string()),
				unitPrice: v.optional(v.string()),
				createdByStaff: v.string(),
				notes: v.optional(v.string()),
				status: v.optional(v.string()),
				doctor: importDiscountGroupValidator,
				sales: importDiscountGroupValidator,
				payment: importDiscountGroupValidator,
				ctv: importDiscountGroupValidator,
				manager: importDiscountGroupValidator,
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
			customerId?: Id<"customers">;
			productId?: Id<"products">;
			unitPrice?: number;
			createdByStaff: string;
			notes?: string;
			isActive: boolean;
			details: Partial<
				Record<
					DiscountFieldName,
					{ salesmanId: Id<"salesmen">; discountPercent: number }
				>
			>;
		}> = [];

		for (const [index, row] of args.rows.entries()) {
			const rowNumber = index + 2;
			try {
				const ruleName = row.name.trim();
				if (!ruleName) throw new Error("Ten quy tac khong duoc de trong");

				const customerCode = row.customerCode?.trim() ?? "";
				if (!customerCode && row.customerName?.trim()) {
					throw new Error("Khach hang phai dung ma, khong import theo ten");
				}
				const productSku = row.productSku?.trim() ?? "";
				if (!productSku && row.productName?.trim()) {
					throw new Error("San pham phai dung SKU, khong import theo ten");
				}

				const customer = customerCode
					? customerByCode.get(normalizeLookupCode(customerCode))
					: undefined;
				if (customerCode && !customer) {
					throw new Error(`Khong tim thay khach hang theo ma: ${customerCode}`);
				}
				const product = productSku
					? productBySku.get(normalizeLookupCode(productSku))
					: undefined;
				if (productSku && !product) {
					throw new Error(`Khong tim thay san pham theo SKU: ${productSku}`);
				}

				const unitPriceRaw = row.unitPrice?.trim() ?? "";
				const unitPrice = unitPriceRaw
					? parseImportNumber(unitPriceRaw, "Don gia")
					: undefined;
				if (typeof unitPrice === "number" && unitPrice < 0) {
					throw new Error("Don gia khong duoc am");
				}

				const createdByStaff = row.createdByStaff.trim();
				if (!createdByStaff) throw new Error("Nguoi tao khong duoc de trong");
				const notes = row.notes?.trim() ? row.notes.trim() : undefined;
				const isActive = parseImportStatus(row.status ?? "active");
				const details: Partial<
					Record<
						DiscountFieldName,
						{ salesmanId: Id<"salesmen">; discountPercent: number }
					>
				> = {};

				const groups: Array<{
					field: DiscountFieldName;
					label: string;
					data: {
						percent?: string;
						salesmanCode?: string;
						salesmanName?: string;
					};
				}> = [
					{
						field: "doctorDiscount",
						label: "Chiet khau BS",
						data: row.doctor,
					},
					{
						field: "salesDiscount",
						label: "Chiet khau NT, KD",
						data: row.sales,
					},
					{
						field: "paymentDiscount",
						label: "Chiet khau thanh toan",
						data: row.payment,
					},
					{
						field: "ctvDiscount",
						label: "Chiet khau CTV",
						data: row.ctv,
					},
					{
						field: "managerDiscount",
						label: "Chiet khau Quan ly",
						data: row.manager,
					},
				];

				for (const group of groups) {
					const percentRaw = group.data.percent?.trim() ?? "";
					const salesmanCode = group.data.salesmanCode?.trim() ?? "";

					if (!salesmanCode && group.data.salesmanName?.trim()) {
						throw new Error(
							`${group.label}: phai dung ma nguoi nhan, khong import theo ten`,
						);
					}

					if (!percentRaw && !salesmanCode) continue;

					if (!percentRaw || !salesmanCode) {
						throw new Error(
							`${group.label}: can nhap du ty le va ma nguoi nhan`,
						);
					}

					const salesman = salesmanByCode.get(
						normalizeLookupCode(salesmanCode),
					);
					if (!salesman) {
						throw new Error(
							`${group.label}: khong tim thay nguoi nhan theo ma ${salesmanCode}`,
						);
					}

					const discountPercent = parseImportNumber(percentRaw, group.label);
					if (discountPercent < 0 || discountPercent > 100) {
						throw new Error(
							`${group.label}: ty le chiet khau phai nam trong khoang 0-100`,
						);
					}

					details[group.field] = {
						salesmanId: salesman._id,
						discountPercent,
					};
				}

				if (Object.keys(details).length === 0) {
					throw new Error("Phai nhap it nhat mot nhom chiet khau");
				}

				preparedRows.push({
					name: ruleName,
					customerId: customer?._id,
					productId: product?._id,
					unitPrice,
					createdByStaff,
					notes,
					isActive,
					details,
				});
			} catch (error) {
				errors.push(
					`Dong ${rowNumber}: ${error instanceof Error ? error.message : "Loi du lieu"}`,
				);
			}
		}

		if (errors.length > 0) {
			throw new Error(`Du lieu import khong hop le:\n${errors.join("\n")}`);
		}

		let inactiveCount = 0;
		for (const prepared of preparedRows) {
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
				ctvDiscount: prepared.details.ctvDiscount,
				managerDiscount: prepared.details.managerDiscount,
				isActive: prepared.isActive,
				createdAt: now,
				updatedAt: now,
			});
			if (!prepared.isActive) inactiveCount += 1;
		}

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountImported,
			description: `Import ${preparedRows.length} chính sách chiết khấu`,
			entityType: AUDIT_ENTITIES.discount,
			metadata: {
				createdCount: preparedRows.length,
				inactiveCount,
			},
		});

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
		if (args.productIds.length === 0) {
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

		const rules = await ctx.db
			.query("discountRules")
			.withIndex("by_active", (q) => q.eq("isActive", true))
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
