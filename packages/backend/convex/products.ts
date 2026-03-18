import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, writeAuditLog } from "./auditLogs";
import { requireCurrentUserAdmin } from "./auth";

const pickDefined = <T extends Record<string, unknown>>(input: T) => {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as Partial<T>;
};

function toProductAuditSnapshot(product: Doc<"products">, id?: Id<"products">) {
	return {
		id: id ?? product._id,
		sku: product.sku,
		name: product.name,
		categoryId: product.categoryId,
		purchasePrice: product.purchasePrice,
		salePrice: product.salePrice,
		minStock: product.minStock,
		isActive: product.isActive,
		updatedAt: product.updatedAt,
	};
}

export const list = query({
	args: {
		activeOnly: v.optional(v.boolean()),
		categoryId: v.optional(v.id("categories")),
	},
	handler: async (ctx, args) => {
		const query = ctx.db.query("products");

		if (args.activeOnly) {
			return await query
				.withIndex("by_active", (q) => q.eq("isActive", true))
				.order("asc")
				.collect();
		}

		if (args.categoryId) {
			return await query
				.withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
				.order("asc")
				.collect();
		}

		return await query.order("asc").collect();
	},
});

export const getById = query({
	args: { id: v.id("products") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const getBySku = query({
	args: { sku: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("products")
			.withIndex("by_sku", (q) => q.eq("sku", args.sku))
			.first();
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		sku: v.string(),
		categoryId: v.optional(v.id("categories")),
		productType: v.optional(
			v.union(
				v.literal("thuoc"),
				v.literal("vtyt"),
				v.literal("tpcn"),
				v.literal("khac"),
			),
		),
		activeIngredient: v.optional(v.string()),
		strength: v.optional(v.string()),
		administrationRoute: v.optional(v.string()),
		dosageForm: v.optional(v.string()),
		packagingSpecification: v.optional(v.string()),
		drugGroup: v.optional(v.string()),
		shelfLife: v.optional(v.string()),
		registrationNumber: v.optional(v.string()),
		registrationExpiryDate: v.optional(v.number()),
		manufacturer: v.optional(v.string()),
		countryOfOrigin: v.optional(v.string()),
		description: v.optional(v.string()),
		unit: v.string(),
		declarationDate: v.optional(v.number()),
		declarationUnit: v.optional(v.string()),
		declarationDecisionNumber: v.optional(v.string()),
		declarationValidity: v.optional(v.string()),
		biddingUnit: v.optional(v.string()),
		indication: v.optional(v.string()),
		prescriptionType: v.optional(
			v.union(
				v.literal("prescription"),
				v.literal("non_prescription"),
				v.literal("other"),
			),
		),
		vatRate: v.optional(v.number()),
		isActive: v.optional(v.boolean()),
		purchasePrice: v.number(),
		salePrice: v.number(),
		minStock: v.number(),
	},
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		// Check if SKU already exists
		const existing = await ctx.db
			.query("products")
			.withIndex("by_sku", (q) => q.eq("sku", args.sku))
			.first();

		if (existing) {
			throw new Error("Product with this SKU already exists");
		}

		const now = Date.now();
		const createdProductId = await ctx.db.insert("products", {
			name: args.name,
			sku: args.sku,
			...(args.categoryId !== undefined ? { categoryId: args.categoryId } : {}),
			...(args.productType !== undefined
				? { productType: args.productType }
				: {}),
			...(args.activeIngredient !== undefined
				? { activeIngredient: args.activeIngredient }
				: {}),
			...(args.strength !== undefined ? { strength: args.strength } : {}),
			...(args.administrationRoute !== undefined
				? { administrationRoute: args.administrationRoute }
				: {}),
			...(args.dosageForm !== undefined ? { dosageForm: args.dosageForm } : {}),
			...(args.packagingSpecification !== undefined
				? { packagingSpecification: args.packagingSpecification }
				: {}),
			...(args.drugGroup !== undefined ? { drugGroup: args.drugGroup } : {}),
			...(args.shelfLife !== undefined ? { shelfLife: args.shelfLife } : {}),
			...(args.registrationNumber !== undefined
				? { registrationNumber: args.registrationNumber }
				: {}),
			...(args.registrationExpiryDate !== undefined
				? { registrationExpiryDate: args.registrationExpiryDate }
				: {}),
			...(args.manufacturer !== undefined
				? { manufacturer: args.manufacturer }
				: {}),
			...(args.countryOfOrigin !== undefined
				? { countryOfOrigin: args.countryOfOrigin }
				: {}),
			...(args.description !== undefined
				? { description: args.description }
				: {}),
			unit: args.unit,
			...(args.declarationDate !== undefined
				? { declarationDate: args.declarationDate }
				: {}),
			...(args.declarationUnit !== undefined
				? { declarationUnit: args.declarationUnit }
				: {}),
			...(args.declarationDecisionNumber !== undefined
				? { declarationDecisionNumber: args.declarationDecisionNumber }
				: {}),
			...(args.declarationValidity !== undefined
				? { declarationValidity: args.declarationValidity }
				: {}),
			...(args.biddingUnit !== undefined
				? { biddingUnit: args.biddingUnit }
				: {}),
			...(args.indication !== undefined ? { indication: args.indication } : {}),
			...(args.prescriptionType !== undefined
				? { prescriptionType: args.prescriptionType }
				: {}),
			...(args.vatRate !== undefined ? { vatRate: args.vatRate } : {}),
			purchasePrice: args.purchasePrice,
			salePrice: args.salePrice,
			minStock: args.minStock,
			isActive: args.isActive ?? true,
			createdAt: now,
			updatedAt: now,
		});

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.productCreated,
			description: `Tạo sản phẩm ${args.sku}`,
			entityType: AUDIT_ENTITIES.product,
			entityId: createdProductId,
			after: {
				id: createdProductId,
				name: args.name,
				sku: args.sku,
				isActive: args.isActive ?? true,
				purchasePrice: args.purchasePrice,
				salePrice: args.salePrice,
			},
		});

		return createdProductId;
	},
});

