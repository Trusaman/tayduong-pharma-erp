import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate transfer number
async function generateTransferNumber(
	ctx: any,
	transferType: string,
): Promise<string> {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");

	// Prefix based on type
	let prefix = "PN"; // Phiếu Nhập (default for import)
	if (transferType === "import_return") prefix = "PNH"; // Phiếu Nhập Hàng trả
	if (transferType === "export") prefix = "PX"; // Phiếu Xuất
	if (transferType === "export_return") prefix = "PXT"; // Phiếu Xuất Trả
	if (transferType === "export_gift") prefix = "PXTG"; // Phiếu Xuất Tặng
	if (transferType === "export_destruction") prefix = "PXH"; // Phiếu Xuất Hủy

	const transfers = await ctx.db
		.query("stockTransfers")
		.filter((q: any) => q.eq(q.field("transferType"), transferType))
		.filter((q: any) =>
			q.gte(q.field("createdAt"), new Date(year, now.getMonth(), 1).getTime()),
		)
		.collect();

	const sequence = String(transfers.length + 1).padStart(4, "0");
	return `${prefix}${year}${month}-${sequence}`;
}

export const list = query({
	args: {
		transferType: v.optional(
			v.union(
				v.literal("import"),
				v.literal("import_return"),
				v.literal("export"),
				v.literal("export_return"),
				v.literal("export_gift"),
				v.literal("export_destruction"),
			),
		),
		status: v.optional(
			v.union(
				v.literal("draft"),
				v.literal("confirmed"),
				v.literal("cancelled"),
			),
		),
	},
	handler: async (ctx, args) => {
		const query = ctx.db.query("stockTransfers");

		if (args.transferType) {
			return await query
				.withIndex("by_transferType", (q) =>
					q.eq("transferType", args.transferType!),
				)
				.order("desc")
				.collect();
		}

		if (args.status) {
			return await query
				.withIndex("by_status", (q) => q.eq("status", args.status!))
				.order("desc")
				.collect();
		}

		return await ctx.db.query("stockTransfers").order("desc").collect();
	},
});

