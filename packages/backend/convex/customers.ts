import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, writeAuditLog } from "./auditLogs";
import { requireCurrentUserAdmin } from "./auth";

const customerPayloadValidator = {
	name: v.string(),
	code: v.string(),
	contactPerson: v.optional(v.string()),
	email: v.optional(v.string()),
	phone: v.optional(v.string()),
	address: v.optional(v.string()),
	taxId: v.optional(v.string()),
	province: v.optional(v.string()),
	billingAddress: v.optional(v.string()),
	shippingAddress: v.optional(v.string()),
	companyDirector: v.optional(v.string()),
	paymentResponsibleName: v.optional(v.string()),
	orderResponsibleName: v.optional(v.string()),
	employeeCode: v.optional(v.string()),
	territory: v.optional(v.string()),
	biddingContactName: v.optional(v.string()),
	biddingContactPhone: v.optional(v.string()),
	biddingContactNotes: v.optional(v.string()),
	paymentContactName: v.optional(v.string()),
	paymentContactPhone: v.optional(v.string()),
	paymentContactNotes: v.optional(v.string()),
	receivingContactName: v.optional(v.string()),
	receivingContactPhone: v.optional(v.string()),
	receivingContactNotes: v.optional(v.string()),
	otherContactName: v.optional(v.string()),
	otherContactPhone: v.optional(v.string()),
	otherContactNotes: v.optional(v.string()),
	notes: v.optional(v.string()),
	isActive: v.optional(v.boolean()),
} as const;

const MAX_BULK_CUSTOMERS = 500;

function toCustomerAuditSnapshot(
	customer: Doc<"customers">,
	id?: Id<"customers">,
) {
	return {
		id: id ?? customer._id,
		code: customer.code,
		name: customer.name,
		email: customer.email,
		phone: customer.phone,
		province: customer.province,
		isActive: customer.isActive,
		updatedAt: customer.updatedAt,
	};
}

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
	args: customerPayloadValidator,
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		const existing = await ctx.db
			.query("customers")
			.withIndex("by_code", (q) => q.eq("code", args.code))
			.first();

		if (existing) {
			throw new Error("Customer with this code already exists");
		}

		const now = Date.now();
		const createdCustomerId = await ctx.db.insert("customers", {
			name: args.name,
			code: args.code,
			contactPerson: args.contactPerson,
			email: args.email,
			phone: args.phone,
			address: args.address,
			taxId: args.taxId,
			province: args.province,
			billingAddress: args.billingAddress,
			shippingAddress: args.shippingAddress,
			companyDirector: args.companyDirector,
			paymentResponsibleName: args.paymentResponsibleName,
			orderResponsibleName: args.orderResponsibleName,
			employeeCode: args.employeeCode,
			territory: args.territory,
			biddingContactName: args.biddingContactName,
			biddingContactPhone: args.biddingContactPhone,
			biddingContactNotes: args.biddingContactNotes,
			paymentContactName: args.paymentContactName,
			paymentContactPhone: args.paymentContactPhone,
			paymentContactNotes: args.paymentContactNotes,
			receivingContactName: args.receivingContactName,
			receivingContactPhone: args.receivingContactPhone,
			receivingContactNotes: args.receivingContactNotes,
			otherContactName: args.otherContactName,
			otherContactPhone: args.otherContactPhone,
			otherContactNotes: args.otherContactNotes,
			notes: args.notes,
			isActive: args.isActive ?? true,
			createdAt: now,
			updatedAt: now,
		});

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.customerCreated,
			description: `Tạo khách hàng ${args.code}`,
			entityType: AUDIT_ENTITIES.customer,
			entityId: createdCustomerId,
			after: {
				id: createdCustomerId,
				name: args.name,
				code: args.code,
				isActive: args.isActive ?? true,
			},
		});

		return createdCustomerId;
	},
});

