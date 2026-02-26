import { query } from "./_generated/server";

export const getStats = query({
	args: {},
	handler: async (ctx) => {
		// Get counts
		const products = await ctx.db.query("products").collect();
		const activeProducts = products.filter((p) => p.isActive).length;

		const customers = await ctx.db.query("customers").collect();
		const activeCustomers = customers.filter((c) => c.isActive).length;

		const suppliers = await ctx.db.query("suppliers").collect();
		const activeSuppliers = suppliers.filter((s) => s.isActive).length;

		// Get inventory stats
		const inventory = await ctx.db.query("inventory").collect();
		const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

		// Get low stock products
		const lowStockProducts: Array<{
			_id: string;
			name: string;
			sku: string;
			totalStock: number;
			minStock: number;
		}> = [];

		for (const product of products) {
			const productInventory = inventory.filter(
				(i) => i.productId === product._id,
			);
			const stock = productInventory.reduce((sum, i) => sum + i.quantity, 0);
			if (stock < product.minStock) {
				lowStockProducts.push({
					_id: product._id,
					name: product.name,
					sku: product.sku,
					totalStock: stock,
					minStock: product.minStock,
				});
			}
		}

		// Get expiring soon (30 days)
		const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
		const expiringInventory = inventory.filter(
			(i) => i.expiryDate < thirtyDays && i.quantity > 0,
		);

		// Get purchase orders stats
		const purchaseOrders = await ctx.db.query("purchaseOrders").collect();
		const pendingPurchaseOrders = purchaseOrders.filter(
			(o) => o.status === "pending" || o.status === "draft",
		).length;

		// Get sales orders stats
		const salesOrders = await ctx.db.query("salesOrders").collect();
		const pendingSalesOrders = salesOrders.filter(
			(o) => o.status === "pending" || o.status === "draft",
		).length;

		// Calculate total sales this month
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
		const monthlySales = salesOrders
			.filter((o) => o.orderDate >= monthStart && o.status !== "cancelled")
			.reduce((sum, o) => sum + o.totalAmount, 0);

		// Calculate total purchases this month
		const monthlyPurchases = purchaseOrders
			.filter((o) => o.orderDate >= monthStart && o.status !== "cancelled")
			.reduce((sum, o) => sum + o.totalAmount, 0);

		// Recent sales orders
		const recentSalesOrders = await Promise.all(
			salesOrders
				.sort((a, b) => b.orderDate - a.orderDate)
				.slice(0, 5)
				.map(async (order) => {
					const customer = await ctx.db.get(order.customerId);
					return {
						...order,
						customerName: customer?.name || "Unknown",
					};
				}),
		);

		// Recent purchase orders
		const recentPurchaseOrders = await Promise.all(
			purchaseOrders
				.sort((a, b) => b.orderDate - a.orderDate)
				.slice(0, 5)
				.map(async (order) => {
					const supplier = await ctx.db.get(order.supplierId);
					return {
						...order,
						supplierName: supplier?.name || "Unknown",
					};
				}),
		);

		return {
			counts: {
				products: activeProducts,
				customers: activeCustomers,
				suppliers: activeSuppliers,
				totalStock,
			},
			alerts: {
				lowStock: lowStockProducts.length,
				expiringSoon: expiringInventory.length,
			},
			orders: {
				pendingPurchase: pendingPurchaseOrders,
				pendingSales: pendingSalesOrders,
			},
			financials: {
				monthlySales,
				monthlyPurchases,
			},
			recentActivity: {
				salesOrders: recentSalesOrders,
				purchaseOrders: recentPurchaseOrders,
			},
			lowStockProducts,
			expiringInventory: await Promise.all(
				expiringInventory.slice(0, 10).map(async (i) => {
					const product = await ctx.db.get(i.productId);
					return {
						...i,
						productName: product?.name || "Unknown",
					};
				}),
			),
		};
	},
});
