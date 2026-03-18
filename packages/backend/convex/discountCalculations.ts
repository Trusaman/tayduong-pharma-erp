import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, writeAuditLog } from "./auditLogs";
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

type PeriodRange = ReturnType<typeof getPeriodRange>;

function toMonthlyCalculationAuditSnapshot(
	calculation: {
		_id: Id<"monthlyDiscountCalculations">;
		periodKey: string;
		month: number;
		year: number;
		startDate: number;
		endDate: number;
		orderCount: number;
		entryCount: number;
		recipientCount: number;
		totalDiscountAmount: number;
		savedBy: string;
		notes?: string;
		updatedAt: number;
	},
	id?: Id<"monthlyDiscountCalculations">,
) {
	return {
		id: id ?? calculation._id,
		periodKey: calculation.periodKey,
		month: calculation.month,
		year: calculation.year,
		startDate: calculation.startDate,
		endDate: calculation.endDate,
		orderCount: calculation.orderCount,
		entryCount: calculation.entryCount,
		recipientCount: calculation.recipientCount,
		totalDiscountAmount: calculation.totalDiscountAmount,
		savedBy: calculation.savedBy,
		hasNotes: Boolean(calculation.notes?.trim()),
		updatedAt: calculation.updatedAt,
	};
}

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

async function getCompletedOrdersForPeriod(
	ctx: CalculationCtx,
	period: PeriodRange,
) {
	const [ordersByCompletedAt, legacyOrders] = await Promise.all([
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
	]);

	return [
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
}

function resolveBaseUnitPrice(item: SalesOrderItemPreview) {
	if (typeof item.baseUnitPrice === "number" && item.baseUnitPrice > 0) {
		return item.baseUnitPrice;
	}

	if ((item.discountAmount ?? 0) > 0 && item.quantity > 0) {
		return roundMoney(
			item.unitPrice + (item.discountAmount ?? 0) / item.quantity,
		);
	}

	return item.unitPrice;
}

async function buildPreview(ctx: CalculationCtx, month: number, year: number) {
	const period = getPeriodRange(month, year);
	const [completedOrders, rules, salesmen] = await Promise.all([
		getCompletedOrdersForPeriod(ctx, period),
		ctx.db
			.query("discountRules")
			.withIndex("by_active", (q) => q.eq("isActive", true))
			.collect(),
		ctx.db.query("salesmen").collect(),
	]);

	const salesmanNameById = new Map(
		salesmen.map((salesman) => [salesman._id, salesman.name]),
	);

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

	const [existingCalculation, recentRecalculations] = await Promise.all([
		ctx.db
			.query("monthlyDiscountCalculations")
			.withIndex("by_period_key", (q) => q.eq("periodKey", period.periodKey))
			.first(),
		ctx.db
			.query("monthlyDiscountRecalculationLogs")
			.withIndex("by_period_key_and_createdAt", (q) =>
				q.eq("periodKey", period.periodKey),
			)
			.order("desc")
			.take(5),
	]);
	const existingCalculationSummary = existingCalculation
		? await getCalculationPaymentSummary(ctx, existingCalculation._id)
		: null;

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
		existingCalculationSummary,
		recentRecalculations,
	};
}

async function assertCalculationHasNoPayments(
	ctx: MutationCtx,
	existingCalculationId: Id<"monthlyDiscountCalculations">,
	errorMessage: string,
) {
	const debts = await ctx.db
		.query("employeeDiscountDebts")
		.withIndex("by_calculation", (q) =>
			q.eq("calculationId", existingCalculationId),
		)
		.collect();

	for (const debt of debts) {
		const [legacyPayments, orderPayments] = await Promise.all([
			getLegacyDebtPayments(ctx, debt._id),
			getDebtOrderPayments(ctx, debt._id),
		]);

		if (legacyPayments.length > 0 || orderPayments.length > 0) {
			throw new ConvexError({
				message: errorMessage,
			});
		}
	}

	return debts;
}

function summarizeDebtPayments(
	totalDebtAmount: number,
	payments: Array<{ amount: number; paymentDate: number }>,
): {
	paidAmount: number;
	remainingAmount: number;
	paymentStatus: "unpaid" | "partial" | "paid";
	lastPaidAt: number | undefined;
} {
	const paidAmount = roundMoney(
		payments.reduce((sum, payment) => sum + payment.amount, 0),
	);

	if (paidAmount - totalDebtAmount > 0.001) {
		throw new ConvexError({
			message: "Tổng thanh toán vượt quá công nợ chiết khấu.",
		});
	}

	const remainingAmount = roundMoney(totalDebtAmount - paidAmount);
	const paymentStatus: "unpaid" | "partial" | "paid" =
		remainingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
	const lastPaidAt =
		payments.length > 0
			? Math.max(...payments.map((payment) => payment.paymentDate))
			: undefined;

	return {
		paidAmount,
		remainingAmount,
		paymentStatus,
		lastPaidAt,
	};
}

