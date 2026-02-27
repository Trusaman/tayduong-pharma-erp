import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const positionValidator = v.union(
    v.literal("thử việc"),
    v.literal("học việc"),
    v.literal("chính thức"),
    v.literal("cộng tác viên"),
    v.literal("trưởng nhóm"),
    v.literal("trưởng phòng"),
    v.literal("phó giám đốc"),
    v.literal("giám đốc"),
);

const trackingStatusValidator = v.union(
    v.literal("theo dõi"),
    v.literal("ngừng theo dõi"),
);

export const list = query({
    args: {
        trackingStatus: v.optional(trackingStatusValidator),
    },
    handler: async (ctx, args) => {
        if (args.trackingStatus) {
            return await ctx.db
                .query("employees")
                .withIndex("by_trackingStatus", (q) =>
                    q.eq("trackingStatus", args.trackingStatus!),
                )
                .order("asc")
                .collect();
        }
        return await ctx.db.query("employees").order("asc").collect();
    },
});

export const create = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        phone: v.string(),
        position: positionValidator,
        trackingStatus: trackingStatusValidator,
        joinedDate: v.number(),
        resignationDate: v.optional(v.number()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("employees", {
            name: args.name,
            email: args.email,
            phone: args.phone,
            position: args.position,
            trackingStatus: args.trackingStatus,
            joinedDate: args.joinedDate,
            resignationDate: args.resignationDate,
            notes: args.notes,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const update = mutation({
    args: {
        id: v.id("employees"),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        position: v.optional(positionValidator),
        trackingStatus: v.optional(trackingStatusValidator),
        joinedDate: v.optional(v.number()),
        resignationDate: v.optional(v.number()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...rest } = args;
        const existing = await ctx.db.get(id);
        if (!existing) throw new Error("Không tìm thấy nhân viên");

        // Validate: ngừng theo dõi phải có resignationDate
        const newStatus = rest.trackingStatus ?? existing.trackingStatus;
        const newResignationDate =
            rest.resignationDate ?? existing.resignationDate;
        if (newStatus === "ngừng theo dõi" && !newResignationDate) {
            throw new Error(
                'Cần nhập ngày thôi việc khi chuyển sang "Ngừng theo dõi"',
            );
        }

        await ctx.db.patch(id, {
            ...rest,
            updatedAt: Date.now(),
        });
    },
});

export const remove = mutation({
    args: { id: v.id("employees") },
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.id);
        if (!existing) throw new Error("Không tìm thấy nhân viên");
        await ctx.db.delete(args.id);
    },
});
