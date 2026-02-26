import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: { activeOnly: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		if (args.activeOnly) {
			return await ctx.db
				.query("salesmen")
				.withIndex("by_active", (q) => q.eq("isActive", true))
				.order("asc")
				.collect();
		}
		return await ctx.db.query("salesmen").order("asc").collect();
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		code: v.string(),
		phone: v.optional(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("salesmen")
			.withIndex("by_code", (q) => q.eq("code", args.code))
			.first();

		if (existing) {
			throw new Error("Salesman with this code already exists");
		}

		const now = Date.now();
		return await ctx.db.insert("salesmen", {
			name: args.name,
			code: args.code,
			phone: args.phone,
			notes: args.notes,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("salesmen"),
		name: v.optional(v.string()),
		code: v.optional(v.string()),
		phone: v.optional(v.string()),
		notes: v.optional(v.string()),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { id, ...rest } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Salesman not found");

		if (args.code && args.code !== existing.code) {
			const duplicate = await ctx.db
				.query("salesmen")
				.withIndex("by_code", (q) => q.eq("code", args.code!))
				.first();

			if (duplicate) {
				throw new Error("Salesman with this code already exists");
			}
		}

		await ctx.db.patch(id, {
			...rest,
			updatedAt: Date.now(),
		});

		return await ctx.db.get(id);
	},
});

export const remove = mutation({
	args: { id: v.id("salesmen") },
	handler: async (ctx, args) => {
		const order = await ctx.db
			.query("salesOrders")
			.withIndex("by_salesman", (q) => q.eq("salesmanId", args.id))
			.first();

		if (order) {
			throw new Error("Cannot delete salesman that has sales orders");
		}

		const discount = await ctx.db
			.query("discountRules")
			.withIndex("by_salesman", (q) => q.eq("salesmanId", args.id))
			.first();

		if (discount) {
			throw new Error("Cannot delete salesman that has discount rules");
		}

		await ctx.db.delete(args.id);
		return { success: true };
	},
});
