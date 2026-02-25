import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("suppliers")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("asc")
        .collect();
    }
    return await ctx.db.query("suppliers").order("asc").collect();
  },
});

export const getById = query({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppliers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if code already exists
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Supplier with this code already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("suppliers", {
      name: args.name,
      code: args.code,
      contactPerson: args.contactPerson,
      email: args.email,
      phone: args.phone,
      address: args.address,
      taxId: args.taxId,
      notes: args.notes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Supplier not found");

    if (args.code && args.code !== existing.code) {
      const duplicate = await ctx.db
        .query("suppliers")
        .withIndex("by_code", (q) => q.eq("code", args.code!))
        .first();

      if (duplicate) {
        throw new Error("Supplier with this code already exists");
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
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    // Check if supplier has purchase orders
    const orders = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
      .first();

    if (orders) {
      throw new Error("Cannot delete supplier that has purchase orders");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
