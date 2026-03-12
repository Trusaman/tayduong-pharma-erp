import type { Doc, Id } from "./_generated/dataModel";

export const discountTypeLabels = {
	Doctor: "Chiết khấu BS",
	hospital: "Chiết khấu NT, KD",
	payment: "Chiết khấu thanh toán",
	CTV: "Chiết khấu CTV",
	Salesman: "Chiết khấu NT, KD",
	Manager: "Chiết khấu Quản lý",
} as const;

export type DiscountTypeValue = keyof typeof discountTypeLabels;

type DiscountFieldName =
	| "doctorDiscount"
	| "salesDiscount"
	| "paymentDiscount"
	| "ctvDiscount"
	| "managerDiscount";

const fieldToDiscountType: Record<DiscountFieldName, DiscountTypeValue> = {
	doctorDiscount: "Doctor",
	salesDiscount: "hospital",
	paymentDiscount: "payment",
	ctvDiscount: "CTV",
	managerDiscount: "Manager",
};

export type DiscountRuleDoc = Doc<"discountRules">;

export type ConfiguredDiscountDetail = {
	ruleId: Id<"discountRules">;
	ruleName: string;
	discountType: DiscountTypeValue;
	salesmanId: Id<"salesmen">;
	discountPercent: number;
};

export type AppliedDiscountBreakdownEntry = {
	ruleId: Id<"discountRules">;
	ruleName: string;
	discountType: DiscountTypeValue;
	salesmanId: Id<"salesmen">;
	salesmanName?: string;
	configuredPercent: number;
	allocatedPercent: number;
	discountAmount: number;
};

export function clampPercent(percent: number) {
	if (percent < 0) return 0;
	if (percent > 100) return 100;
	return percent;
}

export function roundMoney(amount: number) {
	return Math.round(amount * 100) / 100;
}

export function getConfiguredDiscounts(rule: DiscountRuleDoc) {
	const details: ConfiguredDiscountDetail[] = [];

	for (const field of Object.keys(fieldToDiscountType) as DiscountFieldName[]) {
		const detail = rule[field];
		if (detail?.salesmanId) {
			details.push({
				ruleId: rule._id,
				ruleName: rule.name,
				discountType: fieldToDiscountType[field],
				salesmanId: detail.salesmanId,
				discountPercent: clampPercent(detail.discountPercent),
			});
		}
	}

	if (details.length > 0) {
		return details;
	}

	if (
		rule.discountType &&
		rule.salesmanId &&
		typeof rule.discountPercent === "number"
	) {
		return [
			{
				ruleId: rule._id,
				ruleName: rule.name,
				discountType: rule.discountType,
				salesmanId: rule.salesmanId,
				discountPercent: clampPercent(rule.discountPercent),
			},
		];
	}

	return [];
}

export function getMatchingRuleDiscounts(
	rules: DiscountRuleDoc[],
	customerId: Id<"customers">,
	productId: Id<"products">,
) {
	return rules.flatMap((rule) => {
		const customerMatch = !rule.customerId || rule.customerId === customerId;
		const productMatch = !rule.productId || rule.productId === productId;
		if (!customerMatch || !productMatch) {
			return [];
		}

		return getConfiguredDiscounts(rule);
	});
}

export function allocateDiscountBreakdown(
	details: ConfiguredDiscountDetail[],
	appliedDiscountPercent: number,
	lineDiscountAmount: number,
) {
	if (
		details.length === 0 ||
		lineDiscountAmount <= 0 ||
		appliedDiscountPercent <= 0
	) {
		return [] as AppliedDiscountBreakdownEntry[];
	}

	const totalConfiguredPercent = details.reduce(
		(sum, detail) => sum + detail.discountPercent,
		0,
	);

	if (totalConfiguredPercent <= 0) {
		return [] as AppliedDiscountBreakdownEntry[];
	}

	let allocatedAmount = 0;
	let allocatedPercent = 0;

	return details.map((detail, index) => {
		const isLast = index === details.length - 1;
		const proportionalPercent =
			(appliedDiscountPercent * detail.discountPercent) /
			totalConfiguredPercent;
		const nextPercent = isLast
			? roundMoney(Math.max(0, appliedDiscountPercent - allocatedPercent))
			: roundMoney(proportionalPercent);
		allocatedPercent = roundMoney(allocatedPercent + nextPercent);

		const proportionalAmount =
			(lineDiscountAmount * detail.discountPercent) / totalConfiguredPercent;
		const nextAmount = isLast
			? roundMoney(Math.max(0, lineDiscountAmount - allocatedAmount))
			: roundMoney(proportionalAmount);
		allocatedAmount = roundMoney(allocatedAmount + nextAmount);

		return {
			ruleId: detail.ruleId,
			ruleName: detail.ruleName,
			discountType: detail.discountType,
			salesmanId: detail.salesmanId,
			configuredPercent: detail.discountPercent,
			allocatedPercent: nextPercent,
			discountAmount: nextAmount,
		};
	});
}
