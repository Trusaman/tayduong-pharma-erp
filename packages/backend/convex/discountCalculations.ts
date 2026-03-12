import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	allocateDiscountBreakdown,
	getMatchingRuleDiscounts,
	roundMoney,
} from "./discountCalculationUtils";

const paymentStatusValidator = v.union(
	v.literal("unpaid"),
	v.literal("partial"),
	v.literal("paid"),
);

type CalculationCtx = QueryCtx | MutationCtx;
const discountTypes = [
	"Doctor",
	"hospital",
	"payment",
	"CTV",
	"Salesman",
	"Manager",
] as const;

type DiscountTypeKey = (typeof discountTypes)[number];
type RecipientByType = Record<DiscountTypeKey, number>;
type PreviewEntry = {
	salesmanId: Id<"salesmen">;
	salesmanName: string;
	salesOrderId: Id<"salesOrders">;
	salesOrderItemId: Id<"salesOrderItems">;
	orderNumber: string;
	orderDate: number;
	completedAt: number;
	customerId: Id<"customers">;
	customerName: string;
	productId: Id<"products">;
	productName: string;
	quantity: number;
	baseUnitPrice: number;
	revenueAmount: number;
	lineDiscountAmount: number;
	discountType: DiscountTypeKey;
	ruleId?: Id<"discountRules">;
	ruleName: string;
	configuredPercent: number;
	allocatedPercent: number;
	discountAmount: number;
};

type UnassignedEntry = {
	salesOrderId: Id<"salesOrders">;
	salesOrderItemId: Id<"salesOrderItems">;
	orderNumber: string;
	completedAt: number;
	customerName: string;
	productName: string;
	lineDiscountAmount: number;
	reason: string;
};

type SalesOrderItemPreview = {
	_id: Id<"salesOrderItems">;
	productId: Id<"products">;
	quantity: number;
	baseUnitPrice?: number;
	unitPrice: number;
	discountPercent?: number;
	discountAmount?: number;
	appliedDiscountBreakdown?: Array<{
		ruleId: Id<"discountRules">;
		ruleName: string;
		discountType: DiscountTypeKey;
		salesmanId: Id<"salesmen">;
		salesmanName?: string;
		configuredPercent: number;
		allocatedPercent: number;
		discountAmount: number;
	}>;
};

function getPeriodRange(month: number, year: number) {
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new ConvexError({ message: "Tháng không hợp lệ" });
	}

	if (!Number.isInteger(year) || year < 2000 || year > 3000) {
		throw new ConvexError({ message: "Năm không hợp lệ" });
	}

	const startDate = new Date(year, month - 1, 1).getTime();
	const endDate = new Date(year, month, 1).getTime();
	return {
		month,
		year,
		startDate,
		endDate,
		periodKey: `${year}-${String(month).padStart(2, "0")}`,
	};
}

function createEmptyByType(): RecipientByType {
	return {
		Doctor: 0,
		hospital: 0,
		payment: 0,
		CTV: 0,
		Salesman: 0,
		Manager: 0,
	};
}

