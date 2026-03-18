import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, writeAuditLog } from "./auditLogs";
import {
	allocateDiscountBreakdown,
	getMatchingRuleDiscounts,
} from "./discountCalculationUtils";

async function prepareSalesOrderItems(
	ctx: MutationCtx,
	args: {
		customerId: Id<"customers">;
		items: Array<{
			productId: Id<"products">;
			quantity: number;
			unitPrice: number;
			manualDiscountPercent?: number;
		}>;
	},
) {
	const discountRules = await ctx.db
		.query("discountRules")
		.withIndex("by_active", (q) => q.eq("isActive", true))
		.collect();

	const salesmen = await ctx.db.query("salesmen").collect();
	const salesmanNameById = new Map(
		salesmen.map((salesman) => [salesman._id, salesman.name]),
	);

	return args.items.map((item) => {
		const matched = getMatchingRuleDiscounts(
			discountRules,
			args.customerId,
			item.productId,
		);

		const autoDiscountPercent = Math.min(
			100,
			matched.reduce((sum, rule) => sum + rule.discountPercent, 0),
		);
		const discountPercent =
			item.manualDiscountPercent !== undefined
				? Math.min(100, Math.max(0, item.manualDiscountPercent))
				: autoDiscountPercent;

		const baseUnitPrice = item.unitPrice;
		const discountedUnitPrice = baseUnitPrice * (1 - discountPercent / 100);
		const discountAmount =
			item.quantity * (baseUnitPrice - discountedUnitPrice);
		const appliedDiscountBreakdown = allocateDiscountBreakdown(
			matched,
			discountPercent,
			discountAmount,
		).map((entry) => ({
			...entry,
			salesmanName: salesmanNameById.get(entry.salesmanId),
		}));

		return {
			...item,
			baseUnitPrice,
			unitPrice: discountedUnitPrice,
			discountPercent,
			discountAmount,
			appliedDiscountTypes: matched.map((rule) => rule.discountType),
			appliedDiscountBreakdown,
		};
	});
}

function assertValidSalesOrderItems(
	items: Array<{
		quantity: number;
		unitPrice: number;
	}>,
) {
	if (items.length === 0) {
		throw new Error("Đơn hàng phải có ít nhất một sản phẩm");
	}

	for (const item of items) {
		if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
			throw new Error("Số lượng sản phẩm phải lớn hơn 0");
		}

		if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
			throw new Error("Đơn giá sản phẩm không hợp lệ");
		}
	}
}

function formatSalesOrderText(value: string | undefined) {
	return value?.trim() ? value.trim() : undefined;
}

function formatSalesOrderItemsSummary(
	items: Array<{
		productLabel: string;
		quantity: number;
		unitPrice: number;
		discountPercent?: number;
	}>,
) {
	return items
		.map((item) => {
			const discountLabel =
				item.discountPercent !== undefined
					? ` | CK ${item.discountPercent}%`
					: "";
			return `${item.productLabel} | SL ${item.quantity} | Gia ${item.unitPrice}${discountLabel}`;
		})
		.join("\n");
}

function areSalesOrderItemsEquivalent(
	existingItems: Array<{
		productId: Id<"products">;
		quantity: number;
		baseUnitPrice?: number;
		unitPrice: number;
		discountPercent?: number;
	}>,
	nextItems: Array<{
		productId: Id<"products">;
		quantity: number;
		unitPrice: number;
		manualDiscountPercent?: number;
	}>,
) {
	if (existingItems.length !== nextItems.length) {
		return false;
	}

	const normalizeExisting = existingItems
		.map(
			(item) =>
				`${item.productId}|${item.quantity}|${item.baseUnitPrice ?? item.unitPrice}|${item.discountPercent ?? 0}`,
		)
		.sort();
	const normalizeNext = nextItems
		.map(
			(item) =>
				`${item.productId}|${item.quantity}|${item.unitPrice}|${item.manualDiscountPercent ?? 0}`,
		)
		.sort();

	return normalizeExisting.every(
		(item, index) => item === normalizeNext[index],
	);
}