export const update = mutation({
	args: {
		id: v.id("products"),
		name: v.optional(v.string()),
		sku: v.optional(v.string()),
		categoryId: v.optional(v.id("categories")),
		productType: v.optional(
			v.union(
				v.literal("thuoc"),
				v.literal("vtyt"),
				v.literal("tpcn"),
				v.literal("khac"),
			),
		),
		activeIngredient: v.optional(v.string()),
		strength: v.optional(v.string()),
		administrationRoute: v.optional(v.string()),
		dosageForm: v.optional(v.string()),
		packagingSpecification: v.optional(v.string()),
		drugGroup: v.optional(v.string()),
		shelfLife: v.optional(v.string()),
		registrationNumber: v.optional(v.string()),
		registrationExpiryDate: v.optional(v.number()),
		manufacturer: v.optional(v.string()),
		countryOfOrigin: v.optional(v.string()),
		description: v.optional(v.string()),
		unit: v.optional(v.string()),
		declarationDate: v.optional(v.number()),
		declarationUnit: v.optional(v.string()),
		declarationDecisionNumber: v.optional(v.string()),
		declarationValidity: v.optional(v.string()),
		biddingUnit: v.optional(v.string()),
		indication: v.optional(v.string()),
		prescriptionType: v.optional(
			v.union(
				v.literal("prescription"),
				v.literal("non_prescription"),
				v.literal("other"),
			),
		),
		vatRate: v.optional(v.number()),
		purchasePrice: v.optional(v.number()),
		salePrice: v.optional(v.number()),
		minStock: v.optional(v.number()),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		const { id, ...rest } = args;
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Product not found");

		// If SKU is being updated, check for duplicates
		if (args.sku && args.sku !== existing.sku) {
			const nextSku = args.sku;
			const duplicate = await ctx.db
				.query("products")
				.withIndex("by_sku", (q) => q.eq("sku", nextSku))
				.first();

			if (duplicate) {
				throw new Error("Product with this SKU already exists");
			}
		}

		const patchData = pickDefined({
			...rest,
			updatedAt: Date.now(),
		});

		await ctx.db.patch(id, patchData);
		const updatedProduct = await ctx.db.get(id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.productUpdated,
			description: `Cập nhật sản phẩm ${updatedProduct?.sku ?? existing.sku}`,
			entityType: AUDIT_ENTITIES.product,
			entityId: id,
			before: toProductAuditSnapshot(existing),
			after: updatedProduct
				? toProductAuditSnapshot(updatedProduct, id)
				: undefined,
		});

		return updatedProduct;
	},
});

export const remove = mutation({
	args: { id: v.id("products") },
	handler: async (ctx, args) => {
		await requireCurrentUserAdmin(ctx);

		// Check if product has inventory
		const inventory = await ctx.db
			.query("inventory")
			.withIndex("by_product", (q) => q.eq("productId", args.id))
			.first();

		if (inventory) {
			throw new Error("Cannot delete product that has inventory");
		}

		const product = await ctx.db.get(args.id);
		if (!product) {
			throw new Error("Product not found");
		}

		await ctx.db.delete(args.id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.productDeleted,
			description: `Xóa sản phẩm ${product.sku}`,
			entityType: AUDIT_ENTITIES.product,
			entityId: args.id,
			before: toProductAuditSnapshot(product, args.id),
		});

		return { success: true };
	},
});

// Get product with stock info
export const getWithStock = query({
	args: { id: v.id("products") },
	handler: async (ctx, args) => {
		const product = await ctx.db.get(args.id);
		if (!product) return null;

		const inventory = await ctx.db
			.query("inventory")
			.withIndex("by_product", (q) => q.eq("productId", args.id))
			.collect();

		const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

		return {
			...product,
			totalStock,
			isLowStock: totalStock < product.minStock,
		};
	},
});

// List products with stock info
export const listWithStock = query({
	args: {
		activeOnly: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const products = args.activeOnly
			? await ctx.db
					.query("products")
					.withIndex("by_active", (q) => q.eq("isActive", true))
					.collect()
			: await ctx.db.query("products").collect();

		const productsWithStock = await Promise.all(
			products.map(async (product) => {
				const inventory = await ctx.db
					.query("inventory")
					.withIndex("by_product", (q) => q.eq("productId", product._id))
					.collect();

				const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

				return {
					...product,
					totalStock,
					isLowStock: totalStock < product.minStock,
				};
			}),
		);

		return productsWithStock;
	},
});
