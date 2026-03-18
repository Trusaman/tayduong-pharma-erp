import { components } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuditLogPayload = {
	action: string;
	description: string;
	entityType: string;
	entityId?: string;
	actorUserId?: string;
	actorEmail?: string | null;
	before?: unknown;
	after?: unknown;
	metadata?: unknown;
};

export const AUDIT_ENTITIES = {
	customer: "customer",
	employee: "employee",
	salesOrder: "salesOrder",
	discount: "discount",
	discountCalculation: "discountCalculation",
	discountDebt: "discountDebt",
	product: "product",
	supplier: "supplier",
} as const;

export const AUDIT_ACTIONS = {
	customerCreated: "customer.created",
	customerUpdated: "customer.updated",
	customerDeleted: "customer.deleted",
	customerImported: "customer.imported",
	productCreated: "product.created",
	productUpdated: "product.updated",
	productDeleted: "product.deleted",
	employeeCreated: "employee.created",
	employeeUpdated: "employee.updated",
	employeeDeleted: "employee.deleted",
	salesOrderCreated: "salesOrder.created",
	salesOrderUpdated: "salesOrder.updated",
	salesOrderStatusChanged: "salesOrder.status_changed",
	salesOrderFulfilled: "salesOrder.fulfilled",
	salesOrderDeleted: "salesOrder.deleted",
	discountCreated: "discount.created",
	discountUpdated: "discount.updated",
	discountDeleted: "discount.deleted",
	discountImported: "discount.imported",
	discountCalculationRepaired: "discountCalculation.repaired",
	discountCalculationSaved: "discountCalculation.saved",
	discountCalculationDeleted: "discountCalculation.deleted",
	discountDebtPaymentRecorded: "discountDebt.payment_recorded",
	discountDebtPaymentUpdated: "discountDebt.payment_updated",
	discountDebtOrderPaymentRecorded: "discountDebt.order_payment_recorded",
	discountDebtOrderPaymentUpdated: "discountDebt.order_payment_updated",
	discountDebtCreated: "discountDebt.created",
	discountDebtDeleted: "discountDebt.deleted",
	supplierCreated: "supplier.created",
	supplierUpdated: "supplier.updated",
	supplierDeleted: "supplier.deleted",
} as const;

const ENTITIES_REQUIRING_AUTHORIZED_ACTOR = new Set<string>([
	AUDIT_ENTITIES.employee,
	AUDIT_ENTITIES.salesOrder,
	AUDIT_ENTITIES.discount,
	AUDIT_ENTITIES.discountCalculation,
	AUDIT_ENTITIES.discountDebt,
]);

function normalizeIdValue(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	if (
		value &&
		typeof value === "object" &&
		"toString" in value &&
		typeof value.toString === "function"
	) {
		const normalized = value.toString();
		if (normalized && normalized !== "[object Object]") {
			return normalized;
		}
	}

	return undefined;
}

function toObjectArray(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(
		(item): item is Record<string, unknown> =>
			typeof item === "object" && item !== null,
	);
}

function extractRowsFromAdapterResult(result: unknown) {
	if (Array.isArray(result)) {
		return toObjectArray(result);
	}

	if (!result || typeof result !== "object") {
		return [];
	}

	const resultRecord = result as Record<string, unknown>;
	for (const key of ["page", "items", "data"]) {
		if (key in resultRecord) {
			return toObjectArray(resultRecord[key]);
		}
	}

	return [];
}

function stringifyAuditValue(value: unknown) {
	if (value === undefined) {
		return undefined;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return JSON.stringify({
			serializationError: true,
		});
	}
}

async function resolveActorEmailByUserId(
	ctx: QueryCtx | MutationCtx,
	userId: string,
) {
	const userRows = extractRowsFromAdapterResult(
		await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: "user",
			where: [{ field: "_id", operator: "eq", value: userId }],
			paginationOpts: { cursor: null, numItems: 1 },
		}),
	);

	const userRow = userRows[0];
	if (!userRow || typeof userRow.email !== "string") {
		return undefined;
	}

	const normalizedEmail = userRow.email.trim().toLowerCase();
	return normalizedEmail.length > 0 ? normalizedEmail : undefined;
}

export async function resolveAuditActor(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	const actorUserId = normalizeIdValue(identity?.subject);
	if (!actorUserId) {
		return {
			actorUserId: undefined,
			actorEmail: undefined,
		};
	}

	return {
		actorUserId,
		actorEmail: await resolveActorEmailByUserId(ctx, actorUserId),
	};
}

export async function writeAuditLog(
	ctx: MutationCtx,
	payload: AuditLogPayload,
) {
	const actor =
		payload.actorUserId === undefined && payload.actorEmail === undefined
			? await resolveAuditActor(ctx)
			: {
					actorUserId: payload.actorUserId,
					actorEmail: payload.actorEmail ?? undefined,
				};

	if (
		ENTITIES_REQUIRING_AUTHORIZED_ACTOR.has(payload.entityType) &&
		!actor.actorUserId
	) {
		throw new Error(
			"Không xác định được tài khoản thực hiện thao tác để ghi nhật ký thay đổi",
		);
	}

	await ctx.db.insert("auditLogs", {
		action: payload.action,
		description: payload.description,
		entityType: payload.entityType,
		entityId: payload.entityId,
		actorUserId: actor.actorUserId,
		actorEmail: actor.actorEmail,
		beforeJson: stringifyAuditValue(payload.before),
		afterJson: stringifyAuditValue(payload.after),
		metadataJson: stringifyAuditValue(payload.metadata),
		createdAt: Date.now(),
	});
}
