import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" /> {t("axisPrivacy.backButton")}
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-6">{t("axisPrivacy.title")}</h1>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground">
        <p>{t("axisPrivacy.intro")}</p>
        <h2 className="text-foreground text-lg font-semibold">{t("axisPrivacy.dataCollectedTitle")}</h2>
        <p>{t("axisPrivacy.dataCollectedText")}</p>
        <h2 className="text-foreground text-lg font-semibold">{t("axisPrivacy.dataUseTitle")}</h2>
        <p>{t("axisPrivacy.dataUseText")}</p>
        <h2 className="text-foreground text-lg font-semibold">{t("axisPrivacy.securityTitle")}</h2>
        <p>{t("axisPrivacy.securityText")}</p>
        <h2 className="text-foreground text-lg font-semibold">{t("axisPrivacy.deletionTitle")}</h2>
        <p>{t("axisPrivacy.deletionText")}</p>
      </div>
    </div>
  );
}