async function buildPreview(ctx: CalculationCtx, month: number, year: number) {
	const period = getPeriodRange(month, year);
	const [ordersByCompletedAt, legacyOrders, rules, salesmen] =
		await Promise.all([
			ctx.db
				.query("salesOrders")
				.withIndex("by_status_and_completedAt", (q) =>
					q
						.eq("status", "completed")
						.gte("completedAt", period.startDate)
						.lt("completedAt", period.endDate),
				)
				.collect(),
			ctx.db
				.query("salesOrders")
				.withIndex("by_status", (q) => q.eq("status", "completed"))
				.collect(),
			ctx.db.query("discountRules").collect(),
			ctx.db.query("salesmen").collect(),
		]);

	const salesmanNameById = new Map(
		salesmen.map((salesman) => [salesman._id, salesman.name]),
	);

	const completedOrders = [
		...ordersByCompletedAt,
		...legacyOrders.filter((order) => {
			if (order.completedAt) return false;
			return (
				order.orderDate >= period.startDate && order.orderDate < period.endDate
			);
		}),
	].sort((left, right) => {
		const leftCompletedAt =
			left.completedAt ?? left.updatedAt ?? left.orderDate;
		const rightCompletedAt =
			right.completedAt ?? right.updatedAt ?? right.orderDate;
		return rightCompletedAt - leftCompletedAt;
	});

	const customerIds = [
		...new Set(completedOrders.map((order) => order.customerId)),
	];
	const customerDocs = await Promise.all(
		customerIds.map((id) => ctx.db.get(id)),
	);
	const customerNameById = new Map(
		customerDocs.flatMap((customer) =>
			customer ? [[customer._id, customer.name] as const] : [],
		),
	);

	const allItems = await Promise.all(
		completedOrders.map(async (order) => {
			const items = await ctx.db
				.query("salesOrderItems")
				.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", order._id))
				.collect();
			return { orderId: order._id, items };
		}),
	);

	const productIds = [
		...new Set(
			allItems.flatMap((entry) => entry.items.map((item) => item.productId)),
		),
	];
	const productDocs = await Promise.all(productIds.map((id) => ctx.db.get(id)));
	const productNameById = new Map(
		productDocs.flatMap((product) =>
			product ? [[product._id, product.name] as const] : [],
		),
	);
	const itemsByOrder = new Map<Id<"salesOrders">, SalesOrderItemPreview[]>(
		allItems.map((entry) => [entry.orderId, entry.items]),
	);

	const previewEntries: PreviewEntry[] = [];
	const unassignedEntries: UnassignedEntry[] = [];

	for (const order of completedOrders) {
		const completedAt = order.completedAt ?? order.updatedAt ?? order.orderDate;
		const items = itemsByOrder.get(order._id) ?? [];

		for (const item of items) {
			const baseUnitPrice = item.baseUnitPrice ?? item.unitPrice;
			const lineDiscountAmount = roundMoney(
				item.discountAmount ??
					item.quantity * Math.max(0, baseUnitPrice - item.unitPrice),
			);

			if (lineDiscountAmount <= 0) {
				continue;
			}

			const breakdown =
				item.appliedDiscountBreakdown &&
				item.appliedDiscountBreakdown.length > 0
					? item.appliedDiscountBreakdown
					: allocateDiscountBreakdown(
							getMatchingRuleDiscounts(rules, order.customerId, item.productId),
							item.discountPercent ?? 0,
							lineDiscountAmount,
						).map((detail) => ({
							...detail,
							salesmanName: salesmanNameById.get(detail.salesmanId),
						}));

			if (breakdown.length === 0) {
				unassignedEntries.push({
					salesOrderId: order._id,
					salesOrderItemId: item._id,
					orderNumber: order.orderNumber,
					completedAt,
					customerName:
						customerNameById.get(order.customerId) ??
						"Khách hàng không xác định",
					productName:
						productNameById.get(item.productId) ?? "Sản phẩm không xác định",
					lineDiscountAmount,
					reason:
						"Dòng chiết khấu chưa có người nhận trong cấu hình hoặc không lưu được breakdown trên đơn.",
				});
				continue;
			}

			for (const detail of breakdown) {
				if (detail.discountAmount <= 0) {
					continue;
				}

				previewEntries.push({
					salesmanId: detail.salesmanId,
					salesmanName:
						detail.salesmanName ??
						salesmanNameById.get(detail.salesmanId) ??
						"Không xác định",
					salesOrderId: order._id,
					salesOrderItemId: item._id,
					orderNumber: order.orderNumber,
					orderDate: order.orderDate,
					completedAt,
					customerId: order.customerId,
					customerName:
						customerNameById.get(order.customerId) ??
						"Khách hàng không xác định",
					productId: item.productId,
					productName:
						productNameById.get(item.productId) ?? "Sản phẩm không xác định",
					quantity: item.quantity,
					baseUnitPrice,
					revenueAmount: roundMoney(item.quantity * baseUnitPrice),
					lineDiscountAmount,
					discountType: detail.discountType,
					ruleId: detail.ruleId,
					ruleName: detail.ruleName,
					configuredPercent: detail.configuredPercent,
					allocatedPercent: detail.allocatedPercent,
					discountAmount: roundMoney(detail.discountAmount),
				});
			}
		}
	}

	const recipients = new Map<
		Id<"salesmen">,
		{
			salesmanId: Id<"salesmen">;
			salesmanName: string;
			totalDiscountAmount: number;
			orderIds: Set<string>;
			entriesCount: number;
			byType: RecipientByType;
		}
	>();

	for (const entry of previewEntries) {
		const existing = recipients.get(entry.salesmanId);
		if (existing) {
			existing.totalDiscountAmount = roundMoney(
				existing.totalDiscountAmount + entry.discountAmount,
			);
			existing.orderIds.add(String(entry.salesOrderId));
			existing.entriesCount += 1;
			existing.byType[entry.discountType] = roundMoney(
				existing.byType[entry.discountType] + entry.discountAmount,
			);
			continue;
		}

		const byType = createEmptyByType();
		byType[entry.discountType] = entry.discountAmount;
		recipients.set(entry.salesmanId, {
			salesmanId: entry.salesmanId,
			salesmanName: entry.salesmanName,
			totalDiscountAmount: entry.discountAmount,
			orderIds: new Set([String(entry.salesOrderId)]),
			entriesCount: 1,
			byType,
		});
	}

	const recipientRows = Array.from(recipients.values())
		.map((recipient) => ({
			salesmanId: recipient.salesmanId,
			salesmanName: recipient.salesmanName,
			totalDiscountAmount: recipient.totalDiscountAmount,
			entriesCount: recipient.entriesCount,
			byType: recipient.byType,
			orderCount: recipient.orderIds.size,
		}))
		.sort(
			(left, right) => right.totalDiscountAmount - left.totalDiscountAmount,
		);

	const discountedOrderCount = new Set(
		previewEntries.map((entry) => String(entry.salesOrderId)),
	).size;

	const existingCalculation = await ctx.db
		.query("monthlyDiscountCalculations")
		.withIndex("by_period_key", (q) => q.eq("periodKey", period.periodKey))
		.first();

	return {
		period,
		entries: previewEntries.sort((left, right) => {
			if (right.completedAt !== left.completedAt) {
				return right.completedAt - left.completedAt;
			}
			return right.discountAmount - left.discountAmount;
		}),
		unassignedEntries: unassignedEntries.sort(
			(left, right) => right.completedAt - left.completedAt,
		),
		recipients: recipientRows,
		totals: {
			completedOrderCount: completedOrders.length,
			discountedOrderCount,
			entryCount: previewEntries.length,
			recipientCount: recipientRows.length,
			totalDiscountAmount: roundMoney(
				previewEntries.reduce((sum, entry) => sum + entry.discountAmount, 0),
			),
			unassignedEntryCount: unassignedEntries.length,
			unassignedTotalAmount: roundMoney(
				unassignedEntries.reduce(
					(sum, entry) => sum + entry.lineDiscountAmount,
					0,
				),
			),
		},
		existingCalculation,
	};
}

