import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("categories").order("asc").collect();
	},
});

export const getById = query({
	args: { id: v.id("categories") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("categories", {
			name: args.name,
			description: args.description,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("categories"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { id, ...rest } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Category not found");

		await ctx.db.patch(id, {
			...rest,
			updatedAt: Date.now(),
		});
		return await ctx.db.get(id);
	},
});

export const remove = mutation({
	args: { id: v.id("categories") },
	handler: async (ctx, args) => {
		// Check if category is used by any products
		const products = await ctx.db
			.query("products")
			.withIndex("by_category", (q) => q.eq("categoryId", args.id))
			.first();

		if (products) {
			throw new Error("Cannot delete category that has products");
		}

		await ctx.db.delete(args.id);
		return { success: true };
	},
});