async function getLegacyDebtPayments(
	ctx: CalculationCtx,
	debtId: Id<"employeeDiscountDebts">,
) {
	return await ctx.db
		.query("employeeDiscountDebtPayments")
		.withIndex("by_debt", (q) => q.eq("debtId", debtId))
		.collect();
}

async function getDebtOrderPayments(
	ctx: CalculationCtx,
	debtId: Id<"employeeDiscountDebts">,
) {
	return await ctx.db
		.query("employeeDiscountDebtOrderPayments")
		.withIndex("by_debt", (q) => q.eq("debtId", debtId))
		.collect();
}

async function getCalculationPaymentSummary(
	ctx: CalculationCtx,
	calculationId: Id<"monthlyDiscountCalculations">,
) {
	const debts = await ctx.db
		.query("employeeDiscountDebts")
		.withIndex("by_calculation", (q) => q.eq("calculationId", calculationId))
		.collect();

	let legacyPaymentCount = 0;
	let orderPaymentCount = 0;

	for (const debt of debts) {
		const [legacyPayments, orderPayments] = await Promise.all([
			getLegacyDebtPayments(ctx, debt._id),
			getDebtOrderPayments(ctx, debt._id),
		]);
		legacyPaymentCount += legacyPayments.length;
		orderPaymentCount += orderPayments.length;
	}

	return {
		debtCount: debts.length,
		legacyPaymentCount,
		orderPaymentCount,
		totalPaymentCount: legacyPaymentCount + orderPaymentCount,
	};
}

async function assertDebtUsesOrderLevelPayments(
	ctx: MutationCtx,
	debtId: Id<"employeeDiscountDebts">,
) {
	const legacyPayments = await getLegacyDebtPayments(ctx, debtId);
	if (legacyPayments.length > 0) {
		throw new ConvexError({
			message:
				"Công nợ này đang có thanh toán kiểu cũ theo người nhận. Hãy xóa bảng công nợ tháng và lưu lại bảng mới để chuyển sang thanh toán theo từng đơn.",
		});
	}
}

async function recomputeDebtFromOrderPayments(
	ctx: MutationCtx,
	debt: {
		_id: Id<"employeeDiscountDebts">;
		totalDebtAmount: number;
	},
	now: number,
) {
	const orderPayments = await getDebtOrderPayments(ctx, debt._id);
	const paymentSummary = summarizeDebtPayments(
		debt.totalDebtAmount,
		orderPayments.map((payment) => ({
			amount: payment.amount,
			paymentDate: payment.paymentDate,
		})),
	);

	await ctx.db.patch(debt._id, {
		paidAmount: paymentSummary.paidAmount,
		remainingAmount: paymentSummary.remainingAmount,
		paymentStatus: paymentSummary.paymentStatus,
		lastPaidAt: paymentSummary.lastPaidAt,
		updatedAt: now,
	});

	return paymentSummary;
}

async function ensureReplaceableCalculation(
	ctx: MutationCtx,
	existingCalculationId: Id<"monthlyDiscountCalculations">,
) {
	const debts = await assertCalculationHasNoPayments(
		ctx,
		existingCalculationId,
		"Tháng này đã phát sinh thanh toán công nợ, không thể lưu đè bảng tính.",
	);

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
		const [legacyPayments, orderPayments] = await Promise.all([
			getLegacyDebtPayments(ctx, debt._id),
			getDebtOrderPayments(ctx, debt._id),
		]);

		for (const payment of legacyPayments) {
			await ctx.db.delete(payment._id);
		}

		for (const payment of orderPayments) {
			await ctx.db.delete(payment._id);
		}

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountDebtDeleted,
			description: `Xóa công nợ chiết khấu kỳ ${debt.periodKey}`,
			entityType: AUDIT_ENTITIES.discountDebt,
			entityId: debt._id,
			before: {
				periodKey: debt.periodKey,
				month: debt.month,
				year: debt.year,
				salesmanId: debt.salesmanId,
				salesmanNameSnapshot: debt.salesmanNameSnapshot,
				totalDebtAmount: debt.totalDebtAmount,
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				paymentStatus: debt.paymentStatus,
			},
			metadata: {
				reason: "replace_monthly_calculation",
				deletedLegacyPaymentCount: legacyPayments.length,
				deletedOrderPaymentCount: orderPayments.length,
			},
		});

		await ctx.db.delete(debt._id);
	}
}