function toSalesOrderAuditSnapshot(
	order: Doc<"salesOrders">,
	id?: Id<"salesOrders">,
) {
	return {
		id: id ?? order._id,
		orderNumber: order.orderNumber,
		customerId: order.customerId,
		salesmanId: order.salesmanId,
		status: order.status,
		totalAmount: order.totalAmount,
		totalDiscountAmount: order.totalDiscountAmount,
		orderDate: order.orderDate,
		notes: order.notes,
		updatedAt: order.updatedAt,
	};
}

// Generate order number
async function generateOrderNumber(ctx: MutationCtx): Promise<string> {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");

	const orders = await ctx.db
		.query("salesOrders")
		.filter((q) =>
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
				v.literal("delivering"),
				v.literal("completed"),
				v.literal("cancelled"),
			),
		),
	},
	handler: async (ctx, args) => {
		const status = args.status;
		if (status !== undefined) {
			return await ctx.db
				.query("salesOrders")
				.withIndex("by_status", (q) => q.eq("status", status))
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
		const deliveryEmployee = order.deliveryEmployeeId
			? await ctx.db.get(order.deliveryEmployeeId)
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
			deliveryEmployee,
			items: itemsWithProducts,
		};
	},
});

// Get status change history for an order
export const getStatusLogs = query({
	args: { salesOrderId: v.id("salesOrders") },
	handler: async (ctx, args) => {
		const logs = await ctx.db
			.query("salesOrderStatusLogs")
			.withIndex("by_salesOrder", (q) =>
				q.eq("salesOrderId", args.salesOrderId),
			)
			.order("asc")
			.collect();

		return await Promise.all(
			logs.map(async (log) => {
				const deliveryEmployee = log.deliveryEmployeeId
					? await ctx.db.get(log.deliveryEmployeeId)
					: null;
				return { ...log, deliveryEmployee };
			}),
		);
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
				manualDiscountPercent: v.optional(v.number()),
			}),
		),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const orderNumber = await generateOrderNumber(ctx);
		assertValidSalesOrderItems(args.items);

		const preparedItems = await prepareSalesOrderItems(ctx, args);

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
				appliedDiscountBreakdown: item.appliedDiscountBreakdown,
				fulfilledQuantity: 0,
				createdAt: now,
			});
		}

		const createdOrder = await ctx.db.get(orderId);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.salesOrderCreated,
			description: `Tạo đơn bán ${orderNumber}`,
			entityType: AUDIT_ENTITIES.salesOrder,
			entityId: orderId,
			after: createdOrder
				? toSalesOrderAuditSnapshot(createdOrder, orderId)
				: undefined,
			metadata: {
				itemCount: preparedItems.length,
			},
		});

		return createdOrder;
	},
});

