import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, writeAuditLog } from "./auditLogs";
import { requireCurrentUserAdmin } from "./auth";

function toSupplierAuditSnapshot(
	supplier: Doc<"suppliers">,
	id?: Id<"suppliers">,
) {
	return {
		id: id ?? supplier._id,
		code: supplier.code,
		name: supplier.name,
		contactPerson: supplier.contactPerson,
		email: supplier.email,
		phone: supplier.phone,
		isActive: supplier.isActive,
		updatedAt: supplier.updatedAt,
	};
}

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
		await requireCurrentUserAdmin(ctx);

		// Check if code already exists
		const existing = await ctx.db
			.query("suppliers")
			.withIndex("by_code", (q) => q.eq("code", args.code))
			.first();

		if (existing) {
			throw new Error("Supplier with this code already exists");
		}

		const now = Date.now();
		const createdSupplierId = await ctx.db.insert("suppliers", {
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

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.supplierCreated,
			description: `Tạo nhà cung cấp ${args.code}`,
			entityType: AUDIT_ENTITIES.supplier,
			entityId: createdSupplierId,
			after: {
				id: createdSupplierId,
				name: args.name,
				code: args.code,
				isActive: true,
			},
		});

		return createdSupplierId;
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
		await requireCurrentUserAdmin(ctx);

		const { id, ...rest } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Supplier not found");

		if (args.code && args.code !== existing.code) {
			const nextCode = args.code;
			const duplicate = await ctx.db
				.query("suppliers")
				.withIndex("by_code", (q) => q.eq("code", nextCode))
				.first();

			if (duplicate) {
				throw new Error("Supplier with this code already exists");
			}
		}

		const patchData = {
			...rest,
			updatedAt: Date.now(),
		};

		await ctx.db.patch(id, patchData);
		const updatedSupplier = await ctx.db.get(id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.supplierUpdated,
			description: `Cập nhật nhà cung cấp ${updatedSupplier?.code ?? existing.code}`,
			entityType: AUDIT_ENTITIES.supplier,
			entityId: id,
			before: toSupplierAuditSnapshot(existing),
			after: updatedSupplier
				? toSupplierAuditSnapshot(updatedSupplier, id)
				: undefined,
		});

		return updatedSupplier;
	},
});

export const remove = mutation({
	args: { id: v.id("suppliers") },
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		// Check if supplier has purchase orders
		const orders = await ctx.db
			.query("purchaseOrders")
			.withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
			.first();

		if (orders) {
			throw new Error("Cannot delete supplier that has purchase orders");
		}

		const supplier = await ctx.db.get(args.id);
		if (!supplier) {
			throw new Error("Supplier not found");
		}

		await ctx.db.delete(args.id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.supplierDeleted,
			description: `Xóa nhà cung cấp ${supplier.code}`,
			entityType: AUDIT_ENTITIES.supplier,
			entityId: args.id,
			before: toSupplierAuditSnapshot(supplier, args.id),
		});

		return { success: true };
	},
});
