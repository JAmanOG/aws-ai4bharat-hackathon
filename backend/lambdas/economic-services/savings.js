/**
 * Economic Services – harvest-based savings recommendations.
 * Req 8.3: Saving recommendations based on harvest patterns.
 */

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getHarvestMonths(payload) {
    return Array.isArray(payload.harvest_months) && payload.harvest_months.length
        ? payload.harvest_months
        : [];
}

function generateSavingsPlan(payload) {
    const expectedHarvestIncome = Number(payload.expected_harvest_income_inr || 0);
    const expenses = Array.isArray(payload.seasonal_expenses) ? payload.seasonal_expenses : [];
    const harvestMonths = getHarvestMonths(payload);
    const totalPlannedExpenses = expenses.reduce((sum, item) => sum + Number(item.amount_inr || 0), 0);
    const reserveTarget = Math.round(expectedHarvestIncome * 0.3);
    const emergencyBuffer = Math.round(expectedHarvestIncome * 0.1);

    const monthlyPlan = harvestMonths.map((month) => ({
        month,
        action: `Set aside about ₹${Math.round(reserveTarget / Math.max(harvestMonths.length, 1))} from ${month} harvest receipts.`,
    }));

    const upcomingExpenseAdvice = expenses
        .slice()
        .sort((a, b) => (a.due_month || '').localeCompare(b.due_month || ''))
        .map((item) => ({
            category: item.category || 'farm expense',
            due_month: item.due_month || 'upcoming',
            recommended_reserve_inr: Math.round(Number(item.amount_inr || 0)),
        }));

    return {
        expected_harvest_income_inr: expectedHarvestIncome,
        total_planned_expenses_inr: totalPlannedExpenses,
        reserve_target_inr: reserveTarget,
        emergency_buffer_inr: emergencyBuffer,
        savings_ratio: expectedHarvestIncome > 0 ? Number((reserveTarget / expectedHarvestIncome).toFixed(2)) : 0,
        monthly_plan: monthlyPlan,
        upcoming_expense_advice: upcomingExpenseAdvice,
        narrative: expectedHarvestIncome > 0
            ? `Treat ${Math.round((reserveTarget / expectedHarvestIncome) * 100)}% of harvest income as next-season capital, not free cash.`
            : 'Add expected harvest income to receive a clearer savings recommendation.',
        financial_story: harvestMonths.length
            ? `Your income comes in lumps around ${harvestMonths.join(', ')}. Protect the next crop cycle by reserving seed and input money first.`
            : 'Add likely harvest months so the system can spread savings across the crop cycle.',
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    MONTH_NAMES,
    generateSavingsPlan,
};
