import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate order number
async function generateOrderNumber(ctx: any): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const orders = await ctx.db
    .query("purchaseOrders")
    .filter((q: any) => q.gte(q.field("createdAt"), new Date(year, now.getMonth(), 1).getTime()))
    .collect();

  const sequence = String(orders.length + 1).padStart(4, "0");
  return `PO${year}${month}-${sequence}`;
}

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending"),
        v.literal("partial"),
        v.literal("received"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("purchaseOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("purchaseOrders").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get purchase order with items and details
export const getWithDetails = query({
  args: { id: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;

    const supplier = await ctx.db.get(order.supplierId);

    const items = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", args.id))
      .collect();

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { ...item, product };
      })
    );

    return {
      ...order,
      supplier,
      items: itemsWithProducts,
    };
  },
});

// List with supplier details
export const listWithSuppliers = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("purchaseOrders").order("desc").collect();

    return await Promise.all(
      orders.map(async (order) => {
        const supplier = await ctx.db.get(order.supplierId);
        return { ...order, supplier };
      })
    );
  },
});

export const create = mutation({
  args: {
    supplierId: v.id("suppliers"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
        unitPrice: v.number(),
      })
    ),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const orderNumber = await generateOrderNumber(ctx);

    // Calculate total
    const totalAmount = args.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const orderId = await ctx.db.insert("purchaseOrders", {
      orderNumber,
      supplierId: args.supplierId,
      status: "draft",
      totalAmount,
      notes: args.notes,
      orderDate: now,
      expectedDate: args.expectedDate,
      createdAt: now,
      updatedAt: now,
    });

    // Insert items
    for (const item of args.items) {
      await ctx.db.insert("purchaseOrderItems", {
        purchaseOrderId: orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        receivedQuantity: 0,
        createdAt: now,
      });
    }

    return await ctx.db.get(orderId);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("purchaseOrders"),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("partial"),
      v.literal("received"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.id);
  },
});

// Receive items from purchase order
export const receiveItems = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    items: v.array(
      v.object({
        itemId: v.id("purchaseOrderItems"),
        receivedQuantity: v.number(),
        batchNumber: v.string(),
        expiryDate: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.purchaseOrderId);
    if (!order) throw new Error("Purchase order not found");

    const now = Date.now();

    for (const item of args.items) {
      const poItem = await ctx.db.get(item.itemId);
      if (!poItem) continue;

      // Update received quantity
      const newReceivedQty = poItem.receivedQuantity + item.receivedQuantity;
      await ctx.db.patch(item.itemId, {
        receivedQuantity: newReceivedQty,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      });

      // Create inventory record
      await ctx.db.insert("inventory", {
        productId: poItem.productId,
        batchNumber: item.batchNumber,
        quantity: item.receivedQuantity,
        expiryDate: item.expiryDate,
        purchasePrice: poItem.unitPrice,
        supplierId: order.supplierId,
        purchaseOrderId: args.purchaseOrderId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Check if order is fully received
    const allItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_purchaseOrder", (q) =>
        q.eq("purchaseOrderId", args.purchaseOrderId)
      )
      .collect();

    const fullyReceived = allItems.every(
      (i) => i.receivedQuantity >= i.quantity
    );


    let newStatus: "partial" | "received" = "partial";
    if (fullyReceived) {
      newStatus = "received";
    }

    await ctx.db.patch(args.purchaseOrderId, {
      status: newStatus,
      updatedAt: now,
    });

    return await ctx.db.get(args.purchaseOrderId);
  },
});

export const remove = mutation({
  args: { id: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Purchase order not found");

    if (order.status !== "draft") {
      throw new Error("Can only delete draft orders");
    }

    // Delete items
    const items = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
