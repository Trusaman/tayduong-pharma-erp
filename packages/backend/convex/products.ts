import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("products");

    if (args.activeOnly) {
      return await query
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("asc")
        .collect();
    }

    if (args.categoryId) {
      return await query
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .order("asc")
        .collect();
    }

    return await query.order("asc").collect();
  },
});

export const getById = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySku = query({
  args: { sku: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    sku: v.string(),
    categoryId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
    unit: v.string(),
    purchasePrice: v.number(),
    salePrice: v.number(),
    minStock: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if SKU already exists
    const existing = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();

    if (existing) {
      throw new Error("Product with this SKU already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("products", {
      name: args.name,
      sku: args.sku,
      categoryId: args.categoryId,
      description: args.description,
      unit: args.unit,
      purchasePrice: args.purchasePrice,
      salePrice: args.salePrice,
      minStock: args.minStock,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    sku: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    salePrice: v.optional(v.number()),
    minStock: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Product not found");

    // If SKU is being updated, check for duplicates
    if (args.sku && args.sku !== existing.sku) {
      const duplicate = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", args.sku!))
        .first();

      if (duplicate) {
        throw new Error("Product with this SKU already exists");
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
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    // Check if product has inventory
    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_product", (q) => q.eq("productId", args.id))
      .first();

    if (inventory) {
      throw new Error("Cannot delete product that has inventory");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Get product with stock info
export const getWithStock = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) return null;

    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_product", (q) => q.eq("productId", args.id))
      .collect();

    const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

    return {
      ...product,
      totalStock,
      isLowStock: totalStock < product.minStock,
    };
  },
});

// List products with stock info
export const listWithStock = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const products = args.activeOnly
      ? await ctx.db
          .query("products")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect()
      : await ctx.db.query("products").collect();

    const productsWithStock = await Promise.all(
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
      })
    );

    return productsWithStock;
  },
});
