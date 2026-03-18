import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL;
if (!siteUrl) {
	throw new Error("Missing SITE_URL environment variable");
}
const localWebOrigins = ["http://localhost:3001", "http://127.0.0.1:3001"];
const extraTrustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
	.split(",")
	.map((origin) => origin.trim())
	.filter((origin) => origin.length > 0);
const trustedOrigins = Array.from(
	new Set([siteUrl, ...localWebOrigins, ...extraTrustedOrigins]),
);
const configuredAdminEmails = Array.from(
	new Set(
		[
			"ngocanhnguyen.tayduong@gmail.com",
			...(process.env.ADMIN_EMAILS ?? "")
				.split(",")
				.map((email) => email.trim().toLowerCase())
				.filter((email) => email.length > 0),
		].map((email) => email.toLowerCase()),
	),
);
const configuredAdminUserIds = Array.from(
	new Set(
		(process.env.ADMIN_USER_IDS ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0),
	),
);
const runtimeAdminUserIds = new Set(configuredAdminUserIds);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AdminRole = "admin" | "user";

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

function parseTimestamp(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
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

function parseAuditValue(value: string | undefined) {
	if (!value) {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
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

function extractRoleFromUserRow(userRow: Record<string, unknown> | null) {
	if (!userRow) {
		return "user" as const;
	}

	if (typeof userRow.role === "string" && userRow.role === "admin") {
		return "admin" as const;
	}

	if (Array.isArray(userRow.role) && userRow.role.includes("admin")) {
		return "admin" as const;
	}

	return "user" as const;
}

function buildAuditUserSnapshot(userRow: Record<string, unknown> | null) {
	if (!userRow) {
		return null;
	}

	return {
		id:
			normalizeIdValue(userRow.id) ??
			normalizeIdValue(userRow._id) ??
			normalizeIdValue(userRow.userId),
		name: typeof userRow.name === "string" ? userRow.name : null,
		email: typeof userRow.email === "string" ? userRow.email : null,
		role: extractRoleFromUserRow(userRow),
		createdAt: parseTimestamp(userRow.createdAt),
	};
}

async function findAuthUserRowById(
	ctx: QueryCtx | MutationCtx,
	userId: string,
) {
	const rows = extractRowsFromAdapterResult(
		await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: "user",
			where: [{ field: "_id", operator: "eq", value: userId }],
			paginationOpts: { cursor: null, numItems: 1 },
		}),
	);

	return rows[0] ?? null;
}

async function insertAuditLog(ctx: MutationCtx, payload: AuditLogPayload) {
	await ctx.db.insert("auditLogs", {
		action: payload.action,
		description: payload.description,
		entityType: payload.entityType,
		entityId: payload.entityId,
		actorUserId: payload.actorUserId,
		actorEmail: payload.actorEmail ?? undefined,
		beforeJson: stringifyAuditValue(payload.before),
		afterJson: stringifyAuditValue(payload.after),
		metadataJson: stringifyAuditValue(payload.metadata),
		createdAt: Date.now(),
	});
}

function isConfiguredAdminEmail(email: string) {
	return configuredAdminEmails.includes(email.trim().toLowerCase());
}

function hasAdminRole(authUser: unknown) {
	if (!authUser || typeof authUser !== "object") {
		return false;
	}

	const userRecord = authUser as Record<string, unknown>;
	const role = userRecord.role;
	if (typeof role === "string") {
		return role === "admin";
	}
	if (Array.isArray(role)) {
		return role.some((item) => item === "admin");
	}
	return false;
}

function getAuthUserEmail(authUser: unknown) {
	if (!authUser || typeof authUser !== "object") {
		return null;
	}

	const userRecord = authUser as Record<string, unknown>;
	if (typeof userRecord.email !== "string") {
		return null;
	}

	const normalizedEmail = userRecord.email.trim().toLowerCase();
	return normalizedEmail.length > 0 ? normalizedEmail : null;
}

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
	return null;
}

function getAuthUserRecordId(authUser: unknown) {
	if (!authUser || typeof authUser !== "object") {
		return null;
	}

	const record = authUser as Record<string, unknown>;
	const candidates = [record._id, record.id, record.userId];
	for (const candidate of candidates) {
		const normalizedCandidate = normalizeIdValue(candidate);
		if (normalizedCandidate) {
			return normalizedCandidate;
		}
	}

	return null;
}