export const update = mutation({
	args: {
		id: v.id("salesOrders"),
		customerId: v.id("customers"),
		salesmanId: v.optional(v.id("salesmen")),
		items: v.array(
			v.object({
				productId: v.id("products"),
				quantity: v.number(),
				unitPrice: v.number(),
				manualDiscountPercent: v.optional(v.number()),
			}),
		),
		notes: v.optional(v.string()),
		updatedByName: v.string(),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.id);
		if (!order) {
			throw new Error("Không tìm thấy đơn hàng");
		}

		const editorName = args.updatedByName.trim();
		if (!editorName) {
			throw new Error("Vui lòng nhập tên người sửa đơn");
		}

		const existingItems = await ctx.db
			.query("salesOrderItems")
			.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", args.id))
			.collect();

		assertValidSalesOrderItems(args.items);
		const hasFulfilledItems = existingItems.some(
			(item) => item.fulfilledQuantity > 0,
		);
		const now = Date.now();
		const nextNotes = formatSalesOrderText(args.notes);
		const existingNotes = formatSalesOrderText(order.notes);

		const customers = await ctx.db.query("customers").collect();
		const salesmen = await ctx.db.query("salesmen").collect();
		const products = await ctx.db.query("products").collect();

		const customerNameById = new Map(
			customers.map((item) => [item._id, item.name]),
		);
		const salesmanNameById = new Map(
			salesmen.map((item) => [item._id, item.name]),
		);
		const productNameById = new Map(
			products.map((item) => [item._id, item.name]),
		);

		const changes: Array<{
			field: string;
			from?: string;
			to?: string;
		}> = [];

		const pushChange = (field: string, from?: string, to?: string) => {
			if ((from ?? undefined) === (to ?? undefined)) {
				return;
			}
			changes.push({ field, from, to });
		};

		pushChange("notes", existingNotes, nextNotes);

		if (hasFulfilledItems) {
			const isSameHeader =
				order.customerId === args.customerId &&
				order.salesmanId === args.salesmanId;
			const isSameItems = areSalesOrderItemsEquivalent(
				existingItems,
				args.items,
			);

			if (!isSameHeader || !isSameItems) {
				throw new Error(
					"Đơn đã có giao hàng, chỉ có thể sửa ghi chú để tránh lệch tồn kho và dữ liệu đối soát",
				);
			}

			if (changes.length === 0) {
				return order;
			}

			await ctx.db.patch(args.id, {
				notes: nextNotes,
				updatedAt: now,
				editHistory: [
					...(order.editHistory ?? []),
					{
						editedAt: now,
						editedBy: editorName,
						changes,
					},
				],
			});
			const updatedOrder = await ctx.db.get(args.id);

			await writeAuditLog(ctx, {
				action: AUDIT_ACTIONS.salesOrderUpdated,
				description: `Cập nhật ghi chú đơn bán ${order.orderNumber}`,
				entityType: AUDIT_ENTITIES.salesOrder,
				entityId: args.id,
				before: toSalesOrderAuditSnapshot(order, args.id),
				after: updatedOrder
					? toSalesOrderAuditSnapshot(updatedOrder, args.id)
					: undefined,
				metadata: {
					onlyNotesChanged: true,
					editorName,
					changes,
				},
			});

			return updatedOrder;
		}

		pushChange(
			"customer",
			customerNameById.get(order.customerId),
			customerNameById.get(args.customerId),
		);
		pushChange(
			"salesman",
			order.salesmanId ? salesmanNameById.get(order.salesmanId) : undefined,
			args.salesmanId ? salesmanNameById.get(args.salesmanId) : undefined,
		);

		const preparedItems = await prepareSalesOrderItems(ctx, args);
		const existingItemsSummary = formatSalesOrderItemsSummary(
			existingItems.map((item) => ({
				productLabel: productNameById.get(item.productId) ?? item.productId,
				quantity: item.quantity,
				unitPrice: item.baseUnitPrice ?? item.unitPrice,
				discountPercent: item.discountPercent,
			})),
		);
		const nextItemsSummary = formatSalesOrderItemsSummary(
			preparedItems.map((item) => ({
				productLabel: productNameById.get(item.productId) ?? item.productId,
				quantity: item.quantity,
				unitPrice: item.baseUnitPrice,
				discountPercent: item.discountPercent,
			})),
		);
		pushChange("items", existingItemsSummary, nextItemsSummary);

		if (changes.length === 0) {
			return order;
		}

		const totalAmount = preparedItems.reduce(
			(sum, item) => sum + item.quantity * item.unitPrice,
			0,
		);
		const totalDiscountAmount = preparedItems.reduce(
			(sum, item) => sum + item.discountAmount,
			0,
		);
		const nextEditHistory =
			changes.length > 0
				? [
						...(order.editHistory ?? []),
						{
							editedAt: now,
							editedBy: editorName,
							changes,
						},
					]
				: order.editHistory;

		await ctx.db.patch(args.id, {
			customerId: args.customerId,
			salesmanId: args.salesmanId,
			totalAmount,
			totalDiscountAmount,
			notes: nextNotes,
			editHistory: nextEditHistory,
			updatedAt: now,
		});

		for (const existingItem of existingItems) {
			await ctx.db.delete(existingItem._id);
		}

		for (const item of preparedItems) {
			await ctx.db.insert("salesOrderItems", {
				salesOrderId: args.id,
				productId: item.productId,
				quantity: item.quantity,
				baseUnitPrice: item.baseUnitPrice,
				unitPrice: item.unitPrice,
				discountPercent: item.discountPercent,
				discountAmount: item.discountAmount,
				appliedDiscountTypes: item.appliedDiscountTypes,
				appliedDiscountBreakdown: item.appliedDiscountBreakdown,
				fulfilledQuantity: 0,
				createdAt: now,
			});
		}

		const updatedOrder = await ctx.db.get(args.id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.salesOrderUpdated,
			description: `Cập nhật đơn bán ${order.orderNumber}`,
			entityType: AUDIT_ENTITIES.salesOrder,
			entityId: args.id,
			before: toSalesOrderAuditSnapshot(order, args.id),
			after: updatedOrder
				? toSalesOrderAuditSnapshot(updatedOrder, args.id)
				: undefined,
			metadata: {
				editorName,
				changes,
				itemCount: preparedItems.length,
			},
		});

		return updatedOrder;
	},
});

