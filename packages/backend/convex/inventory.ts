import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: {
		productId: v.optional(v.id("products")),
	},
	handler: async (ctx, args) => {
		if (args.productId) {
			return await ctx.db
				.query("inventory")
				.withIndex("by_product", (q) => q.eq("productId", args.productId!))
				.order("asc")
				.collect();
		}
		return await ctx.db.query("inventory").order("asc").collect();
	},
});

export const getById = query({
	args: { id: v.id("inventory") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

// Get inventory with product details
export const listWithProducts = query({
	args: {},
	handler: async (ctx) => {
		const inventory = await ctx.db.query("inventory").collect();

		return await Promise.all(
			inventory.map(async (item) => {
				const product = await ctx.db.get(item.productId);
				const supplier = item.supplierId
					? await ctx.db.get(item.supplierId)
					: null;

				return {
					...item,
					product,
					supplier,
				};
			}),
		);
	},
});

// Get expiring inventory (within X days)
export const getExpiring = query({
	args: { withinDays: v.number() },
	handler: async (ctx, args) => {
		const expiryThreshold = Date.now() + args.withinDays * 24 * 60 * 60 * 1000;

		const inventory = await ctx.db
			.query("inventory")
			.withIndex("by_expiry", (q) => q.lt("expiryDate", expiryThreshold))
			.filter((q) => q.gt(q.field("quantity"), 0))
			.collect();

		return await Promise.all(
			inventory.map(async (item) => {
				const product = await ctx.db.get(item.productId);
				return { ...item, product };
			}),
		);
	},
});

// Get low stock products (only active/tracked products)
export const getLowStock = query({
	args: {},
	handler: async (ctx) => {
		const products = await ctx.db
			.query("products")
			.withIndex("by_active", (q) => q.eq("isActive", true))
			.collect();

		const lowStockProducts = await Promise.all(
			products.map(async (product) => {
				const inventory = await ctx.db
					.query("inventory")
					.withIndex("by_product", (q) => q.eq("productId", product._id))
					.collect();

				const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

				return {
					...product,
					totalStock,
					isLowStock: totalStock < product.minStock,
				};
			}),
		);

		return lowStockProducts.filter((p) => p.isLowStock);
	},
});

export const create = mutation({
	args: {
		productId: v.id("products"),
		batchNumber: v.string(),
		quantity: v.number(),
		expiryDate: v.number(),
		purchasePrice: v.number(),
		supplierId: v.optional(v.id("suppliers")),
		purchaseOrderId: v.optional(v.id("purchaseOrders")),
		location: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("inventory", {
			productId: args.productId,
			batchNumber: args.batchNumber,
			quantity: args.quantity,
			expiryDate: args.expiryDate,
			purchasePrice: args.purchasePrice,
			supplierId: args.supplierId,
			purchaseOrderId: args.purchaseOrderId,
			location: args.location,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("inventory"),
		quantity: v.optional(v.number()),
		location: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { id, ...rest } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Inventory record not found");

		await ctx.db.patch(id, {
			...rest,
			updatedAt: Date.now(),
		});
		return await ctx.db.get(id);
	},
});

export const remove = mutation({
	args: { id: v.id("inventory") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
		return { success: true };
	},
});

// Adjust inventory quantity (for stock adjustments)
export const adjustQuantity = mutation({
	args: {
		id: v.id("inventory"),
		adjustment: v.number(), // positive or negative
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) throw new Error("Inventory record not found");

		const newQuantity = existing.quantity + args.adjustment;
		if (newQuantity < 0) {
			throw new Error("Insufficient stock");
		}

		await ctx.db.patch(args.id, {
			quantity: newQuantity,
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.id);
	},
});