async function resolveAdminState(ctx: QueryCtx | MutationCtx) {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser) {
		return {
			authUser: null,
			email: null,
			userId: null,
			isAdmin: false,
		};
	}

	const email = getAuthUserEmail(authUser);
	const identity = await ctx.auth.getUserIdentity();
	const userId =
		normalizeIdValue(identity?.subject) ?? getAuthUserRecordId(authUser);
	const roleOverride =
		userId === null
			? null
			: await ctx.db
					.query("authUserRoles")
					.withIndex("by_userId", (query) => query.eq("userId", userId))
					.first();
	const isAdmin =
		hasAdminRole(authUser) ||
		(email ? isConfiguredAdminEmail(email) : false) ||
		roleOverride?.role === "admin" ||
		(userId ? runtimeAdminUserIds.has(userId) : false);

	if (isAdmin && userId) {
		runtimeAdminUserIds.add(userId);
	}

	return {
		authUser,
		email,
		userId,
		isAdmin,
	};
}

async function setRoleOverride(
	ctx: MutationCtx,
	args: {
		userId: string;
		role: AdminRole;
		updatedBy?: string;
	},
) {
	const existing = await ctx.db
		.query("authUserRoles")
		.withIndex("by_userId", (query) => query.eq("userId", args.userId))
		.collect();
	const now = Date.now();

	if (existing.length === 0) {
		await ctx.db.insert("authUserRoles", {
			userId: args.userId,
			role: args.role,
			updatedAt: now,
			updatedBy: args.updatedBy,
		});
		return;
	}

	for (const roleDoc of existing.slice(1)) {
		await ctx.db.delete(roleDoc._id);
	}

	await ctx.db.patch(existing[0]._id, {
		role: args.role,
		updatedAt: now,
		updatedBy: args.updatedBy,
	});
}

async function removeRoleOverride(ctx: MutationCtx, userId: string) {
	const existing = await ctx.db
		.query("authUserRoles")
		.withIndex("by_userId", (query) => query.eq("userId", userId))
		.collect();

	for (const roleDoc of existing) {
		await ctx.db.delete(roleDoc._id);
	}
}

async function requireAdminUserId(ctx: MutationCtx) {
	const adminState = await requireAdmin(ctx);
	if (!adminState.userId) {
		throw new Error("Không xác định được mã người dùng admin");
	}

	runtimeAdminUserIds.add(adminState.userId);
	return adminState.userId;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const adminState = await resolveAdminState(ctx);
	if (!adminState.authUser) {
		throw new Error("Bạn cần đăng nhập để thực hiện thao tác này");
	}
	if (!adminState.isAdmin) {
		throw new Error("Bạn không có quyền quản trị");
	}

	return adminState;
}

export async function requireCurrentUserAdmin(ctx: QueryCtx | MutationCtx) {
	return await requireAdmin(ctx);
}

export const authComponent = createClient<DataModel>(components.betterAuth);

function createAuth(
	ctx: GenericCtx<DataModel>,
	options?: {
		allowSignUpEndpoint?: boolean;
		includeAdminPlugin?: boolean;
	},
) {
	const disabledPaths = options?.allowSignUpEndpoint ? [] : ["/sign-up/email"];
	const includeAdminPlugin = options?.includeAdminPlugin ?? true;
	const plugins = [
		...(includeAdminPlugin
			? [
					admin({
						adminUserIds: Array.from(runtimeAdminUserIds),
					}),
				]
			: []),
		convex({
			authConfig,
			jwksRotateOnTokenGenerationError: true,
		}),
	];

	return betterAuth({
		baseURL: siteUrl,
		trustedOrigins,
		disabledPaths,
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						if (!isConfiguredAdminEmail(user.email)) {
							return {
								data: user,
							};
						}

						return {
							data: {
								...user,
								role: "admin",
							},
						};
					},
				},
			},
		},
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		plugins,
	});
}

export { createAuth };

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return await authComponent.safeGetAuthUser(ctx);
	},
});

export const isCurrentUserAdmin = query({
	args: {},
	handler: async (ctx) => {
		const adminState = await resolveAdminState(ctx);
		return adminState.isAdmin;
	},
});