async function ensureReplaceableCalculation(
	ctx: MutationCtx,
	existingCalculationId: Id<"monthlyDiscountCalculations">,
) {
	const debts = await ctx.db
		.query("employeeDiscountDebts")
		.withIndex("by_calculation", (q) =>
			q.eq("calculationId", existingCalculationId),
		)
		.collect();

	for (const debt of debts) {
		const payments = await ctx.db
			.query("employeeDiscountDebtPayments")
			.withIndex("by_debt", (q) => q.eq("debtId", debt._id))
			.collect();
		if (payments.length > 0) {
			throw new ConvexError({
				message:
					"Tháng này đã phát sinh thanh toán công nợ, không thể lưu đè bảng tính.",
			});
		}
	}

	const entries = await ctx.db
		.query("monthlyDiscountCalculationEntries")
		.withIndex("by_calculation", (q) =>
			q.eq("calculationId", existingCalculationId),
		)
		.collect();

	for (const entry of entries) {
		await ctx.db.delete(entry._id);
	}

	for (const debt of debts) {
		await ctx.db.delete(debt._id);
	}
}

export const repairMonthlySourceOrders = mutation({
	args: {
		month: v.number(),
		year: v.number(),
	},
	handler: async (ctx, args) => {
		const period = getPeriodRange(args.month, args.year);
		const [ordersByCompletedAt, legacyOrders, rules, salesmen] =
			await Promise.all([
				ctx.db
					.query("salesOrders")
					.withIndex("by_status_and_completedAt", (q) =>
						q
							.eq("status", "completed")
							.gte("completedAt", period.startDate)
							.lt("completedAt", period.endDate),
					)
					.collect(),
				ctx.db
					.query("salesOrders")
					.withIndex("by_status", (q) => q.eq("status", "completed"))
					.collect(),
				ctx.db
					.query("discountRules")
					.withIndex("by_active", (q) => q.eq("isActive", true))
					.collect(),
				ctx.db.query("salesmen").collect(),
			]);

		const salesmanNameById = new Map(
			salesmen.map((salesman) => [salesman._id, salesman.name]),
		);

		const completedOrders = [
			...ordersByCompletedAt,
			...legacyOrders.filter((order) => {
				if (order.completedAt) return false;
				return (
					order.orderDate >= period.startDate &&
					order.orderDate < period.endDate
				);
			}),
		];

		let repairedOrderCount = 0;
		let repairedItemCount = 0;
		const repairedOrderNumbers: string[] = [];

		for (const order of completedOrders) {
			const items = await ctx.db
				.query("salesOrderItems")
				.withIndex("by_salesOrder", (q) => q.eq("salesOrderId", order._id))
				.collect();

			if (items.length === 0) {
				continue;
			}

			let orderChanged = false;
			const recalculatedItems = [];

			for (const item of items) {
				const matched = getMatchingRuleDiscounts(
					rules,
					order.customerId,
					item.productId,
				);
				const autoDiscountPercent = Math.min(
					100,
					matched.reduce((sum, rule) => sum + rule.discountPercent, 0),
				);
				const hasStoredDiscount =
					(item.discountPercent ?? 0) > 0 || (item.discountAmount ?? 0) > 0;
				const hasBreakdown = (item.appliedDiscountBreakdown?.length ?? 0) > 0;
				const hasAppliedDiscountTypes =
					(item.appliedDiscountTypes?.length ?? 0) > 0;
				const hasRecoverableBasePrice =
					typeof item.baseUnitPrice === "number" &&
					Math.abs(item.baseUnitPrice - item.unitPrice) < 0.001;

				if (
					autoDiscountPercent <= 0 ||
					hasStoredDiscount ||
					hasBreakdown ||
					!hasAppliedDiscountTypes ||
					!hasRecoverableBasePrice
				) {
					recalculatedItems.push(item);
					continue;
				}

				const baseUnitPrice = item.baseUnitPrice;
				if (typeof baseUnitPrice !== "number") {
					recalculatedItems.push(item);
					continue;
				}
				const discountedUnitPrice = roundMoney(
					baseUnitPrice * (1 - autoDiscountPercent / 100),
				);
				const discountAmount = roundMoney(
					item.quantity * (baseUnitPrice - discountedUnitPrice),
				);
				const appliedDiscountBreakdown = allocateDiscountBreakdown(
					matched,
					autoDiscountPercent,
					discountAmount,
				).map((detail) => ({
					...detail,
					salesmanName: salesmanNameById.get(detail.salesmanId),
				}));

				await ctx.db.patch(item._id, {
					baseUnitPrice,
					unitPrice: discountedUnitPrice,
					discountPercent: autoDiscountPercent,
					discountAmount,
					appliedDiscountTypes: matched.map((rule) => rule.discountType),
					appliedDiscountBreakdown,
				});

				recalculatedItems.push({
					...item,
					baseUnitPrice,
					unitPrice: discountedUnitPrice,
					discountPercent: autoDiscountPercent,
					discountAmount,
					appliedDiscountTypes: matched.map((rule) => rule.discountType),
					appliedDiscountBreakdown,
				});
				orderChanged = true;
				repairedItemCount += 1;
			}

			if (!orderChanged) {
				continue;
			}

			await ctx.db.patch(order._id, {
				totalAmount: roundMoney(
					recalculatedItems.reduce(
						(sum, item) => sum + item.quantity * item.unitPrice,
						0,
					),
				),
				totalDiscountAmount: roundMoney(
					recalculatedItems.reduce(
						(sum, item) => sum + (item.discountAmount ?? 0),
						0,
					),
				),
			});

			repairedOrderCount += 1;
			repairedOrderNumbers.push(order.orderNumber);
		}

		return {
			periodKey: period.periodKey,
			repairedOrderCount,
			repairedItemCount,
			repairedOrderNumbers,
		};
	},
});