export const repairMonthlySourceOrders = mutation({
	args: {
		month: v.number(),
		year: v.number(),
		recalculatedBy: v.string(),
	},
	handler: async (ctx, args) => {
		const period = getPeriodRange(args.month, args.year);
		const recalculatedBy = args.recalculatedBy.trim();
		if (!recalculatedBy) {
			throw new ConvexError({
				message: "Không xác định được người thực hiện tính lại chiết khấu.",
			});
		}

		const now = Date.now();
		const [completedOrders, rules, salesmen] = await Promise.all([
			getCompletedOrdersForPeriod(ctx, period),
			ctx.db
				.query("discountRules")
				.withIndex("by_active", (q) => q.eq("isActive", true))
				.collect(),
			ctx.db.query("salesmen").collect(),
		]);

		const salesmanNameById = new Map(
			salesmen.map((salesman) => [salesman._id, salesman.name]),
		);

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
				const baseUnitPrice = resolveBaseUnitPrice(item);
				const discountedUnitPrice = roundMoney(
					baseUnitPrice * (1 - autoDiscountPercent / 100),
				);
				const discountAmount = roundMoney(
					item.quantity * (baseUnitPrice - discountedUnitPrice),
				);
				const appliedDiscountTypes = matched.map((rule) => rule.discountType);
				const appliedDiscountBreakdown = allocateDiscountBreakdown(
					matched,
					autoDiscountPercent,
					discountAmount,
				).map((detail) => ({
					...detail,
					salesmanName: salesmanNameById.get(detail.salesmanId),
				}));
				const itemNeedsUpdate =
					Math.abs((item.baseUnitPrice ?? 0) - baseUnitPrice) > 0.001 ||
					Math.abs(item.unitPrice - discountedUnitPrice) > 0.001 ||
					Math.abs((item.discountPercent ?? 0) - autoDiscountPercent) > 0.001 ||
					Math.abs((item.discountAmount ?? 0) - discountAmount) > 0.001 ||
					JSON.stringify(item.appliedDiscountTypes ?? []) !==
						JSON.stringify(appliedDiscountTypes) ||
					JSON.stringify(item.appliedDiscountBreakdown ?? []) !==
						JSON.stringify(appliedDiscountBreakdown);

				if (itemNeedsUpdate) {
					await ctx.db.patch(item._id, {
						baseUnitPrice,
						unitPrice: discountedUnitPrice,
						discountPercent: autoDiscountPercent,
						discountAmount,
						appliedDiscountTypes,
						appliedDiscountBreakdown,
					});
					orderChanged = true;
					repairedItemCount += 1;
				}

				recalculatedItems.push({
					...item,
					baseUnitPrice,
					unitPrice: discountedUnitPrice,
					discountPercent: autoDiscountPercent,
					discountAmount,
					appliedDiscountTypes,
					appliedDiscountBreakdown,
				});
			}

			const nextTotalAmount = roundMoney(
				recalculatedItems.reduce(
					(sum, salesOrderItem) =>
						sum + salesOrderItem.quantity * salesOrderItem.unitPrice,
					0,
				),
			);
			const nextTotalDiscountAmount = roundMoney(
				recalculatedItems.reduce(
					(sum, salesOrderItem) => sum + (salesOrderItem.discountAmount ?? 0),
					0,
				),
			);
			const orderNeedsUpdate =
				Math.abs(order.totalAmount - nextTotalAmount) > 0.001 ||
				Math.abs((order.totalDiscountAmount ?? 0) - nextTotalDiscountAmount) >
					0.001;

			if (!orderChanged && !orderNeedsUpdate) {
				continue;
			}

			await ctx.db.patch(order._id, {
				totalAmount: nextTotalAmount,
				totalDiscountAmount: nextTotalDiscountAmount,
				updatedAt: now,
			});

			repairedOrderCount += 1;
			repairedOrderNumbers.push(order.orderNumber);
		}

		await ctx.db.insert("monthlyDiscountRecalculationLogs", {
			periodKey: period.periodKey,
			month: period.month,
			year: period.year,
			recalculatedBy,
			completedOrderCount: completedOrders.length,
			repairedOrderCount,
			repairedItemCount,
			createdAt: now,
		});

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountCalculationRepaired,
			description: `Tính lại nguồn đơn chiết khấu tháng ${period.month}/${period.year}`,
			entityType: AUDIT_ENTITIES.discountCalculation,
			entityId: period.periodKey,
			metadata: {
				periodKey: period.periodKey,
				recalculatedBy,
				completedOrderCount: completedOrders.length,
				repairedOrderCount,
				repairedItemCount,
				repairedOrderNumbers,
			},
		});

		return {
			periodKey: period.periodKey,
			recalculatedBy,
			completedOrderCount: completedOrders.length,
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
		const replacingExisting = Boolean(calculationId);
		const beforeCalculationSnapshot = preview.existingCalculation
			? toMonthlyCalculationAuditSnapshot(preview.existingCalculation)
			: undefined;

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
			const debtId = await ctx.db.insert("employeeDiscountDebts", {
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

			await writeAuditLog(ctx, {
				action: AUDIT_ACTIONS.discountDebtCreated,
				description: `Tạo công nợ chiết khấu kỳ ${preview.period.periodKey}`,
				entityType: AUDIT_ENTITIES.discountDebt,
				entityId: debtId,
				after: {
					id: debtId,
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
				},
			});
		}

		const persistedCalculation = await ctx.db.get(calculationId);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountCalculationSaved,
			description: `Lưu bảng tính chiết khấu tháng ${preview.period.month}/${preview.period.year}`,
			entityType: AUDIT_ENTITIES.discountCalculation,
			entityId: calculationId,
			before: beforeCalculationSnapshot,
			after: persistedCalculation
				? toMonthlyCalculationAuditSnapshot(persistedCalculation, calculationId)
				: undefined,
			metadata: {
				periodKey: preview.period.periodKey,
				replacingExisting,
				savedBy,
				entryCount: preview.totals.entryCount,
				recipientCount: preview.totals.recipientCount,
				totalDiscountAmount: preview.totals.totalDiscountAmount,
			},
		});

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
					const [legacyPayments, orderPayments] = await Promise.all([
						getLegacyDebtPayments(ctx, debt._id),
						getDebtOrderPayments(ctx, debt._id),
					]);
					const sortedPayments = [...legacyPayments, ...orderPayments].sort(
						(left, right) =>
							right.paymentDate - left.paymentDate ||
							right.createdAt - left.createdAt,
					);

					return {
						...debt,
						calculation: calculationById.get(debt.calculationId) ?? null,
						paymentCount: sortedPayments.length,
						latestPayment: sortedPayments[0] ?? null,
						legacyPaymentCount: legacyPayments.length,
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

		return payments.sort(
			(left, right) =>
				right.paymentDate - left.paymentDate ||
				right.createdAt - left.createdAt,
		);
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
		const amount = roundMoney(args.amount);
		const paidAmount = roundMoney(debt.paidAmount + amount);
		const paymentSummary = summarizeDebtPayments(debt.totalDebtAmount, [
			{
				amount: paidAmount,
				paymentDate: Math.max(debt.lastPaidAt ?? 0, args.paymentDate),
			},
		]);

		const paymentId = await ctx.db.insert("employeeDiscountDebtPayments", {
			debtId: debt._id,
			amount,
			paymentDate: args.paymentDate,
			paidBy,
			notes: args.notes?.trim() ? args.notes.trim() : undefined,
			createdAt: now,
		});

		await ctx.db.patch(debt._id, {
			paidAmount,
			remainingAmount: roundMoney(debt.totalDebtAmount - paidAmount),
			paymentStatus: paymentSummary.paymentStatus,
			lastPaidAt: Math.max(debt.lastPaidAt ?? 0, args.paymentDate),
			updatedAt: now,
		});

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountDebtPaymentRecorded,
			description: `Ghi nhận thanh toán công nợ chiết khấu kỳ ${debt.periodKey}`,
			entityType: AUDIT_ENTITIES.discountDebt,
			entityId: debt._id,
			before: {
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				paymentStatus: debt.paymentStatus,
				lastPaidAt: debt.lastPaidAt,
			},
			after: {
				paidAmount,
				remainingAmount: roundMoney(debt.totalDebtAmount - paidAmount),
				paymentStatus: paymentSummary.paymentStatus,
				lastPaidAt: Math.max(debt.lastPaidAt ?? 0, args.paymentDate),
			},
			metadata: {
				paymentId,
				amount,
				paymentDate: args.paymentDate,
				paidBy,
			},
		});

		return {
			paymentId,
			paidAmount,
			remainingAmount: roundMoney(debt.totalDebtAmount - paidAmount),
			paymentStatus: paymentSummary.paymentStatus,
		};
	},
});

