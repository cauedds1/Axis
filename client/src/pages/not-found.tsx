import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-6">{t("axisNotFound.description")}</p>
        <Link href="/">
          <Button variant="outline" data-testid="button-go-home">{t("axisNotFound.goHome")}</Button>
        </Link>
      </div>
    </div>
  );
}
