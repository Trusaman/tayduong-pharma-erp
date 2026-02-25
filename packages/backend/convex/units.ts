import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("units").order("asc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const value = args.name.toLowerCase().trim();
    
    // Check if unit already exists
    const existing = await ctx.db
      .query("units")
      .withIndex("by_value", (q) => q.eq("value", value))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("units", {
      name: args.name.trim(),
      value,
      createdAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("units") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