export const updateDebtPayment = mutation({
	args: {
		paymentId: v.id("employeeDiscountDebtPayments"),
		amount: v.number(),
		paymentDate: v.number(),
		paidBy: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const payment = await ctx.db.get(args.paymentId);
		if (!payment) {
			throw new ConvexError({ message: "Không tìm thấy thanh toán công nợ" });
		}

		const debt = await ctx.db.get(payment.debtId);
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

		const existingPayments = await ctx.db
			.query("employeeDiscountDebtPayments")
			.withIndex("by_debt", (q) => q.eq("debtId", debt._id))
			.collect();
		const amount = roundMoney(args.amount);
		const nextPayments = existingPayments.map((currentPayment) =>
			currentPayment._id === payment._id
				? { amount, paymentDate: args.paymentDate }
				: {
						amount: currentPayment.amount,
						paymentDate: currentPayment.paymentDate,
					},
		);
		const paymentSummary = summarizeDebtPayments(
			debt.totalDebtAmount,
			nextPayments,
		);

		const now = Date.now();
		await ctx.db.patch(payment._id, {
			amount,
			paymentDate: args.paymentDate,
			paidBy,
			notes: args.notes?.trim() ? args.notes.trim() : undefined,
			updatedAt: now,
		});

		await ctx.db.patch(debt._id, {
			paidAmount: paymentSummary.paidAmount,
			remainingAmount: paymentSummary.remainingAmount,
			paymentStatus: paymentSummary.paymentStatus,
			lastPaidAt: paymentSummary.lastPaidAt,
			updatedAt: now,
		});

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountDebtPaymentUpdated,
			description: `Cập nhật thanh toán công nợ chiết khấu kỳ ${debt.periodKey}`,
			entityType: AUDIT_ENTITIES.discountDebt,
			entityId: debt._id,
			before: {
				paymentId: payment._id,
				amount: payment.amount,
				paymentDate: payment.paymentDate,
				paidBy: payment.paidBy,
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				paymentStatus: debt.paymentStatus,
			},
			after: {
				paymentId: payment._id,
				amount,
				paymentDate: args.paymentDate,
				paidBy,
				paidAmount: paymentSummary.paidAmount,
				remainingAmount: paymentSummary.remainingAmount,
				paymentStatus: paymentSummary.paymentStatus,
			},
			metadata: {
				notes: args.notes?.trim() ? args.notes.trim() : undefined,
			},
		});

		return {
			paymentId: payment._id,
			paidAmount: paymentSummary.paidAmount,
			remainingAmount: paymentSummary.remainingAmount,
			paymentStatus: paymentSummary.paymentStatus,
		};
	},
});

