import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate order number
async function generateOrderNumber(ctx: any): Promise<string> {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");

	const orders = await ctx.db
		.query("salesOrders")
		.filter((q: any) =>
			q.gte(q.field("createdAt"), new Date(year, now.getMonth(), 1).getTime()),
		)
		.collect();

	const sequence = String(orders.length + 1).padStart(4, "0");
	return `SO${year}${month}-${sequence}`;
}

export const list = query({
	args: {
		status: v.optional(
			v.union(
				v.literal("draft"),
				v.literal("pending"),
				v.literal("partial"),
				v.literal("completed"),
				v.literal("cancelled"),
			),
		),
	},
	handler: async (ctx, args) => {
		if (args.status) {
			return await ctx.db
				.query("salesOrders")
				.withIndex("by_status", (q) => q.eq("status", args.status!))
				.order("desc")
				.collect();
		}
		return await ctx.db.query("salesOrders").order("desc").collect();
	},
});

export const getById = query({
	args: { id: v.id("salesOrders") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

// Get sales order with items and details
export const getWithDetails = query({
	args: { id: v.id("salesOrders") },
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.id);
		if (!order) return null;

		const customer = await ctx.db.get(order.customerId);
		const salesman = order.salesmanId
			? await ctx.db.get(order.salesmanId)
			: null;

		const items = await ctx.db
			.query("salesOrderItems")
			.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", args.id))
			.collect();

		const itemsWithProducts = await Promise.all(
			items.map(async (item) => {
				const product = await ctx.db.get(item.productId);
				return { ...item, product };
			}),
		);

		return {
			...order,
			customer,
			salesman,
			items: itemsWithProducts,
		};
	},
});

// List with customer details
export const listWithCustomers = query({
	args: {},
	handler: async (ctx) => {
		const orders = await ctx.db.query("salesOrders").order("desc").collect();

		return await Promise.all(
			orders.map(async (order) => {
				const customer = await ctx.db.get(order.customerId);
				const salesman = order.salesmanId
					? await ctx.db.get(order.salesmanId)
					: null;
				return { ...order, customer, salesman };
			}),
		);
	},
});

export const create = mutation({
	args: {
		customerId: v.id("customers"),
		salesmanId: v.optional(v.id("salesmen")),
		items: v.array(
			v.object({
				productId: v.id("products"),
				quantity: v.number(),
				unitPrice: v.number(),
			}),
		),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const orderNumber = await generateOrderNumber(ctx);

		let discountRules: Array<{
			_id: unknown;
			name: string;
			discountType: string;
			customerId?: unknown;
			productId?: unknown;
			discountPercent: number;
			isActive: boolean;
		}> = [];

		if (args.salesmanId) {
			discountRules = await ctx.db
				.query("discountRules")
				.withIndex("by_salesman", (q) => q.eq("salesmanId", args.salesmanId!))
				.filter((q) => q.eq(q.field("isActive"), true))
				.collect();
		}

		const preparedItems = args.items.map((item) => {
			const matched = discountRules.filter((rule) => {
				const customerMatch =
					!rule.customerId || rule.customerId === args.customerId;
				const productMatch =
					!rule.productId || rule.productId === item.productId;
				return customerMatch && productMatch;
			});

			const discountPercent = Math.min(
				100,
				matched.reduce((sum, rule) => sum + rule.discountPercent, 0),
			);

			const baseUnitPrice = item.unitPrice;
			const discountedUnitPrice = baseUnitPrice * (1 - discountPercent / 100);
			const discountAmount =
				item.quantity * (baseUnitPrice - discountedUnitPrice);

			return {
				...item,
				baseUnitPrice,
				unitPrice: discountedUnitPrice,
				discountPercent,
				discountAmount,
				appliedDiscountTypes: matched.map((rule) => rule.discountType),
			};
		});

		const totalAmount = preparedItems.reduce(
			(sum, item) => sum + item.quantity * item.unitPrice,
			0,
		);
		const totalDiscountAmount = preparedItems.reduce(
			(sum, item) => sum + item.discountAmount,
			0,
		);

		const orderId = await ctx.db.insert("salesOrders", {
			orderNumber,
			customerId: args.customerId,
			salesmanId: args.salesmanId,
			status: "draft",
			totalAmount,
			totalDiscountAmount,
			notes: args.notes,
			orderDate: now,
			createdAt: now,
			updatedAt: now,
		});

		// Insert items
		for (const item of preparedItems) {
			await ctx.db.insert("salesOrderItems", {
				salesOrderId: orderId,
				productId: item.productId,
				quantity: item.quantity,
				baseUnitPrice: item.baseUnitPrice,
				unitPrice: item.unitPrice,
				discountPercent: item.discountPercent,
				discountAmount: item.discountAmount,
				appliedDiscountTypes: item.appliedDiscountTypes,
				fulfilledQuantity: 0,
				createdAt: now,
			});
		}

		return await ctx.db.get(orderId);
	},
});

export const updateStatus = mutation({
	args: {
		id: v.id("salesOrders"),
		status: v.union(
			v.literal("draft"),
			v.literal("pending"),
			v.literal("partial"),
			v.literal("completed"),
			v.literal("cancelled"),
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

// Fulfill items from sales order (reduces inventory)
export const fulfillItems = mutation({
	args: {
		salesOrderId: v.id("salesOrders"),
		items: v.array(
			v.object({
				itemId: v.id("salesOrderItems"),
				fulfilledQuantity: v.number(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.salesOrderId);
		if (!order) throw new Error("Sales order not found");

		const now = Date.now();

		for (const item of args.items) {
			const soItem = await ctx.db.get(item.itemId);
			if (!soItem) continue;

			// Update fulfilled quantity
			const newFulfilledQty = soItem.fulfilledQuantity + item.fulfilledQuantity;
			await ctx.db.patch(item.itemId, {
				fulfilledQuantity: newFulfilledQty,
			});

			// Reduce inventory (FIFO - first expiring first out)
			const inventory = await ctx.db
				.query("inventory")
				.withIndex("by_product", (q) => q.eq("productId", soItem.productId))
				.filter((q) => q.gt(q.field("quantity"), 0))
				.order("asc")
				.collect();

			let remainingToDeduct = item.fulfilledQuantity;

			for (const inv of inventory) {
				if (remainingToDeduct <= 0) break;

				const deductAmount = Math.min(inv.quantity, remainingToDeduct);
				await ctx.db.patch(inv._id, {
					quantity: inv.quantity - deductAmount,
					updatedAt: now,
				});

				remainingToDeduct -= deductAmount;
			}

			if (remainingToDeduct > 0) {
				throw new Error(`Insufficient stock for product ${soItem.productId}`);
			}
		}

		// Check if order is fully fulfilled
		const allItems = await ctx.db
			.query("salesOrderItems")
			.withIndex("by_salesOrder", (q) =>
				q.eq("salesOrderId", args.salesOrderId),
			)
			.collect();

		const fullyFulfilled = allItems.every(
			(i) => i.fulfilledQuantity >= i.quantity,
		);

		await ctx.db.patch(args.salesOrderId, {
			status: fullyFulfilled ? "completed" : "partial",
			updatedAt: now,
		});

		return await ctx.db.get(args.salesOrderId);
	},
});

export const remove = mutation({
	args: { id: v.id("salesOrders") },
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.id);
		if (!order) throw new Error("Sales order not found");

		if (order.status !== "draft") {
			throw new Error("Can only delete draft orders");
		}

		// Delete items
		const items = await ctx.db
			.query("salesOrderItems")
			.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", args.id))
			.collect();

		for (const item of items) {
			await ctx.db.delete(item._id);
		}

		await ctx.db.delete(args.id);
		return { success: true };
	},
});