export const bootstrapAdminRole = mutation({
	args: {},
	handler: async (ctx) => {
		const adminUserId = await requireAdminUserId(ctx);
		await setRoleOverride(ctx, {
			userId: adminUserId,
			role: "admin",
			updatedBy: adminUserId,
		});

		return {
			success: true,
		};
	},
});

export const adminCreateUser = mutation({
	args: {
		name: v.string(),
		email: v.string(),
		password: v.string(),
		role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
	},
	handler: async (ctx, args) => {
		const adminUserId = await requireAdminUserId(ctx);
		const adminState = await resolveAdminState(ctx);

		const name = args.name.trim();
		const email = args.email.trim().toLowerCase();
		if (name.length === 0) {
			throw new Error("Tên người dùng không được để trống");
		}
		if (!emailPattern.test(email)) {
			throw new Error("Email không hợp lệ");
		}
		if (args.password.length < 8) {
			throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
		}

		const { auth, headers } = await authComponent.getAuth(
			(innerCtx) =>
				createAuth(innerCtx, {
					allowSignUpEndpoint: true,
					includeAdminPlugin: false,
				}),
			ctx,
		);

		const result = await auth.api.signUpEmail({
			headers,
			body: {
				name,
				email,
				password: args.password,
			},
		});

		const role = args.role ?? "user";
		if (role === "admin") {
			await setRoleOverride(ctx, {
				userId: result.user.id,
				role: "admin",
				updatedBy: adminUserId,
			});
			runtimeAdminUserIds.add(result.user.id);
		}

		await insertAuditLog(ctx, {
			action: "user.created",
			description: `Tạo người dùng ${result.user.email}`,
			entityType: "user",
			entityId: result.user.id,
			actorUserId: adminUserId,
			actorEmail: adminState.email,
			after: {
				id: result.user.id,
				name: result.user.name,
				email: result.user.email,
				role,
			},
		});

		return {
			success: true,
			user: {
				id: result.user.id,
				name: result.user.name,
				email: result.user.email,
				role,
			},
		};
	},
});

export const adminGetUserRoleOverrides = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const overrides = await ctx.db.query("authUserRoles").collect();
		return overrides.map((item) => ({
			userId: item.userId,
			role: item.role,
		}));
	},
});

export const adminListAuditLogs = query({
	args: {
		limit: v.optional(v.number()),
		fromTs: v.optional(v.number()),
		toTs: v.optional(v.number()),
		entityType: v.optional(v.string()),
		actionPrefix: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const requestedLimit =
			typeof args.limit === "number" &&
			Number.isFinite(args.limit) &&
			args.limit > 0
				? Math.floor(args.limit)
				: undefined;

		const fromTs =
			typeof args.fromTs === "number" && Number.isFinite(args.fromTs)
				? Math.floor(args.fromTs)
				: undefined;
		const toTs =
			typeof args.toTs === "number" && Number.isFinite(args.toTs)
				? Math.floor(args.toTs)
				: undefined;

		if (fromTs !== undefined && toTs !== undefined && fromTs > toTs) {
			throw new Error("Khoảng thời gian không hợp lệ");
		}

		const logsQuery = (() => {
			if (fromTs !== undefined && toTs !== undefined) {
				return ctx.db
					.query("auditLogs")
					.withIndex("by_createdAt", (query) =>
						query.gte("createdAt", fromTs).lte("createdAt", toTs),
					);
			}

			if (fromTs !== undefined) {
				return ctx.db
					.query("auditLogs")
					.withIndex("by_createdAt", (query) => query.gte("createdAt", fromTs));
			}

			if (toTs !== undefined) {
				return ctx.db
					.query("auditLogs")
					.withIndex("by_createdAt", (query) => query.lte("createdAt", toTs));
			}

			return ctx.db.query("auditLogs").withIndex("by_createdAt");
		})();

		const logs = await logsQuery.order("desc").collect();
		const entityTypeFilter = args.entityType?.trim().toLowerCase();
		const actionPrefixFilter = args.actionPrefix?.trim().toLowerCase();

		const filteredLogs = logs.filter((item) => {
			if (
				entityTypeFilter &&
				item.entityType.trim().toLowerCase() !== entityTypeFilter
			) {
				return false;
			}

			if (
				actionPrefixFilter &&
				!item.action.trim().toLowerCase().startsWith(actionPrefixFilter)
			) {
				return false;
			}

			return true;
		});

		const resultLogs =
			requestedLimit !== undefined
				? filteredLogs.slice(0, requestedLimit)
				: filteredLogs;

		return resultLogs.map((item) => ({
			id: item._id,
			action: item.action,
			description: item.description,
			entityType: item.entityType,
			entityId: item.entityId,
			actorUserId: item.actorUserId,
			actorEmail: item.actorEmail,
			before: parseAuditValue(item.beforeJson),
			after: parseAuditValue(item.afterJson),
			metadata: parseAuditValue(item.metadataJson),
			createdAt: item.createdAt,
		}));
	},
});