export const getDebtOrderDetails = query({
	args: { debtId: v.id("employeeDiscountDebts") },
	handler: async (ctx, args) => {
		const debt = await ctx.db.get(args.debtId);
		if (!debt) {
			throw new ConvexError({ message: "Không tìm thấy công nợ chiết khấu" });
		}

		const [entries, orderPayments, legacyPayments] = await Promise.all([
			ctx.db
				.query("monthlyDiscountCalculationEntries")
				.withIndex("by_calculation_and_salesman", (q) =>
					q
						.eq("calculationId", debt.calculationId)
						.eq("salesmanId", debt.salesmanId),
				)
				.collect(),
			getDebtOrderPayments(ctx, debt._id),
			getLegacyDebtPayments(ctx, debt._id),
		]);

		const paymentsByOrderId = new Map<string, typeof orderPayments>();
		for (const payment of orderPayments) {
			const key = String(payment.salesOrderId);
			const current = paymentsByOrderId.get(key);
			if (current) {
				current.push(payment);
			} else {
				paymentsByOrderId.set(key, [payment]);
			}
		}

		const ordersById = new Map<
			string,
			{
				salesOrderId: Id<"salesOrders">;
				orderNumber: string;
				orderDate: number;
				completedAt: number;
				customerNameSnapshot: string;
				totalDiscountAmount: number;
				byType: RecipientByType;
				entryDetails: Array<{
					salesOrderItemId: Id<"salesOrderItems">;
					productNameSnapshot: string;
					quantity: number;
					discountType: DiscountTypeKey;
					ruleName: string;
					allocatedPercent: number;
					discountAmount: number;
				}>;
			}
		>();

		for (const entry of entries) {
			const key = String(entry.salesOrderId);
			const existing = ordersById.get(key);
			if (existing) {
				existing.totalDiscountAmount = roundMoney(
					existing.totalDiscountAmount + entry.discountAmount,
				);
				existing.byType[entry.discountType] = roundMoney(
					existing.byType[entry.discountType] + entry.discountAmount,
				);
				existing.entryDetails.push({
					salesOrderItemId: entry.salesOrderItemId,
					productNameSnapshot: entry.productNameSnapshot,
					quantity: entry.quantity,
					discountType: entry.discountType,
					ruleName: entry.ruleName,
					allocatedPercent: entry.allocatedPercent,
					discountAmount: entry.discountAmount,
				});
				continue;
			}

			const byType = createEmptyByType();
			byType[entry.discountType] = entry.discountAmount;
			ordersById.set(key, {
				salesOrderId: entry.salesOrderId,
				orderNumber: entry.orderNumber,
				orderDate: entry.orderDate,
				completedAt: entry.completedAt,
				customerNameSnapshot: entry.customerNameSnapshot,
				totalDiscountAmount: entry.discountAmount,
				byType,
				entryDetails: [
					{
						salesOrderItemId: entry.salesOrderItemId,
						productNameSnapshot: entry.productNameSnapshot,
						quantity: entry.quantity,
						discountType: entry.discountType,
						ruleName: entry.ruleName,
						allocatedPercent: entry.allocatedPercent,
						discountAmount: entry.discountAmount,
					},
				],
			});
		}

		const orders = Array.from(ordersById.values())
			.map((order) => {
				const payments = [
					...(paymentsByOrderId.get(String(order.salesOrderId)) ?? []),
				].sort(
					(left, right) =>
						right.paymentDate - left.paymentDate ||
						right.createdAt - left.createdAt,
				);
				const paymentSummary = summarizeDebtPayments(
					order.totalDiscountAmount,
					payments.map((payment) => ({
						amount: payment.amount,
						paymentDate: payment.paymentDate,
					})),
				);

				return {
					...order,
					paymentCount: payments.length,
					paidAmount: paymentSummary.paidAmount,
					remainingAmount: paymentSummary.remainingAmount,
					paymentStatus: paymentSummary.paymentStatus,
					lastPaidAt: paymentSummary.lastPaidAt,
					latestPayment: payments[0] ?? null,
				};
			})
			.sort((left, right) => {
				if (right.completedAt !== left.completedAt) {
					return right.completedAt - left.completedAt;
				}
				return right.totalDiscountAmount - left.totalDiscountAmount;
			});

		return {
			debt,
			legacyPaymentCount: legacyPayments.length,
			legacyPaidAmount: roundMoney(
				legacyPayments.reduce((sum, payment) => sum + payment.amount, 0),
			),
			orders,
		};
	},
});

