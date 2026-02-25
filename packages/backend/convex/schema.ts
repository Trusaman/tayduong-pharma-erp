import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Product Categories
  categories: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Products/Medicines
  products: defineTable({
    name: v.string(),
    sku: v.string(),
    categoryId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
    unit: v.string(), // tablet, bottle, box, etc.
    purchasePrice: v.number(),
    salePrice: v.number(),
    minStock: v.number(), // minimum stock level for alerts
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sku", ["sku"])
    .index("by_category", ["categoryId"])
    .index("by_active", ["isActive"]),

  // Suppliers
  suppliers: defineTable({
    name: v.string(),
    code: v.string(),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // Customers
  customers: defineTable({
    name: v.string(),
    code: v.string(),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // Inventory Batches
  inventory: defineTable({
    productId: v.id("products"),
    batchNumber: v.string(),
    quantity: v.number(),
    expiryDate: v.number(), // timestamp
    purchasePrice: v.number(), // cost at purchase time
    supplierId: v.optional(v.id("suppliers")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    location: v.optional(v.string()), // warehouse location
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_expiry", ["expiryDate"])
    .index("by_batch", ["batchNumber"]),

  // Purchase Orders
  purchaseOrders: defineTable({
    orderNumber: v.string(),
    supplierId: v.id("suppliers"),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("partial"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    totalAmount: v.number(),
    notes: v.optional(v.string()),
    orderDate: v.number(),
    expectedDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_supplier", ["supplierId"])
    .index("by_status", ["status"]),

  // Purchase Order Items
  purchaseOrderItems: defineTable({
    purchaseOrderId: v.id("purchaseOrders"),
    productId: v.id("products"),
    quantity: v.number(),
    unitPrice: v.number(),
    receivedQuantity: v.number(),
    batchNumber: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_purchaseOrder", ["purchaseOrderId"]),

  // Sales Orders
  salesOrders: defineTable({
    orderNumber: v.string(),
    customerId: v.id("customers"),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("partial"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    totalAmount: v.number(),
    notes: v.optional(v.string()),
    orderDate: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"]),

  // Sales Order Items
  salesOrderItems: defineTable({
    salesOrderId: v.id("salesOrders"),
    productId: v.id("products"),
    quantity: v.number(),
    unitPrice: v.number(),
    fulfilledQuantity: v.number(),
    createdAt: v.number(),
  })
    .index("by_salesOrder", ["salesOrderId"]),
});
