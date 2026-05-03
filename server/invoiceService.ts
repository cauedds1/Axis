import { storage } from "./storage";

/**
 * Resolves the current payable invoice month for a card WITHOUT a DB query.
 * Mirrors the same split used by autoCloseInvoices and the UI:
 *   - today >= closingDay → current calendar month just closed (or is closing)
 *   - today <  closingDay → previous calendar month closed last cycle
 */
export function resolveCurrentPayableMonthKey(card: { closingDay: number }): string {
  const now = new Date();
  const today = now.getDate();
  if (today >= card.closingDay) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Resolves the invoice monthKey to use as a default for a general endpoint
 * that has access to the card object.  Uses `resolveCurrentPayableMonthKey`
 * which is consistent with autoCloseInvoices (no extra DB round-trip needed).
 */
export function resolveInvoiceMonthKey(card: { closingDay: number }): string {
  return resolveCurrentPayableMonthKey(card);
}

/**
 * Marks a credit card invoice as paid for the given targetMonthKey.
 *
 * Cycle window selection (matches both autoCloseInvoices and UI projection):
 *   - targetMonthKey <= current calendar month  →  day 1 of targetMonth → closingDay
 *     (same window used by autoCloseInvoices: no transactions are missed)
 *   - targetMonthKey >  current calendar month  →  prevMonth closingDay+1 → targetMonth closingDay
 *     (same window shown by projectedCardInvoices when pastClosing=true)
 *
 * If an existing closed invoice already has a positive stored total, that
 * total is used as-is and no transaction query is performed.
 */
export async function markCardInvoicePaid(
  userId: string,
  cardId: string,
  targetMonthKey: string,
): Promise<{ bill: NonNullable<Awaited<ReturnType<typeof storage.updateBill>>>; monthKey: string; total: number }> {
  const card = await storage.getCreditCard(cardId, userId);
  if (!card) throw new Error("Cartão não encontrado");

  const [targetYear, targetMonthNum] = targetMonthKey.split("-").map(Number);

  // --- Resolve total ---
  const existingInvoice = await storage.getInvoiceByMonth(cardId, targetMonthKey);
  let total: number;
  if (existingInvoice && Number(existingInvoice.total) > 0) {
    // Reuse the total that autoCloseInvoices (or a prior mark-paid) already computed.
    total = Number(existingInvoice.total);
  } else {
    const now = new Date();
    const currentMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let cycleStart: Date;
    let cycleEnd: Date;

    if (targetMonthKey <= currentMK) {
      // autoCloseInvoices convention (current / historical month):
      //   day 1 of the target calendar month → closingDay
      cycleStart = new Date(targetYear, targetMonthNum - 1, 1);
      cycleEnd = new Date(targetYear, targetMonthNum - 1, card.closingDay, 23, 59, 59);
    } else {
      // Projected pastClosing convention (future closing month):
      //   previous month closingDay+1 → target month closingDay
      cycleStart = new Date(targetYear, targetMonthNum - 2, card.closingDay + 1);
      cycleEnd = new Date(targetYear, targetMonthNum - 1, card.closingDay, 23, 59, 59);
    }

    const cardTx = await storage.getTransactions(userId, {
      creditCardId: cardId,
      startDate: cycleStart,
      endDate: cycleEnd,
    });
    total = cardTx.reduce((s, t) => s + Number(t.amount), 0);
  }

  // --- Find or create the permanent recurring bill for this card ---
  const allUserBills = await storage.getBills(userId);
  const cardMarker = `axiscard:${cardId}`;
  const existingBill = allUserBills.find(
    b =>
      b.notes?.includes(cardMarker) ||
      (Number(b.amount) > 0 && b.notes?.startsWith(`Fatura automática do cartão ${card.name}`)),
  );
  let bill;
  if (existingBill) {
    const paidArr: string[] = JSON.parse(existingBill.paidMonths || "[]");
    if (!paidArr.includes(targetMonthKey)) paidArr.push(targetMonthKey);
    const updateFields: Record<string, unknown> = { paidMonths: JSON.stringify(paidArr) };
    if (total > 0) updateFields.amount = total;
    // Normalise notes so the axiscard marker is always present (legacy bills may lack it)
    if (!existingBill.notes?.includes(cardMarker)) {
      updateFields.notes = `${existingBill.notes ?? ""}\n${cardMarker}`.trimStart();
    }
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

  // --- Update or create the invoice record ---
  const now = new Date();
  if (existingInvoice) {
    await storage.updateInvoice(existingInvoice.id, {
      status: "paid",
      total,
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
 * Reverses a previous mark-paid for a credit card invoice.
 * - Removes targetMonthKey from the bill's paidMonths array.
 * - Sets the invoice record status back to "open".
 */
export async function unmarkCardInvoicePaid(
  userId: string,
  cardId: string,
  targetMonthKey: string,
): Promise<{ bill: NonNullable<Awaited<ReturnType<typeof storage.updateBill>>>; monthKey: string }> {
  const card = await storage.getCreditCard(cardId, userId);
  if (!card) throw new Error("Cartão não encontrado");

  const allUserBills = await storage.getBills(userId);
  const cardMarker = `axiscard:${cardId}`;
  const existingBill = allUserBills.find(b => b.notes?.includes(cardMarker));
  if (!existingBill) throw new Error("Conta do cartão não encontrada");

  const paidArr: string[] = JSON.parse(existingBill.paidMonths || "[]");
  const updated = paidArr.filter(m => m !== targetMonthKey);
  const bill = await storage.updateBill(existingBill.id, userId, { paidMonths: JSON.stringify(updated) });

  const existingInvoice = await storage.getInvoiceByMonth(cardId, targetMonthKey);
  if (existingInvoice) {
    await storage.updateInvoice(existingInvoice.id, { status: "open" });
  }

  return { bill: bill!, monthKey: targetMonthKey };
}