export const updateStatus = mutation({
	args: {
		id: v.id("salesOrders"),
		status: v.union(
			v.literal("draft"),
			v.literal("pending"),
			v.literal("delivering"),
			v.literal("completed"),
			v.literal("cancelled"),
		),
		changedByName: v.string(),
		comment: v.optional(v.string()),
		deliveryEmployeeId: v.optional(v.id("employees")),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.id);
		if (!order) throw new Error("Không tìm thấy đơn hàng");
		const now = Date.now();

		const patchData: Record<string, unknown> = {
			status: args.status,
			updatedAt: now,
		};
		if (args.status === "completed") {
			patchData.completedAt = now;
		}
		if (args.deliveryEmployeeId) {
			patchData.deliveryEmployeeId = args.deliveryEmployeeId;
		}
		await ctx.db.patch(args.id, patchData);

		// Log the status change
		await ctx.db.insert("salesOrderStatusLogs", {
			salesOrderId: args.id,
			fromStatus: order.status,
			toStatus: args.status,
			changedByName: args.changedByName,
			comment: args.comment,
			deliveryEmployeeId: args.deliveryEmployeeId,
			createdAt: now,
		});

		const updatedOrder = await ctx.db.get(args.id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.salesOrderStatusChanged,
			description: `Đổi trạng thái đơn ${order.orderNumber}: ${order.status} -> ${args.status}`,
			entityType: AUDIT_ENTITIES.salesOrder,
			entityId: args.id,
			before: {
				status: order.status,
				deliveryEmployeeId: order.deliveryEmployeeId,
			},
			after: {
				status: args.status,
				deliveryEmployeeId:
					updatedOrder?.deliveryEmployeeId ??
					args.deliveryEmployeeId ??
					order.deliveryEmployeeId,
			},
			metadata: {
				changedByName: args.changedByName,
				comment: args.comment,
			},
		});

		return updatedOrder;
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
			status: fullyFulfilled ? "completed" : "delivering",
			completedAt: fullyFulfilled ? now : undefined,
			updatedAt: now,
		});

		const updatedOrder = await ctx.db.get(args.salesOrderId);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.salesOrderFulfilled,
			description: `Giao hàng đơn ${order.orderNumber}`,
			entityType: AUDIT_ENTITIES.salesOrder,
			entityId: args.salesOrderId,
			before: {
				status: order.status,
				completedAt: order.completedAt,
			},
			after: updatedOrder
				? {
						status: updatedOrder.status,
						completedAt: updatedOrder.completedAt,
					}
				: undefined,
			metadata: {
				itemFulfillments: args.items,
				fullyFulfilled,
			},
		});

		return updatedOrder;
	},
});

export const remove = mutation({
	args: { id: v.id("salesOrders") },
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.id);
		if (!order) throw new Error("Sales order not found");

		// Delete items
		const items = await ctx.db
			.query("salesOrderItems")
			.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", args.id))
			.collect();

		const statusLogs = await ctx.db
			.query("salesOrderStatusLogs")
			.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", args.id))
			.collect();

		for (const item of items) {
			await ctx.db.delete(item._id);
		}

		for (const log of statusLogs) {
			await ctx.db.delete(log._id);
		}

		await ctx.db.delete(args.id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.salesOrderDeleted,
			description: `Xóa đơn bán ${order.orderNumber}`,
			entityType: AUDIT_ENTITIES.salesOrder,
			entityId: args.id,
			before: toSalesOrderAuditSnapshot(order, args.id),
			metadata: {
				itemCount: items.length,
				statusLogCount: statusLogs.length,
			},
		});

		return { success: true };
	},
});
