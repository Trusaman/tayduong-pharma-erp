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

	// Custom Units
	units: defineTable({
		name: v.string(),
		value: v.string(), // lowercase value used in products
		createdAt: v.number(),
	}).index("by_value", ["value"]),

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

	// Salesmen
	salesmen: defineTable({
		name: v.string(),
		code: v.string(),
		phone: v.optional(v.string()),
		notes: v.optional(v.string()),
		isActive: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_code", ["code"])
		.index("by_active", ["isActive"]),

	// Discount Rules
	discountRules: defineTable({
		name: v.string(),
		discountType: v.union(
			v.literal("Doctor"),
			v.literal("hospital"),
			v.literal("payment"),
			v.literal("Salesman"),
			v.literal("Manager"),
		),
		customerId: v.optional(v.id("customers")),
		productId: v.optional(v.id("products")),
		salesmanId: v.id("salesmen"),
		discountPercent: v.number(),
		createdByStaff: v.string(),
		notes: v.optional(v.string()),
		isActive: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_salesman", ["salesmanId"])
		.index("by_customer", ["customerId"])
		.index("by_product", ["productId"])
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
		stockTransferId: v.optional(v.id("stockTransfers")),
		location: v.optional(v.string()), // warehouse location
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_product", ["productId"])
		.index("by_expiry", ["expiryDate"])
		.index("by_batch", ["batchNumber"])
		.index("by_stockTransfer", ["stockTransferId"]),

	// Purchase Orders
	purchaseOrders: defineTable({
		orderNumber: v.string(),
		supplierId: v.id("suppliers"),
		status: v.union(
			v.literal("draft"),
			v.literal("pending"),
			v.literal("partial"),
			v.literal("received"),
			v.literal("cancelled"),
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
	}).index("by_purchaseOrder", ["purchaseOrderId"]),

	// Sales Orders
	salesOrders: defineTable({
		orderNumber: v.string(),
		customerId: v.id("customers"),
		salesmanId: v.optional(v.id("salesmen")),
		status: v.union(
			v.literal("draft"),
			v.literal("pending"),
			v.literal("delivering"),
			v.literal("completed"),
			v.literal("cancelled"),
		),
		deliveryEmployeeId: v.optional(v.id("employees")),
		totalAmount: v.number(),
		totalDiscountAmount: v.optional(v.number()),
		notes: v.optional(v.string()),
		orderDate: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_orderNumber", ["orderNumber"])
		.index("by_customer", ["customerId"])
		.index("by_salesman", ["salesmanId"])
		.index("by_status", ["status"]),

	// Sales Order Items
	salesOrderItems: defineTable({
		salesOrderId: v.id("salesOrders"),
		productId: v.id("products"),
		quantity: v.number(),
		baseUnitPrice: v.optional(v.number()),
		unitPrice: v.number(),
		discountPercent: v.optional(v.number()),
		discountAmount: v.optional(v.number()),
		appliedDiscountTypes: v.optional(v.array(v.string())),
		fulfilledQuantity: v.number(),
		createdAt: v.number(),
	}).index("by_salesOrder", ["salesOrderId"]),

	// Sales Order Status Logs
	salesOrderStatusLogs: defineTable({
		salesOrderId: v.id("salesOrders"),
		fromStatus: v.union(
			v.literal("draft"),
			v.literal("pending"),
			v.literal("delivering"),
			v.literal("completed"),
			v.literal("cancelled"),
		),
		toStatus: v.union(
			v.literal("draft"),
			v.literal("pending"),
			v.literal("delivering"),
			v.literal("completed"),
			v.literal("cancelled"),
		),
		changedByName: v.string(),
		comment: v.optional(v.string()),
		deliveryEmployeeId: v.optional(v.id("employees")),
		createdAt: v.number(),
	}).index("by_salesOrder", ["salesOrderId"]),

	// Stock Transfers (Phiếu nhập/xuất kho)
	stockTransfers: defineTable({
		transferNumber: v.string(), // PN001, PX001, PTX001, etc.
		transferType: v.union(
			v.literal("import"), // Nhập từ NCC (từ đơn nhập)
			v.literal("import_return"), // Nhập trả lại từ khách hàng
			v.literal("export"), // Xuất bán hàng (từ đơn bán)
			v.literal("export_return"), // Xuất trả lại NCC
			v.literal("export_gift"), // Xuất tặng/biển tặng
			v.literal("export_destruction"), // Xuất hủy
		),
		referenceType: v.optional(
			v.union(
				v.literal("purchaseOrder"),
				v.literal("salesOrder"),
				v.literal("manual"),
			),
		),
		referenceId: v.optional(v.id("purchaseOrders")), // or salesOrderId
		partnerType: v.optional(
			v.union(v.literal("supplier"), v.literal("customer")),
		),
		partnerId: v.optional(v.id("suppliers")), // or customerId
		status: v.union(
			v.literal("draft"),
			v.literal("confirmed"),
			v.literal("cancelled"),
		),
		notes: v.optional(v.string()),
		transferDate: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_transferNumber", ["transferNumber"])
		.index("by_transferType", ["transferType"])
		.index("by_status", ["status"]),

	// Stock Transfer Items
	stockTransferItems: defineTable({
		stockTransferId: v.id("stockTransfers"),
		productId: v.id("products"),
		inventoryId: v.optional(v.id("inventory")), // for exports - which batch
		batchNumber: v.string(),
		quantity: v.number(),
		unitPrice: v.number(),
		expiryDate: v.number(),
		reason: v.optional(v.string()), // lý do xuất trả/hủy
		createdAt: v.number(),
	})
		.index("by_stockTransfer", ["stockTransferId"])
		.index("by_product", ["productId"])
		.index("by_inventory", ["inventoryId"]),

	// Employees
	employees: defineTable({
		name: v.string(),
		email: v.string(),
		phone: v.string(),
		position: v.union(
			v.literal("thử việc"),
			v.literal("học việc"),
			v.literal("chính thức"),
			v.literal("cộng tác viên"),
			v.literal("trưởng nhóm"),
			v.literal("trưởng phòng"),
			v.literal("phó giám đốc"),
			v.literal("giám đốc"),
		),
		trackingStatus: v.union(
			v.literal("theo dõi"),
			v.literal("ngừng theo dõi"),
		),
		joinedDate: v.number(), // timestamp
		resignationDate: v.optional(v.number()), // timestamp, required when ngừng theo dõi
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_trackingStatus", ["trackingStatus"])
		.index("by_position", ["position"]),
});