export const previewMonthly = query({
	args: {
		month: v.number(),
		year: v.number(),
	},
	handler: async (ctx, args) => {
		return await buildPreview(ctx, args.month, args.year);
	},
});

export const saveMonthly = mutation({
	args: {
		month: v.number(),
		year: v.number(),
		savedBy: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const savedBy = args.savedBy.trim();
		if (!savedBy) {
			throw new ConvexError({ message: "Vui lòng nhập người lưu bảng tính" });
		}

		const preview = await buildPreview(ctx, args.month, args.year);
		if (preview.entries.length === 0) {
			throw new ConvexError({
				message:
					"Không có dữ liệu chiết khấu từ đơn hoàn thành trong tháng này.",
			});
		}

		if (preview.totals.unassignedTotalAmount > 0) {
			throw new ConvexError({
				message:
					"Tháng này còn dòng chiết khấu chưa xác định người nhận. Vui lòng rà lại đơn hàng hoặc cấu hình trước khi lưu.",
			});
		}

		const now = Date.now();
		let calculationId = preview.existingCalculation?._id;

		if (calculationId) {
			await ensureReplaceableCalculation(ctx, calculationId);
			await ctx.db.patch(calculationId, {
				month: preview.period.month,
				year: preview.period.year,
				startDate: preview.period.startDate,
				endDate: preview.period.endDate,
				orderCount: preview.totals.discountedOrderCount,
				entryCount: preview.totals.entryCount,
				recipientCount: preview.totals.recipientCount,
				totalDiscountAmount: preview.totals.totalDiscountAmount,
				savedBy,
				notes: args.notes?.trim() ? args.notes.trim() : undefined,
				updatedAt: now,
			});
		} else {
			calculationId = await ctx.db.insert("monthlyDiscountCalculations", {
				periodKey: preview.period.periodKey,
				month: preview.period.month,
				year: preview.period.year,
				startDate: preview.period.startDate,
				endDate: preview.period.endDate,
				orderCount: preview.totals.discountedOrderCount,
				entryCount: preview.totals.entryCount,
				recipientCount: preview.totals.recipientCount,
				totalDiscountAmount: preview.totals.totalDiscountAmount,
				savedBy,
				notes: args.notes?.trim() ? args.notes.trim() : undefined,
				createdAt: now,
				updatedAt: now,
			});
		}

		for (const entry of preview.entries) {
			await ctx.db.insert("monthlyDiscountCalculationEntries", {
				calculationId,
				periodKey: preview.period.periodKey,
				month: preview.period.month,
				year: preview.period.year,
				salesmanId: entry.salesmanId,
				salesmanNameSnapshot: entry.salesmanName,
				salesOrderId: entry.salesOrderId,
				salesOrderItemId: entry.salesOrderItemId,
				orderNumber: entry.orderNumber,
				orderDate: entry.orderDate,
				completedAt: entry.completedAt,
				customerId: entry.customerId,
				customerNameSnapshot: entry.customerName,
				productId: entry.productId,
				productNameSnapshot: entry.productName,
				quantity: entry.quantity,
				baseUnitPrice: entry.baseUnitPrice,
				revenueAmount: entry.revenueAmount,
				lineDiscountAmount: entry.lineDiscountAmount,
				discountType: entry.discountType,
				ruleId: entry.ruleId,
				ruleName: entry.ruleName,
				configuredPercent: entry.configuredPercent,
				allocatedPercent: entry.allocatedPercent,
				discountAmount: entry.discountAmount,
				createdAt: now,
			});
		}

		for (const recipient of preview.recipients) {
			await ctx.db.insert("employeeDiscountDebts", {
				calculationId,
				periodKey: preview.period.periodKey,
				month: preview.period.month,
				year: preview.period.year,
				salesmanId: recipient.salesmanId,
				salesmanNameSnapshot: recipient.salesmanName,
				totalDebtAmount: recipient.totalDiscountAmount,
				paidAmount: 0,
				remainingAmount: recipient.totalDiscountAmount,
				paymentStatus: "unpaid",
				notes: args.notes?.trim() ? args.notes.trim() : undefined,
				createdAt: now,
				updatedAt: now,
			});
		}

		return {
			calculationId,
			periodKey: preview.period.periodKey,
			entryCount: preview.totals.entryCount,
			recipientCount: preview.totals.recipientCount,
			totalDiscountAmount: preview.totals.totalDiscountAmount,
		};
	},
});

