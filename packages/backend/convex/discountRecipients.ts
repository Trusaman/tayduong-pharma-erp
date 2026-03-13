import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: { activeOnly: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		const recipients = await ctx.db.query("salesmen").order("asc").collect();

		if (!args.activeOnly) {
			return recipients;
		}

		return recipients.filter((recipient) => recipient.isActive !== false);
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		code: v.string(),
		phone: v.optional(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const normalizedCode = args.code.trim().toUpperCase();
		const existing = await ctx.db
			.query("salesmen")
			.withIndex("by_code", (q) => q.eq("code", normalizedCode))
			.first();

		if (existing) {
			throw new Error("Mã người nhận chiết khấu đã tồn tại");
		}

		const now = Date.now();
		return await ctx.db.insert("salesmen", {
			name: args.name.trim(),
			code: normalizedCode,
			phone: args.phone?.trim() || undefined,
			notes: args.notes?.trim() || undefined,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("salesmen"),
		name: v.optional(v.string()),
		code: v.optional(v.string()),
		phone: v.optional(v.string()),
		notes: v.optional(v.string()),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { id } = args;
		const existing = await ctx.db.get(id);
		if (!existing) {
			throw new Error("Không tìm thấy người nhận chiết khấu");
		}

		const nextCode = args.code?.trim().toUpperCase();
		if (nextCode && nextCode !== existing.code) {
			const duplicate = await ctx.db
				.query("salesmen")
				.withIndex("by_code", (q) => q.eq("code", nextCode))
				.first();

			if (duplicate) {
				throw new Error("Mã người nhận chiết khấu đã tồn tại");
			}
		}

		const patch: {
			name?: string;
			code?: string;
			phone?: string;
			notes?: string;
			isActive?: boolean;
			updatedAt: number;
		} = {
			updatedAt: Date.now(),
		};

		if (args.name !== undefined) {
			patch.name = args.name.trim();
		}

		if (nextCode !== undefined) {
			patch.code = nextCode;
		}

		if (args.phone !== undefined) {
			patch.phone = args.phone.trim() || undefined;
		}

		if (args.notes !== undefined) {
			patch.notes = args.notes.trim() || undefined;
		}

		if (args.isActive !== undefined) {
			patch.isActive = args.isActive;
		}

		await ctx.db.patch(id, patch);

		return await ctx.db.get(id);
	},
});

export const remove = mutation({
	args: { id: v.id("salesmen") },
	handler: async (ctx, args) => {
		const order = await ctx.db
			.query("salesOrders")
			.withIndex("by_salesman", (q) => q.eq("salesmanId", args.id))
			.first();

		if (order) {
			throw new Error(
				"Không thể xóa người nhận chiết khấu đang được dùng trong đơn bán",
			);
		}

		const discounts = await ctx.db.query("discountRules").collect();
		const hasDiscount = discounts.some((discount) => {
			return [
				discount.doctorDiscount?.salesmanId,
				discount.salesDiscount?.salesmanId,
				discount.paymentDiscount?.salesmanId,
				discount.ctvDiscount?.salesmanId,
				discount.managerDiscount?.salesmanId,
				discount.salesmanId,
			].includes(args.id);
		});

		if (hasDiscount) {
			throw new Error(
				"Không thể xóa người nhận chiết khấu đang được dùng trong chính sách chiết khấu",
			);
		}

		await ctx.db.delete(args.id);
		return { success: true };
	},
});