export const getById = query({
	args: { id: v.id("stockTransfers") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

// Get transfer with items and partner details
export const getWithDetails = query({
	args: { id: v.id("stockTransfers") },
	handler: async (ctx, args) => {
		const transfer = await ctx.db.get(args.id);
		if (!transfer) return null;

		// Get partner info
		let partner = null;
		if (transfer.partnerId) {
			partner = await ctx.db.get(transfer.partnerId);
		}

		// Get items
		const items = await ctx.db
			.query("stockTransferItems")
			.withIndex("by_stockTransfer", (q) => q.eq("stockTransferId", args.id))
			.collect();

		const itemsWithProducts = await Promise.all(
			items.map(async (item) => {
				const product = await ctx.db.get(item.productId);
				return { ...item, product };
			}),
		);

		return {
			...transfer,
			partner,
			items: itemsWithProducts,
		};
	},
});

// List with partner details
export const listWithPartners = query({
	args: {
		transferType: v.optional(
			v.union(
				v.literal("import"),
				v.literal("import_return"),
				v.literal("export"),
				v.literal("export_return"),
				v.literal("export_gift"),
				v.literal("export_destruction"),
			),
		),
	},
	handler: async (ctx, args) => {
		let transfers;

		if (args.transferType) {
			transfers = await ctx.db
				.query("stockTransfers")
				.withIndex("by_transferType", (q) =>
					q.eq("transferType", args.transferType!),
				)
				.order("desc")
				.collect();
		} else {
			transfers = await ctx.db.query("stockTransfers").order("desc").collect();
		}

		return await Promise.all(
			transfers.map(async (transfer) => {
				let partner = null;
				if (transfer.partnerId) {
					partner = await ctx.db.get(transfer.partnerId);
				}
				return { ...transfer, partner };
			}),
		);
	},
});

// Create stock transfer (draft)
export const create = mutation({
	args: {
		transferType: v.union(
			v.literal("import"),
			v.literal("import_return"),
			v.literal("export"),
			v.literal("export_return"),
			v.literal("export_gift"),
			v.literal("export_destruction"),
		),
		referenceType: v.optional(
			v.union(
				v.literal("purchaseOrder"),
				v.literal("salesOrder"),
				v.literal("manual"),
			),
		),
		referenceId: v.optional(v.id("purchaseOrders")),
		partnerType: v.optional(
			v.union(v.literal("supplier"), v.literal("customer")),
		),
		partnerId: v.optional(v.id("suppliers")),
		notes: v.optional(v.string()),
		transferDate: v.number(),
		items: v.array(
			v.object({
				productId: v.id("products"),
				inventoryId: v.optional(v.id("inventory")),
				batchNumber: v.string(),
				quantity: v.number(),
				unitPrice: v.number(),
				expiryDate: v.number(),
				reason: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const transferNumber = await generateTransferNumber(ctx, args.transferType);

		const transferId = await ctx.db.insert("stockTransfers", {
			transferNumber,
			transferType: args.transferType,
			referenceType: args.referenceType,
			referenceId: args.referenceId,
			partnerType: args.partnerType,
			partnerId: args.partnerId,
			status: "draft",
			notes: args.notes,
			transferDate: args.transferDate,
			createdAt: now,
			updatedAt: now,
		});

		// Insert items
		for (const item of args.items) {
			await ctx.db.insert("stockTransferItems", {
				stockTransferId: transferId,
				productId: item.productId,
				inventoryId: item.inventoryId,
				batchNumber: item.batchNumber,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				expiryDate: item.expiryDate,
				reason: item.reason,
				createdAt: now,
			});
		}

		return await ctx.db.get(transferId);
	},
});

// Confirm stock transfer - update inventory
export const confirm = mutation({
	args: { id: v.id("stockTransfers") },
	handler: async (ctx, args) => {
		const transfer = await ctx.db.get(args.id);
		if (!transfer) throw new Error("Phiếu không tồn tại");
		if (transfer.status !== "draft")
			throw new Error("Chỉ có thể xác nhận phiếu nháp");

		const now = Date.now();
		const items = await ctx.db
			.query("stockTransferItems")
			.withIndex("by_stockTransfer", (q) => q.eq("stockTransferId", args.id))
			.collect();

		const isImport = ["import", "import_return"].includes(
			transfer.transferType,
		);

		for (const item of items) {
			if (isImport) {
				// Import: create or update inventory
				// Check if batch already exists
				const existingBatch = await ctx.db
					.query("inventory")
					.withIndex("by_batch", (q) => q.eq("batchNumber", item.batchNumber))
					.filter((q) => q.eq(q.field("productId"), item.productId))
					.first();

				if (existingBatch) {
					// Update quantity
					await ctx.db.patch(existingBatch._id, {
						quantity: existingBatch.quantity + item.quantity,
						updatedAt: now,
					});
				} else {
					// Create new inventory record
					await ctx.db.insert("inventory", {
						productId: item.productId,
						batchNumber: item.batchNumber,
						quantity: item.quantity,
						expiryDate: item.expiryDate,
						purchasePrice: item.unitPrice,
						supplierId:
							transfer.partnerType === "supplier"
								? transfer.partnerId
								: undefined,
						stockTransferId: args.id,
						createdAt: now,
						updatedAt: now,
					});
				}
			} else {
				// Export: reduce inventory
				if (!item.inventoryId) {
					throw new Error("Cần chọn lô hàng cho sản phẩm khi xuất kho");
				}

				const inventory = await ctx.db.get(item.inventoryId);
				if (!inventory) throw new Error("Lô hàng không tồn tại");
				if (inventory.quantity < item.quantity) {
					throw new Error(`Không đủ tồn kho cho lô ${item.batchNumber}`);
				}

				const newQuantity = inventory.quantity - item.quantity;
				await ctx.db.patch(item.inventoryId, {
					quantity: newQuantity,
					updatedAt: now,
				});
			}
		}

		// Update transfer status
		await ctx.db.patch(args.id, {
			status: "confirmed",
			updatedAt: now,
		});

		return await ctx.db.get(args.id);
	},
});

// Cancel stock transfer
export const cancel = mutation({
	args: { id: v.id("stockTransfers") },
	handler: async (ctx, args) => {
		const transfer = await ctx.db.get(args.id);
		if (!transfer) throw new Error("Phiếu không tồn tại");
		if (transfer.status !== "draft")
			throw new Error("Chỉ có thể hủy phiếu nháp");

		await ctx.db.patch(args.id, {
			status: "cancelled",
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.id);
	},
});

// Delete stock transfer (only draft)
export const remove = mutation({
	args: { id: v.id("stockTransfers") },
	handler: async (ctx, args) => {
		const transfer = await ctx.db.get(args.id);
		if (!transfer) throw new Error("Phiếu không tồn tại");
		if (transfer.status !== "draft") {
			throw new Error("Chỉ có thể xóa phiếu nháp");
		}

		// Delete items
		const items = await ctx.db
			.query("stockTransferItems")
			.withIndex("by_stockTransfer", (q) => q.eq("stockTransferId", args.id))
			.collect();

		for (const item of items) {
			await ctx.db.delete(item._id);
		}

		await ctx.db.delete(args.id);
		return { success: true };
	},
});

// Get available inventory for export
export const getAvailableInventory = query({
	args: { productId: v.id("products") },
	handler: async (ctx, args) => {
		const inventory = await ctx.db
			.query("inventory")
			.withIndex("by_product", (q) => q.eq("productId", args.productId))
			.filter((q) => q.gt(q.field("quantity"), 0))
			.collect();

		return inventory;
	},
});
