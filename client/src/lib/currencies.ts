export const SUPPORTED_CURRENCIES = [
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", locale: "de-CH" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", locale: "es-MX" },
  { code: "ARS", symbol: "$", name: "Argentine Peso", locale: "es-AR" },
  { code: "COP", symbol: "$", name: "Colombian Peso", locale: "es-CO" },
  { code: "CLP", symbol: "$", name: "Chilean Peso", locale: "es-CL" },
  { code: "PEN", symbol: "S/", name: "Peruvian Sol", locale: "es-PE" },
  { code: "UYU", symbol: "$", name: "Uruguayan Peso", locale: "es-UY" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", locale: "ar-AE" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

const LOCALE_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map(c => [c.code, c.locale])
);

const SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map(c => [c.code, c.symbol])
);

export function fmtMoney(value: number, currency: string = "BRL"): string {
  const safeCurrency = LOCALE_MAP[currency] ? currency : "BRL";
  const locale = LOCALE_MAP[safeCurrency];
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

export function getCurrencySymbol(currency: string): string {
  return SYMBOL_MAP[currency] || currency;
}

export function getCurrencyName(currency: string): string {
  return SUPPORTED_CURRENCIES.find(c => c.code === currency)?.name || currency;
}
