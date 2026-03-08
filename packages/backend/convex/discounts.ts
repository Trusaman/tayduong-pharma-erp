import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
	ctx: any,
	field: string,
	value: unknown,
) {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}

	switch (field) {
		case "discountType":
			return discountTypeLabels[value as keyof typeof discountTypeLabels] ?? String(value);
		case "customerId": {
			const customer = await ctx.db.get(value as never);
			return customer?.name ?? String(value);
		}
		case "productId": {
			const product = await ctx.db.get(value as never);
			return product?.name ?? String(value);
		}
		case "salesmanId": {
			const salesman = await ctx.db.get(value as never);
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
			args.customerId === undefined ? existing.customerId : args.customerId ?? undefined;
		const nextProductId =
			args.productId === undefined ? existing.productId : args.productId ?? undefined;
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

		const rules = await ctx.db
			.query("discountRules")
			.withIndex("by_salesman", (q) => q.eq("salesmanId", args.salesmanId!))
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
