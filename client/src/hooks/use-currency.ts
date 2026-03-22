import { useQuery } from "@tanstack/react-query";
import { fmtMoney, getCurrencySymbol } from "@/lib/currencies";

interface ProfileApiResponse {
  profile: {
    currency?: string | null;
    [key: string]: unknown;
  };
  user: {
    [key: string]: unknown;
  };
}

export function useCurrency() {
  const { data } = useQuery<ProfileApiResponse>({ queryKey: ["/api/user/profile"] });
  const currency: string = data?.profile?.currency || "BRL";

  return {
    currency,
    symbol: getCurrencySymbol(currency),
    fmtMoney: (value: number) => fmtMoney(value, currency),
    isLoaded: !!data,
  };
}