export const adminSetUserRole = mutation({
	args: {
		userId: v.string(),
		role: v.union(v.literal("admin"), v.literal("user")),
	},
	handler: async (ctx, args) => {
		const adminUserId = await requireAdminUserId(ctx);
		const adminState = await resolveAdminState(ctx);
		const userRow = await findAuthUserRowById(ctx, args.userId);
		const roleOverride = await ctx.db
			.query("authUserRoles")
			.withIndex("by_userId", (query) => query.eq("userId", args.userId))
			.first();
		const previousRole = roleOverride?.role ?? extractRoleFromUserRow(userRow);

		if (
			args.userId === adminUserId &&
			args.role === "user" &&
			!configuredAdminUserIds.includes(adminUserId)
		) {
			throw new Error("Không thể tự gỡ quyền admin của chính bạn");
		}

		if (args.role === "admin") {
			await setRoleOverride(ctx, {
				userId: args.userId,
				role: "admin",
				updatedBy: adminUserId,
			});
			runtimeAdminUserIds.add(args.userId);
		} else {
			await removeRoleOverride(ctx, args.userId);
			if (!configuredAdminUserIds.includes(args.userId)) {
				runtimeAdminUserIds.delete(args.userId);
			}
		}

		await insertAuditLog(ctx, {
			action: "user.role_changed",
			description: `Đổi quyền người dùng ${typeof userRow?.email === "string" ? userRow.email : args.userId} từ ${previousRole} sang ${args.role}`,
			entityType: "user",
			entityId: args.userId,
			actorUserId: adminUserId,
			actorEmail: adminState.email,
			before: {
				role: previousRole,
			},
			after: {
				role: args.role,
			},
			metadata: {
				target: buildAuditUserSnapshot(userRow),
			},
		});

		return {
			success: true,
		};
	},
});

export const adminSetUserPassword = mutation({
	args: {
		userId: v.string(),
		newPassword: v.string(),
	},
	handler: async (ctx, args) => {
		const adminUserId = await requireAdminUserId(ctx);
		const adminState = await resolveAdminState(ctx);
		const userRow = await findAuthUserRowById(ctx, args.userId);

		const nextPassword = args.newPassword.trim();
		if (nextPassword.length < 8) {
			throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự");
		}

		const { auth, headers } = await authComponent.getAuth(
			(innerCtx) => createAuth(innerCtx),
			ctx,
		);

		await auth.api.setUserPassword({
			headers,
			body: {
				userId: args.userId,
				newPassword: nextPassword,
			},
		});

		await insertAuditLog(ctx, {
			action: "user.password_changed",
			description: `Đổi mật khẩu người dùng ${typeof userRow?.email === "string" ? userRow.email : args.userId}`,
			entityType: "user",
			entityId: args.userId,
			actorUserId: adminUserId,
			actorEmail: adminState.email,
			metadata: {
				target: buildAuditUserSnapshot(userRow),
			},
		});

		return {
			success: true,
		};
	},
});

