import { storage } from "./storage";

export const DISCIPLINE_POINTS = {
  TASK_HIGH:           6,
  TASK_MEDIUM:         4,
  TASK_LOW:            3,
  HABIT_CHECK:         2,
  HABIT_MISSED:       -3,
  TASK_OVERDUE:       -4,
  SPENDING_OTIMO:     +4,
  SPENDING_BOM:       +2,
  SPENDING_LEVE:      -2,
  SPENDING_MODERADO:  -4,
  SPENDING_GRAVE:     -6,
  BILL_PAID_LATE:     -2,
} as const;

export const DISCIPLINE_THRESHOLD = 8;

export async function getUserLang(userId: string): Promise<"en" | "pt"> {
  try {
    const profile = await storage.getUserProfile(userId);
    return ((profile as any)?.language ?? "pt") as "en" | "pt";
  } catch {
    return "pt";
  }
}

export async function adjustDisciplinePoints(userId: string, delta: number, reason: string): Promise<void> {
  try {
    const profile = await storage.getUserProfile(userId);
    const prevScore  = profile?.disciplineScore  ?? 5;
    const prevPoints = profile?.disciplinePoints ?? 0;
    const lang = ((profile as any)?.language ?? "pt") as "en" | "pt";

    let newPoints = prevPoints + delta;
    let newScore  = prevScore;

    while (newPoints >= DISCIPLINE_THRESHOLD) {
      newScore = Math.min(10, newScore + 1);
      newPoints -= DISCIPLINE_THRESHOLD;
    }
    while (newPoints <= -DISCIPLINE_THRESHOLD) {
      newScore = Math.max(1, newScore - 1);
      newPoints += DISCIPLINE_THRESHOLD;
    }

    await storage.upsertUserProfile(userId, { disciplineScore: newScore, disciplinePoints: newPoints });

    if (newScore !== prevScore) {
      const levelMsg = lang === "en"
        ? `Discipline ${prevScore} → ${newScore} (${delta > 0 ? "+" : ""}${delta} accumulated pts)`
        : `Disciplina ${prevScore} → ${newScore} (${delta > 0 ? "+" : ""}${delta} pts acumulados)`;
      await storage.createDisciplineHistory({
        userId,
        score: newScore,
        previousScore: prevScore,
        delta: newScore - prevScore,
        reasons: JSON.stringify([reason, levelMsg]),
      });
    }
  } catch {
    // silently fail
  }
}
