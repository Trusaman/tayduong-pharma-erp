import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("customers")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("asc")
        .collect();
    }
    return await ctx.db.query("customers").order("asc").collect();
  },
});

export const getById = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
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
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Customer with this code already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("customers", {
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
    id: v.id("customers"),
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
    if (!existing) throw new Error("Customer not found");

    if (args.code && args.code !== existing.code) {
      const duplicate = await ctx.db
        .query("customers")
        .withIndex("by_code", (q) => q.eq("code", args.code!))
        .first();

      if (duplicate) {
        throw new Error("Customer with this code already exists");
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
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("salesOrders")
      .withIndex("by_customer", (q) => q.eq("customerId", args.id))
      .first();

    if (orders) {
      throw new Error("Cannot delete customer that has sales orders");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