export const listSavedMonths = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("monthlyDiscountCalculations")
			.order("desc")
			.collect();
	},
});

export const listDebts = query({
	args: {
		periodKey: v.optional(v.string()),
		paymentStatus: v.optional(paymentStatusValidator),
	},
	handler: async (ctx, args) => {
		const periodKey = args.periodKey;
		const debts =
			typeof periodKey === "string"
				? await ctx.db
						.query("employeeDiscountDebts")
						.withIndex("by_period_key", (q) => q.eq("periodKey", periodKey))
						.collect()
				: await ctx.db.query("employeeDiscountDebts").collect();

		const filtered = args.paymentStatus
			? debts.filter((debt) => debt.paymentStatus === args.paymentStatus)
			: debts;

		const calculations = await Promise.all(
			filtered.map((debt) => ctx.db.get(debt.calculationId)),
		);

		const calculationById = new Map(
			calculations.flatMap((calculation) =>
				calculation ? [[calculation._id, calculation] as const] : [],
			),
		);

		return await Promise.all(
			filtered
				.sort((left, right) => {
					if (right.year !== left.year) return right.year - left.year;
					if (right.month !== left.month) return right.month - left.month;
					return right.remainingAmount - left.remainingAmount;
				})
				.map(async (debt) => {
					const payments = await ctx.db
						.query("employeeDiscountDebtPayments")
						.withIndex("by_debt", (q) => q.eq("debtId", debt._id))
						.collect();

					return {
						...debt,
						calculation: calculationById.get(debt.calculationId) ?? null,
						paymentCount: payments.length,
					};
				}),
		);
	},
});

