import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const discountTypeValidator = v.union(
  v.literal("Doctor"),
  v.literal("hospital"),
  v.literal("payment"),
  v.literal("Salesman"),
  v.literal("Manager")
);

function clampPercent(percent: number) {
  if (percent < 0) return 0;
  if (percent > 100) return 100;
  return percent;
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
        const customer = rule.customerId ? await ctx.db.get(rule.customerId) : null;
        const product = rule.productId ? await ctx.db.get(rule.productId) : null;
        const salesman = await ctx.db.get(rule.salesmanId);
        return { ...rule, customer, product, salesman };
      })
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
    createdByStaff: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Discount rule not found");

    await ctx.db.patch(id, {
      ...rest,
      discountPercent:
        typeof args.discountPercent === "number"
          ? clampPercent(args.discountPercent)
          : undefined,
      updatedAt: Date.now(),
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
        const customerMatch = !rule.customerId || rule.customerId === args.customerId;
        const productMatch = !rule.productId || rule.productId === productId;
        return customerMatch && productMatch;
      });

      const totalPercent = clampPercent(
        matched.reduce((sum, rule) => sum + rule.discountPercent, 0)
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