export const adminListUsers = mutation({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireAdminUserId(ctx);

		const paginationLimit =
			typeof args.limit === "number" && args.limit > 0
				? Math.min(Math.floor(args.limit), 500)
				: 200;

		const adapterResult = await ctx.runQuery(
			components.betterAuth.adapter.findMany,
			{
				model: "user",
				paginationOpts: {
					cursor: null,
					numItems: paginationLimit,
				},
				sortBy: {
					field: "createdAt",
					direction: "desc",
				},
			},
		);

		const rows = extractRowsFromAdapterResult(adapterResult);
		const roleOverrides = await ctx.db.query("authUserRoles").collect();
		const roleByUserId = new Map(
			roleOverrides.map((item) => [item.userId, item.role] as const),
		);

		const users = rows.map((row) => {
			const rowId =
				normalizeIdValue(row.id) ??
				normalizeIdValue(row._id) ??
				normalizeIdValue(row.userId) ??
				"";

			const roleFromRecord =
				typeof row.role === "string" && row.role === "admin" ? "admin" : "user";

			return {
				id: rowId,
				name: typeof row.name === "string" ? row.name : "",
				email: typeof row.email === "string" ? row.email : "",
				role: roleByUserId.get(rowId) ?? roleFromRecord,
				createdAt: parseTimestamp(row.createdAt),
			};
		});

		return {
			users,
			total: users.length,
		};
	},
});

export const adminUpdateUser = mutation({
	args: {
		userId: v.string(),
		name: v.string(),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const adminUserId = await requireAdminUserId(ctx);
		const adminState = await resolveAdminState(ctx);
		const beforeRow = await findAuthUserRowById(ctx, args.userId);

		const name = args.name.trim();
		const email = args.email.trim().toLowerCase();
		if (name.length === 0) {
			throw new Error("Tên người dùng không được để trống");
		}
		if (!emailPattern.test(email)) {
			throw new Error("Email không hợp lệ");
		}

		await ctx.runMutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: "user",
				where: [
					{
						field: "_id",
						operator: "eq",
						value: args.userId,
					},
				],
				update: {
					name,
					email,
					updatedAt: Date.now(),
				},
			},
		});

		await insertAuditLog(ctx, {
			action: "user.updated",
			description: `Cập nhật thông tin người dùng ${email}`,
			entityType: "user",
			entityId: args.userId,
			actorUserId: adminUserId,
			actorEmail: adminState.email,
			before: buildAuditUserSnapshot(beforeRow),
			after: {
				...(buildAuditUserSnapshot(beforeRow) ?? {}),
				id: args.userId,
				name,
				email,
			},
		});

		return {
			success: true,
		};
	},
});

export const adminDeleteUser = mutation({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const adminUserId = await requireAdminUserId(ctx);
		const adminState = await resolveAdminState(ctx);
		if (args.userId === adminUserId) {
			throw new Error("Không thể tự xóa tài khoản admin đang đăng nhập");
		}

		const deletedUserRow = await findAuthUserRowById(ctx, args.userId);

		const sessionRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "session",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of sessionRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "session",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		const accountRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "account",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of accountRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "account",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		const twoFactorRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "twoFactor",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of twoFactorRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "twoFactor",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		const passkeyRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "passkey",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of passkeyRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "passkey",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		const oauthApplicationRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "oauthApplication",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of oauthApplicationRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "oauthApplication",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		const oauthAccessTokenRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "oauthAccessToken",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of oauthAccessTokenRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "oauthAccessToken",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		const oauthConsentRows = extractRowsFromAdapterResult(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "oauthConsent",
				where: [{ field: "userId", operator: "eq", value: args.userId }],
				paginationOpts: { cursor: null, numItems: 500 },
			}),
		);
		for (const row of oauthConsentRows) {
			const rowId = normalizeIdValue(row._id);
			if (!rowId) continue;
			await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
				input: {
					model: "oauthConsent",
					where: [{ field: "_id", operator: "eq", value: rowId }],
				},
			});
		}

		await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
			input: {
				model: "user",
				where: [{ field: "_id", operator: "eq", value: args.userId }],
			},
		});

		await removeRoleOverride(ctx, args.userId);
		if (!configuredAdminUserIds.includes(args.userId)) {
			runtimeAdminUserIds.delete(args.userId);
		}

		await insertAuditLog(ctx, {
			action: "user.deleted",
			description: `Xóa người dùng ${typeof deletedUserRow?.email === "string" ? deletedUserRow.email : args.userId}`,
			entityType: "user",
			entityId: args.userId,
			actorUserId: adminUserId,
			actorEmail: adminState.email,
			before: buildAuditUserSnapshot(deletedUserRow),
		});

		return {
			success: true,
		};
	},
});