export const createMany = mutation({
	args: {
		rows: v.array(v.object(customerPayloadValidator)),
	},
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		if (args.rows.length === 0) {
			throw new Error("Không có dữ liệu để import");
		}
		if (args.rows.length > MAX_BULK_CUSTOMERS) {
			throw new Error(
				`Chỉ có thể import tối đa ${MAX_BULK_CUSTOMERS} khách hàng mỗi lần`,
			);
		}

		const normalizedRows = args.rows.map((row) => ({
			...row,
			code: row.code.trim(),
			name: row.name.trim(),
		}));

		const invalidRows = normalizedRows.filter((row) => !row.code || !row.name);
		if (invalidRows.length > 0) {
			throw new Error("Dữ liệu import phải có Mã khách hàng và Tên khách hàng");
		}

		const duplicateInFile = normalizedRows.find(
			(row, index) =>
				normalizedRows.findIndex((item) => item.code === row.code) !== index,
		);
		if (duplicateInFile) {
			throw new Error(
				`Mã khách hàng bị trùng trong file import: ${duplicateInFile.code}`,
			);
		}

		for (const row of normalizedRows) {
			const existing = await ctx.db
				.query("customers")
				.withIndex("by_code", (q) => q.eq("code", row.code))
				.first();

			if (existing) {
				throw new Error(`Mã khách hàng đã tồn tại: ${row.code}`);
			}
		}

		const now = Date.now();
		const insertedIds = [];
		for (const row of normalizedRows) {
			const insertedId = await ctx.db.insert("customers", {
				...row,
				isActive: row.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			});
			insertedIds.push(insertedId);
		}

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.customerImported,
			description: `Import ${insertedIds.length} khách hàng`,
			entityType: AUDIT_ENTITIES.customer,
			metadata: {
				count: insertedIds.length,
				codes: normalizedRows.map((row) => row.code),
			},
		});

		return {
			count: insertedIds.length,
			insertedIds,
		};
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
		province: v.optional(v.string()),
		billingAddress: v.optional(v.string()),
		shippingAddress: v.optional(v.string()),
		companyDirector: v.optional(v.string()),
		paymentResponsibleName: v.optional(v.string()),
		orderResponsibleName: v.optional(v.string()),
		employeeCode: v.optional(v.string()),
		territory: v.optional(v.string()),
		biddingContactName: v.optional(v.string()),
		biddingContactPhone: v.optional(v.string()),
		biddingContactNotes: v.optional(v.string()),
		paymentContactName: v.optional(v.string()),
		paymentContactPhone: v.optional(v.string()),
		paymentContactNotes: v.optional(v.string()),
		receivingContactName: v.optional(v.string()),
		receivingContactPhone: v.optional(v.string()),
		receivingContactNotes: v.optional(v.string()),
		otherContactName: v.optional(v.string()),
		otherContactPhone: v.optional(v.string()),
		otherContactNotes: v.optional(v.string()),
		notes: v.optional(v.string()),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		const { id, ...rest } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Customer not found");

		if (args.code && args.code !== existing.code) {
			const nextCode = args.code;
			const duplicate = await ctx.db
				.query("customers")
				.withIndex("by_code", (q) => q.eq("code", nextCode))
				.first();

			if (duplicate) {
				throw new Error("Customer with this code already exists");
			}
		}

		const patchData = {
			...rest,
			updatedAt: Date.now(),
		};

		await ctx.db.patch(id, patchData);
		const updatedCustomer = await ctx.db.get(id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.customerUpdated,
			description: `Cập nhật khách hàng ${updatedCustomer?.code ?? existing.code}`,
			entityType: AUDIT_ENTITIES.customer,
			entityId: id,
			before: toCustomerAuditSnapshot(existing),
			after: updatedCustomer
				? toCustomerAuditSnapshot(updatedCustomer, id)
				: undefined,
		});

		return updatedCustomer;
	},
});

export const remove = mutation({
	args: { id: v.id("customers") },
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		const customer = await ctx.db.get(args.id);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const orders = await ctx.db
			.query("salesOrders")
			.withIndex("by_customer", (q) => q.eq("customerId", args.id))
			.first();

		if (orders) {
			throw new Error("Cannot delete customer that has sales orders");
		}

		const discountRule = await ctx.db
			.query("discountRules")
			.withIndex("by_customer", (q) => q.eq("customerId", args.id))
			.first();

		if (discountRule) {
			throw new Error(
				"Không thể xóa khách hàng đang được dùng trong bảng chiết khấu",
			);
		}

		await ctx.db.delete(args.id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.customerDeleted,
			description: `Xóa khách hàng ${customer.code}`,
			entityType: AUDIT_ENTITIES.customer,
			entityId: args.id,
			before: toCustomerAuditSnapshot(customer, args.id),
		});

		return { success: true };
	},
});

export const removeMany = mutation({
	args: { ids: v.array(v.id("customers")) },
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		if (args.ids.length === 0) {
			throw new Error("Không có khách hàng để xóa");
		}
		if (args.ids.length > MAX_BULK_CUSTOMERS) {
			throw new Error(
				`Chỉ có thể xóa tối đa ${MAX_BULK_CUSTOMERS} khách hàng mỗi lần`,
			);
		}

		const uniqueIds = [...new Set(args.ids)];
		for (const customerId of uniqueIds) {
			const customer = await ctx.db.get(customerId);
			if (!customer) {
				throw new Error("Customer not found");
			}

			const orders = await ctx.db
				.query("salesOrders")
				.withIndex("by_customer", (q) => q.eq("customerId", customerId))
				.first();

			if (orders) {
				throw new Error(
					`Không thể xóa khách hàng ${customer?.code ?? ""} vì đã có đơn hàng`,
				);
			}

			const discountRule = await ctx.db
				.query("discountRules")
				.withIndex("by_customer", (q) => q.eq("customerId", customerId))
				.first();

			if (discountRule) {
				throw new Error(
					`Không thể xóa khách hàng ${customer.code} vì đang được dùng trong bảng chiết khấu`,
				);
			}
		}

		const removedCustomers: Array<{ id: string; code: string; name: string }> =
			[];
		for (const customerId of uniqueIds) {
			const customer = await ctx.db.get(customerId);
			if (!customer) {
				continue;
			}

			await ctx.db.delete(customerId);
			removedCustomers.push({
				id: customerId,
				code: customer.code,
				name: customer.name,
			});
		}

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.customerDeleted,
			description: `Xóa hàng loạt ${removedCustomers.length} khách hàng`,
			entityType: AUDIT_ENTITIES.customer,
			metadata: {
				count: removedCustomers.length,
				customers: removedCustomers,
			},
		});

		return { success: true, deletedCount: uniqueIds.length };
	},
});