export const getDebtOrderPaymentHistory = query({
	args: {
		debtId: v.id("employeeDiscountDebts"),
		salesOrderId: v.id("salesOrders"),
	},
	handler: async (ctx, args) => {
		const payments = await ctx.db
			.query("employeeDiscountDebtOrderPayments")
			.withIndex("by_debt_and_order", (q) =>
				q.eq("debtId", args.debtId).eq("salesOrderId", args.salesOrderId),
			)
			.collect();

		return payments.sort(
			(left, right) =>
				right.paymentDate - left.paymentDate ||
				right.createdAt - left.createdAt,
		);
	},
});

export const recordDebtOrderPayment = mutation({
	args: {
		debtId: v.id("employeeDiscountDebts"),
		salesOrderId: v.id("salesOrders"),
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

		await assertDebtUsesOrderLevelPayments(ctx, debt._id);

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

		const orderEntries = await ctx.db
			.query("monthlyDiscountCalculationEntries")
			.withIndex("by_calculation_and_salesman", (q) =>
				q
					.eq("calculationId", debt.calculationId)
					.eq("salesmanId", debt.salesmanId),
			)
			.collect();
		const selectedEntries = orderEntries.filter(
			(entry) => entry.salesOrderId === args.salesOrderId,
		);

		if (selectedEntries.length === 0) {
			throw new ConvexError({
				message: "Không tìm thấy đơn hàng trong snapshot công nợ này.",
			});
		}

		const orderTotalAmount = roundMoney(
			selectedEntries.reduce((sum, entry) => sum + entry.discountAmount, 0),
		);
		const existingPayments = await ctx.db
			.query("employeeDiscountDebtOrderPayments")
			.withIndex("by_debt_and_order", (q) =>
				q.eq("debtId", debt._id).eq("salesOrderId", args.salesOrderId),
			)
			.collect();
		const amount = roundMoney(args.amount);
		summarizeDebtPayments(orderTotalAmount, [
			...existingPayments.map((payment) => ({
				amount: payment.amount,
				paymentDate: payment.paymentDate,
			})),
			{ amount, paymentDate: args.paymentDate },
		]);

		const now = Date.now();
		const paymentId = await ctx.db.insert("employeeDiscountDebtOrderPayments", {
			debtId: debt._id,
			calculationId: debt.calculationId,
			periodKey: debt.periodKey,
			salesmanId: debt.salesmanId,
			salesOrderId: args.salesOrderId,
			orderNumberSnapshot: selectedEntries[0].orderNumber,
			amount,
			paymentDate: args.paymentDate,
			paidBy,
			notes: args.notes?.trim() ? args.notes.trim() : undefined,
			createdAt: now,
		});

		const paymentSummary = await recomputeDebtFromOrderPayments(ctx, debt, now);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountDebtOrderPaymentRecorded,
			description: `Ghi nhận thanh toán theo đơn cho công nợ chiết khấu kỳ ${debt.periodKey}`,
			entityType: AUDIT_ENTITIES.discountDebt,
			entityId: debt._id,
			before: {
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				paymentStatus: debt.paymentStatus,
			},
			after: {
				paidAmount: paymentSummary.paidAmount,
				remainingAmount: paymentSummary.remainingAmount,
				paymentStatus: paymentSummary.paymentStatus,
			},
			metadata: {
				paymentId,
				salesOrderId: args.salesOrderId,
				orderNumber: selectedEntries[0].orderNumber,
				amount,
				paymentDate: args.paymentDate,
				paidBy,
			},
		});

		return {
			paymentId,
			paidAmount: paymentSummary.paidAmount,
			remainingAmount: paymentSummary.remainingAmount,
			paymentStatus: paymentSummary.paymentStatus,
		};
	},
});

