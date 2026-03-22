import { useQuery } from "@tanstack/react-query";
import { fmtMoney, getCurrencySymbol } from "@/lib/currencies";

export function useCurrency() {
  const { data } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const currency: string = data?.profile?.currency || "BRL";

  return {
    currency,
    symbol: getCurrencySymbol(currency),
    fmtMoney: (value: number) => fmtMoney(value, currency),
    isLoaded: !!data,
  };
}
