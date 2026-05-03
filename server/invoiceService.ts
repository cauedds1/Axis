import { storage } from "./storage";

/**
 * Marks a credit card invoice as paid for the given monthKey.
 * Uses the same billing-cycle date range as autoCloseInvoices:
 *   - startDate = 1st day of the target calendar month
 *   - endDate   = card.closingDay of the target calendar month (23:59:59)
 *
 * If an existing closed invoice already has a stored total, that total is
 * preserved instead of being recomputed (avoids overwriting with stale data).
 */
export async function markCardInvoicePaid(
  userId: string,
  cardId: string,
  targetMonthKey: string
): Promise<{ bill: Awaited<ReturnType<typeof storage.getBills>>[number]; monthKey: string; total: number }> {
  const card = await storage.getCreditCard(cardId, userId);
  if (!card) throw new Error("Cartão não encontrado");

  const [targetYear, targetMonthNum] = targetMonthKey.split("-").map(Number);

  // Resolve total: prefer already-stored invoice total; otherwise compute
  // from billing cycle window (day 1 → closingDay), matching autoCloseInvoices.
  const existingInvoice = await storage.getInvoiceByMonth(cardId, targetMonthKey);
  let total: number;
  if (existingInvoice && Number(existingInvoice.total) > 0) {
    total = Number(existingInvoice.total);
  } else {
    const cycleStart = new Date(targetYear, targetMonthNum - 1, 1);
    const cycleEnd = new Date(targetYear, targetMonthNum - 1, card.closingDay, 23, 59, 59);
    const cardTx = await storage.getTransactions(userId, {
      creditCardId: cardId,
      startDate: cycleStart,
      endDate: cycleEnd,
    });
    total = cardTx.reduce((s, t) => s + Number(t.amount), 0);
  }

  // Find or create the permanent recurring bill for this card
  const allUserBills = await storage.getBills(userId);
  const cardMarker = `axiscard:${cardId}`;
  const existingBill = allUserBills.find(b => b.notes?.includes(cardMarker));
  let bill;
  if (existingBill) {
    const paidArr: string[] = JSON.parse(existingBill.paidMonths || "[]");
    if (!paidArr.includes(targetMonthKey)) paidArr.push(targetMonthKey);
    const updateFields: Record<string, any> = { paidMonths: JSON.stringify(paidArr) };
    if (total > 0) updateFields.amount = total;
    bill = await storage.updateBill(existingBill.id, userId, updateFields);
  } else {
    bill = await storage.createBill({
      userId,
      title: `Fatura ${card.name}`,
      amount: total,
      type: "expense",
      dueDay: card.dueDay,
      categoryName: "Cartão de Crédito",
      recurrenceType: "permanent",
      active: true,
      paidMonths: JSON.stringify([targetMonthKey]),
      notes: `Fatura automática do cartão ${card.name} — ${targetMonthKey}\n${cardMarker}`,
    });
  }

  // Update or create the invoice record — preserve closedAt when already set
  const now = new Date();
  if (existingInvoice) {
    await storage.updateInvoice(existingInvoice.id, {
      status: "paid",
      billId: bill!.id,
      ...(existingInvoice.closedAt ? {} : { closedAt: now }),
    });
  } else {
    await storage.createInvoice({
      userId,
      creditCardId: cardId,
      monthKey: targetMonthKey,
      total,
      status: "paid",
      billId: bill!.id,
      closedAt: now,
    });
  }

  return { bill: bill!, monthKey: targetMonthKey, total };
}

/**
 * Resolves the best monthKey to use when none is provided:
 * returns the most recently closed invoice's monthKey, or the current
 * calendar month as fallback (consistent with autoCloseInvoices).
 */
export async function resolveInvoiceMonthKey(
  userId: string,
  cardId: string
): Promise<string> {
  const now = new Date();
  const calendarMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const allInvoices = await storage.getInvoices(userId, cardId);
  const latestClosed = allInvoices
    .filter(i => i.status === "closed" || i.status === "paid")
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
  return latestClosed?.monthKey ?? calendarMK;
}
