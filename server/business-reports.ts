import ExcelJS from "exceljs";
import type { BusinessExpense } from "@shared/schema";

type EnrichedExpense = BusinessExpense & { userEmail?: string; userName?: string };

function formatBRL(amount: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_review: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
  };
  return labels[status] ?? status;
}

export async function generateExpenseExcel(
  expenses: EnrichedExpense[],
  orgName: string,
  period?: { start?: string; end?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AXIS Business";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Despesas", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  const BLUE = "FF1E3A5F";
  const BLUE_LIGHT = "FFD6E4F7";
  const GREEN = "FF1A7F4B";
  const RED_SOFT = "FFFFE0E0";
  const GREEN_SOFT = "FFE0F5EC";
  const YELLOW_SOFT = "FFFFF3CD";
  const BORDER_COLOR = "FFD0D7E4";

  const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BORDER_COLOR } };
  const cellBorder = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

  sheet.mergeCells("A1:H1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `${orgName} — Relatório de Despesas`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 36;

  sheet.mergeCells("A2:H2");
  const subtitleCell = sheet.getCell("A2");
  const periodText = period?.start && period?.end
    ? `Período: ${period.start} a ${period.end}`
    : `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
  subtitleCell.value = periodText;
  subtitleCell.font = { size: 10, color: { argb: "FF555555" }, italic: true };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_LIGHT } };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 20;

  sheet.addRow([]);

  const headers = ["Data", "Colaborador", "Estabelecimento", "Categoria", "Método", "Valor", "Status", "Observações"];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = cellBorder;
  });

  sheet.columns = [
    { key: "date", width: 14 },
    { key: "user", width: 22 },
    { key: "establishment", width: 26 },
    { key: "category", width: 20 },
    { key: "method", width: 18 },
    { key: "amount", width: 16 },
    { key: "status", width: 16 },
    { key: "notes", width: 30 },
  ];

  let lastDate = "";
  let rowIndex = 5;

  for (const expense of expenses) {
    const dateStr = formatDate(expense.date);

    if (dateStr !== lastDate) {
      const dayRow = sheet.addRow([`  ${dateStr}`, "", "", "", "", "", "", ""]);
      sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
      dayRow.getCell(1).value = `  ${dateStr}`;
      dayRow.getCell(1).font = { bold: true, size: 10, color: { argb: "FF1E3A5F" } };
      dayRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_LIGHT } };
      dayRow.getCell(1).border = cellBorder;
      dayRow.height = 20;
      lastDate = dateStr;
      rowIndex++;
    }

    const dataRow = sheet.addRow([
      dateStr,
      expense.userName || expense.userEmail || "—",
      expense.establishment || expense.description,
      expense.categoryName || "—",
      expense.paymentMethod || "—",
      expense.amount,
      statusLabel(expense.status ?? "pending_review"),
      expense.notes || "",
    ]);
    dataRow.height = 22;

    const statusFill: Record<string, string> = {
      approved: GREEN_SOFT,
      rejected: RED_SOFT,
      pending_review: YELLOW_SOFT,
    };
    const bg = statusFill[expense.status ?? "pending_review"] ?? "FFFFFFFF";

    dataRow.eachCell((cell, colNumber) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = cellBorder;
      cell.alignment = { vertical: "middle", wrapText: colNumber === 8 };
      if (colNumber === 6) {
        cell.numFmt = '"R$"#,##0.00';
        cell.font = { bold: true };
      }
      if (colNumber === 7) {
        const statusColors: Record<string, string> = {
          approved: GREEN,
          rejected: "FFCC0000",
          pending_review: "FF996600",
        };
        cell.font = { bold: true, color: { argb: statusColors[expense.status ?? "pending_review"] ?? "FF333333" } };
      }
    });
    rowIndex++;
  }

  sheet.addRow([]);
  rowIndex++;

  const total = expenses.filter(e => e.status !== "rejected").reduce((sum, e) => sum + e.amount, 0);
  const totalRow = sheet.addRow(["", "", "", "", "TOTAL APROVADO", total, "", ""]);
  totalRow.height = 26;
  totalRow.getCell(5).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  totalRow.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  totalRow.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(5).border = cellBorder;
  totalRow.getCell(6).numFmt = '"R$"#,##0.00';
  totalRow.getCell(6).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  totalRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  totalRow.getCell(6).border = cellBorder;
  totalRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
