import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	// Auth user role overrides (for admin panel permissions)
	authUserRoles: defineTable({
		userId: v.string(),
		role: v.union(v.literal("admin"), v.literal("user")),
		updatedAt: v.number(),
		updatedBy: v.optional(v.string()),
	})
		.index("by_userId", ["userId"])
		.index("by_role", ["role"]),

	// Admin audit logs for user management actions
	auditLogs: defineTable({
		action: v.string(),
		description: v.string(),
		entityType: v.string(),
		entityId: v.optional(v.string()),
		actorUserId: v.optional(v.string()),
		actorEmail: v.optional(v.string()),
		beforeJson: v.optional(v.string()),
		afterJson: v.optional(v.string()),
		metadataJson: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_createdAt", ["createdAt"])
		.index("by_entityType_and_entityId", ["entityType", "entityId"])
		.index("by_actorUserId_and_createdAt", ["actorUserId", "createdAt"]),

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
		unit: v.string(), // tablet, bottle, box, etc.
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
		ruleGroupId: v.optional(v.string()),
		customerId: v.optional(v.id("customers")),
		productId: v.optional(v.id("products")),
		unitPrice: v.optional(v.number()),
		createdByStaff: v.string(),
		notes: v.optional(v.string()),
		doctorDiscount: v.optional(
			v.object({
				salesmanId: v.id("salesmen"),
				discountPercent: v.number(),
			}),
		),
		salesDiscount: v.optional(
			v.object({
				salesmanId: v.id("salesmen"),
				discountPercent: v.number(),
			}),
		),
		paymentDiscount: v.optional(
			v.object({
				salesmanId: v.id("salesmen"),
				discountPercent: v.number(),
			}),
		),
		ctvDiscount: v.optional(
			v.object({
				salesmanId: v.id("salesmen"),
				discountPercent: v.number(),
			}),
		),
		managerDiscount: v.optional(
			v.object({
				salesmanId: v.id("salesmen"),
				discountPercent: v.number(),
			}),
		),
		// Legacy flat fields kept optional so existing documents remain readable.
		discountType: v.optional(
			v.union(
				v.literal("Doctor"),
				v.literal("hospital"),
				v.literal("payment"),
				v.literal("CTV"),
				v.literal("Salesman"),
				v.literal("Manager"),
			),
		),
		salesmanId: v.optional(v.id("salesmen")),
		discountPercent: v.optional(v.number()),
		editHistory: v.optional(
			v.array(
				v.object({
					editedAt: v.number(),
					editedBy: v.string(),
					changes: v.array(
						v.object({
							field: v.string(),
							from: v.optional(v.string()),
							to: v.optional(v.string()),
						}),
					),
				}),
			),
		),
		isActive: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_rule_group", ["ruleGroupId"])
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
		editHistory: v.optional(
			v.array(
				v.object({
					editedAt: v.number(),
					editedBy: v.string(),
					changes: v.array(
						v.object({
							field: v.string(),
							from: v.optional(v.string()),
							to: v.optional(v.string()),
						}),
					),
				}),
			),
		),
		orderDate: v.number(),
		completedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_orderNumber", ["orderNumber"])
		.index("by_customer", ["customerId"])
		.index("by_salesman", ["salesmanId"])
		.index("by_status_and_completedAt", ["status", "completedAt"])
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
		appliedDiscountBreakdown: v.optional(
			v.array(
				v.object({
					ruleId: v.id("discountRules"),
					ruleName: v.string(),
					discountType: v.union(
						v.literal("Doctor"),
						v.literal("hospital"),
						v.literal("payment"),
						v.literal("CTV"),
						v.literal("Salesman"),
						v.literal("Manager"),
					),
					salesmanId: v.id("salesmen"),
					salesmanName: v.optional(v.string()),
					configuredPercent: v.number(),
					allocatedPercent: v.number(),
					discountAmount: v.number(),
				}),
			),
		),
		fulfilledQuantity: v.number(),
		createdAt: v.number(),
	}).index("by_salesOrder", ["salesOrderId"]),

	monthlyDiscountCalculations: defineTable({
		periodKey: v.string(),
		month: v.number(),
		year: v.number(),
		startDate: v.number(),
		endDate: v.number(),
		orderCount: v.number(),
		entryCount: v.number(),
		recipientCount: v.number(),
		totalDiscountAmount: v.number(),
		savedBy: v.string(),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_period_key", ["periodKey"]),

	monthlyDiscountCalculationEntries: defineTable({
		calculationId: v.id("monthlyDiscountCalculations"),
		periodKey: v.string(),
		month: v.number(),
		year: v.number(),
		salesmanId: v.id("salesmen"),
		salesmanNameSnapshot: v.string(),
		salesOrderId: v.id("salesOrders"),
		salesOrderItemId: v.id("salesOrderItems"),
		orderNumber: v.string(),
		orderDate: v.number(),
		completedAt: v.number(),
		customerId: v.id("customers"),
		customerNameSnapshot: v.string(),
		productId: v.id("products"),
		productNameSnapshot: v.string(),
		quantity: v.number(),
		baseUnitPrice: v.number(),
		revenueAmount: v.number(),
		lineDiscountAmount: v.number(),
		discountType: v.union(
			v.literal("Doctor"),
			v.literal("hospital"),
			v.literal("payment"),
			v.literal("CTV"),
			v.literal("Salesman"),
			v.literal("Manager"),
		),
		ruleId: v.optional(v.id("discountRules")),
		ruleName: v.string(),
		configuredPercent: v.number(),
		allocatedPercent: v.number(),
		discountAmount: v.number(),
		createdAt: v.number(),
	})
		.index("by_calculation", ["calculationId"])
		.index("by_calculation_and_salesman", ["calculationId", "salesmanId"])
		.index("by_salesman", ["salesmanId"])
		.index("by_period_key", ["periodKey"]),

	monthlyDiscountRecalculationLogs: defineTable({
		periodKey: v.string(),
		month: v.number(),
		year: v.number(),
		recalculatedBy: v.string(),
		completedOrderCount: v.number(),
		repairedOrderCount: v.number(),
		repairedItemCount: v.number(),
		createdAt: v.number(),
	})
		.index("by_period_key", ["periodKey"])
		.index("by_period_key_and_createdAt", ["periodKey", "createdAt"]),

	employeeDiscountDebts: defineTable({
		calculationId: v.id("monthlyDiscountCalculations"),
		periodKey: v.string(),
		month: v.number(),
		year: v.number(),
		salesmanId: v.id("salesmen"),
		salesmanNameSnapshot: v.string(),
		totalDebtAmount: v.number(),
		paidAmount: v.number(),
		remainingAmount: v.number(),
		paymentStatus: v.union(
			v.literal("unpaid"),
			v.literal("partial"),
			v.literal("paid"),
		),
		lastPaidAt: v.optional(v.number()),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_calculation", ["calculationId"])
		.index("by_salesman", ["salesmanId"])
		.index("by_period_key", ["periodKey"])
		.index("by_status", ["paymentStatus"]),

	employeeDiscountDebtPayments: defineTable({
		debtId: v.id("employeeDiscountDebts"),
		amount: v.number(),
		paymentDate: v.number(),
		paidBy: v.string(),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	}).index("by_debt", ["debtId"]),

	employeeDiscountDebtOrderPayments: defineTable({
		debtId: v.id("employeeDiscountDebts"),
		calculationId: v.id("monthlyDiscountCalculations"),
		periodKey: v.string(),
		salesmanId: v.id("salesmen"),
		salesOrderId: v.id("salesOrders"),
		orderNumberSnapshot: v.string(),
		amount: v.number(),
		paymentDate: v.number(),
		paidBy: v.string(),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index("by_debt", ["debtId"])
		.index("by_debt_and_order", ["debtId", "salesOrderId"])
		.index("by_calculation", ["calculationId"]),

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
		portraitImage: v.optional(
			v.object({
				storageId: v.id("_storage"),
				logicalPath: v.string(),
				fileName: v.string(),
				originalFileName: v.string(),
				contentType: v.string(),
				size: v.number(),
				uploadedAt: v.number(),
			}),
		),
		identityCardImage: v.optional(
			v.object({
				storageId: v.id("_storage"),
				logicalPath: v.string(),
				fileName: v.string(),
				originalFileName: v.string(),
				contentType: v.string(),
				size: v.number(),
				uploadedAt: v.number(),
			}),
		),
		employeeCode: v.optional(v.string()),
		name: v.string(),
		gender: v.optional(v.union(v.literal("nam"), v.literal("nu"))),
		birthDate: v.optional(v.number()),
		identityNumber: v.optional(v.string()),
		identityIssuedDate: v.optional(v.number()),
		identityIssuedPlace: v.optional(v.string()),
		nationality: v.optional(v.string()),
		passportNumber: v.optional(v.string()),
		email: v.string(),
		phone: v.string(),
		department: v.optional(v.string()),
		taxId: v.optional(v.string()),
		agreedSalary: v.optional(v.number()),
		salaryCoefficient: v.optional(v.number()),
		insuranceSalary: v.optional(v.number()),
		contractType: v.optional(v.string()),
		dependentCount: v.optional(v.number()),
		customerSupplierGroup: v.optional(v.string()),
		bankAccounts: v.optional(
			v.array(
				v.object({
					accountNumber: v.string(),
					bankName: v.string(),
					branch: v.string(),
					bankProvinceCity: v.string(),
				}),
			),
		),
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
		trackingStatus: v.union(v.literal("theo dõi"), v.literal("ngừng theo dõi")),
		joinedDate: v.number(), // timestamp
		resignationDate: v.optional(v.number()), // timestamp, required when ngừng theo dõi
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_trackingStatus", ["trackingStatus"])
		.index("by_position", ["position"]),
});