export const getDebtPayments = query({
	args: { debtId: v.id("employeeDiscountDebts") },
	handler: async (ctx, args) => {
		const payments = await ctx.db
			.query("employeeDiscountDebtPayments")
			.withIndex("by_debt", (q) => q.eq("debtId", args.debtId))
			.collect();

		return payments.sort((left, right) => right.paymentDate - left.paymentDate);
	},
});

export const recordDebtPayment = mutation({
	args: {
		debtId: v.id("employeeDiscountDebts"),
		amount: v.number(),
		paymentDate: v.number(),
		paidBy: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const debt = await ctx.db.get(args.debtId);
		if (!debt) {
			throw new ConvexError({ message: "Không tìm thấy công nợ chiết khấu" });
		}

		if (!Number.isFinite(args.amount) || args.amount <= 0) {
			throw new ConvexError({ message: "Số tiền thanh toán phải lớn hơn 0" });
		}

		if (!Number.isFinite(args.paymentDate)) {
			throw new ConvexError({ message: "Ngày thanh toán không hợp lệ" });
		}

		const paidBy = args.paidBy.trim();
		if (!paidBy) {
			throw new ConvexError({
				message: "Vui lòng nhập người thực hiện thanh toán",
			});
		}

		if (args.amount > debt.remainingAmount) {
			throw new ConvexError({
				message: "Số tiền thanh toán vượt quá công nợ còn lại.",
			});
		}

		const now = Date.now();
		const paidAmount = roundMoney(debt.paidAmount + args.amount);
		const remainingAmount = roundMoney(debt.totalDebtAmount - paidAmount);
		const paymentStatus =
			remainingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

		const paymentId = await ctx.db.insert("employeeDiscountDebtPayments", {
			debtId: debt._id,
			amount: roundMoney(args.amount),
			paymentDate: args.paymentDate,
			paidBy,
			notes: args.notes?.trim() ? args.notes.trim() : undefined,
			createdAt: now,
		});

		await ctx.db.patch(debt._id, {
			paidAmount,
			remainingAmount,
			paymentStatus,
			lastPaidAt: Math.max(debt.lastPaidAt ?? 0, args.paymentDate),
			updatedAt: now,
		});

		return {
			paymentId,
			paidAmount,
			remainingAmount,
			paymentStatus,
		};
	},
});