export const updateDebtOrderPayment = mutation({
	args: {
		paymentId: v.id("employeeDiscountDebtOrderPayments"),
		amount: v.number(),
		paymentDate: v.number(),
		paidBy: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const payment = await ctx.db.get(args.paymentId);
		if (!payment) {
			throw new ConvexError({ message: "Không tìm thấy thanh toán theo đơn" });
		}

		const debt = await ctx.db.get(payment.debtId);
		if (!debt) {
			throw new ConvexError({ message: "Không tìm thấy công nợ chiết khấu" });
		}

		await assertDebtUsesOrderLevelPayments(ctx, debt._id);

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

		const orderEntries = await ctx.db
			.query("monthlyDiscountCalculationEntries")
			.withIndex("by_calculation_and_salesman", (q) =>
				q
					.eq("calculationId", debt.calculationId)
					.eq("salesmanId", debt.salesmanId),
			)
			.collect();
		const selectedEntries = orderEntries.filter(
			(entry) => entry.salesOrderId === payment.salesOrderId,
		);
		if (selectedEntries.length === 0) {
			throw new ConvexError({
				message:
					"Đơn hàng này không còn tồn tại trong snapshot công nợ hiện tại.",
			});
		}

		const orderTotalAmount = roundMoney(
			selectedEntries.reduce((sum, entry) => sum + entry.discountAmount, 0),
		);

		const existingPayments = await ctx.db
			.query("employeeDiscountDebtOrderPayments")
			.withIndex("by_debt_and_order", (q) =>
				q.eq("debtId", debt._id).eq("salesOrderId", payment.salesOrderId),
			)
			.collect();
		const amount = roundMoney(args.amount);
		summarizeDebtPayments(
			orderTotalAmount,
			existingPayments.map((currentPayment) =>
				currentPayment._id === payment._id
					? { amount, paymentDate: args.paymentDate }
					: {
							amount: currentPayment.amount,
							paymentDate: currentPayment.paymentDate,
						},
			),
		);

		const now = Date.now();
		await ctx.db.patch(payment._id, {
			amount,
			paymentDate: args.paymentDate,
			paidBy,
			notes: args.notes?.trim() ? args.notes.trim() : undefined,
			updatedAt: now,
		});

		const paymentSummary = await recomputeDebtFromOrderPayments(ctx, debt, now);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountDebtOrderPaymentUpdated,
			description: `Cập nhật thanh toán theo đơn cho công nợ chiết khấu kỳ ${debt.periodKey}`,
			entityType: AUDIT_ENTITIES.discountDebt,
			entityId: debt._id,
			before: {
				paymentId: payment._id,
				salesOrderId: payment.salesOrderId,
				amount: payment.amount,
				paymentDate: payment.paymentDate,
				paidBy: payment.paidBy,
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				paymentStatus: debt.paymentStatus,
			},
			after: {
				paymentId: payment._id,
				salesOrderId: payment.salesOrderId,
				amount,
				paymentDate: args.paymentDate,
				paidBy,
				paidAmount: paymentSummary.paidAmount,
				remainingAmount: paymentSummary.remainingAmount,
				paymentStatus: paymentSummary.paymentStatus,
			},
			metadata: {
				notes: args.notes?.trim() ? args.notes.trim() : undefined,
			},
		});

		return {
			paymentId: payment._id,
			paidAmount: paymentSummary.paidAmount,
			remainingAmount: paymentSummary.remainingAmount,
			paymentStatus: paymentSummary.paymentStatus,
		};
	},
});

export const deleteMonthlyCalculation = mutation({
	args: { calculationId: v.id("monthlyDiscountCalculations") },
	handler: async (ctx, args) => {
		const calculation = await ctx.db.get(args.calculationId);
		if (!calculation) {
			throw new ConvexError({ message: "Không tìm thấy bảng công nợ tháng" });
		}

		const [entries, debts] = await Promise.all([
			ctx.db
				.query("monthlyDiscountCalculationEntries")
				.withIndex("by_calculation", (q) =>
					q.eq("calculationId", args.calculationId),
				)
				.collect(),
			ctx.db
				.query("employeeDiscountDebts")
				.withIndex("by_calculation", (q) =>
					q.eq("calculationId", args.calculationId),
				)
				.collect(),
		]);

		for (const debt of debts) {
			const [legacyPayments, orderPayments] = await Promise.all([
				getLegacyDebtPayments(ctx, debt._id),
				getDebtOrderPayments(ctx, debt._id),
			]);

			for (const payment of legacyPayments) {
				await ctx.db.delete(payment._id);
			}

			for (const payment of orderPayments) {
				await ctx.db.delete(payment._id);
			}

			await writeAuditLog(ctx, {
				action: AUDIT_ACTIONS.discountDebtDeleted,
				description: `Xóa công nợ chiết khấu kỳ ${debt.periodKey}`,
				entityType: AUDIT_ENTITIES.discountDebt,
				entityId: debt._id,
				before: {
					periodKey: debt.periodKey,
					month: debt.month,
					year: debt.year,
					salesmanId: debt.salesmanId,
					salesmanNameSnapshot: debt.salesmanNameSnapshot,
					totalDebtAmount: debt.totalDebtAmount,
					paidAmount: debt.paidAmount,
					remainingAmount: debt.remainingAmount,
					paymentStatus: debt.paymentStatus,
				},
				metadata: {
					reason: "delete_monthly_calculation",
					deletedLegacyPaymentCount: legacyPayments.length,
					deletedOrderPaymentCount: orderPayments.length,
				},
			});

			await ctx.db.delete(debt._id);
		}

		for (const entry of entries) {
			await ctx.db.delete(entry._id);
		}

		await ctx.db.delete(calculation._id);

		await writeAuditLog(ctx, {
			action: AUDIT_ACTIONS.discountCalculationDeleted,
			description: `Xóa bảng tính chiết khấu kỳ ${calculation.periodKey}`,
			entityType: AUDIT_ENTITIES.discountCalculation,
			entityId: calculation._id,
			before: {
				periodKey: calculation.periodKey,
				month: calculation.month,
				year: calculation.year,
				totalDiscountAmount: calculation.totalDiscountAmount,
				entryCount: calculation.entryCount,
				recipientCount: calculation.recipientCount,
			},
			metadata: {
				deletedEntryCount: entries.length,
				deletedDebtCount: debts.length,
			},
		});

		return {
			calculationId: calculation._id,
			periodKey: calculation.periodKey,
		};
	},
});
