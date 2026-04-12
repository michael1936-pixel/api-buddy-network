

# ייצוא כל קבצי האופטימיזר לקובץ אחד

## מצב נוכחי
הקוד ב-Lovable **כבר מכיל** את התיקון (שורות 488-501 ב-`smartOptimizer.ts`). אבל שרת Railway רץ מריפו GitHub נפרד עם גרסה ישנה.

## מה אעשה
אייצא את כל 16 הקבצים מתיקיית `src/lib/optimizer/` לקובץ ZIP אחד ב-`/mnt/documents/` שתוכל להוריד ולהעתיק לריפו של Railway.

## קבצים שייכללו
| קובץ | תיאור |
|-------|--------|
| `smartOptimizer.ts` | **הקובץ העיקרי** — כולל את תיקון ה-5000 combo guard |
| `portfolioOptimizer.ts` | מנוע האופטימיזציה |
| `portfolioSimulator.ts` | סימולטור |
| `strategies.ts` | אסטרטגיות |
| `indicators.ts` | אינדיקטורים |
| `types.ts` | טיפוסים |
| `presetConfigs.ts` | הגדרות preset |
| `indicatorCache.ts` | קאש אינדיקטורים |
| `multiObjectiveMetrics.ts` | מטריקות |
| `parameterValidation.ts` | ולידציה |
| `memoryAwareOptimizer.ts` | אופטימיזציה עם ניהול זיכרון |
| `csvParser.ts` | פרסר CSV |
| `debugConfig.ts` | הגדרות דיבוג |
| `s2GroundTruth.ts` | Ground truth |
| `testThresholdAgent.ts` | סוכן סף |
| `trainTestSplitAgent.ts` | סוכן חלוקה |

## איך להשתמש
1. הורד את ה-ZIP
2. פתח את ריפו Railway שלך
3. החלף את תיקיית `src/lib/optimizer/` (או המקבילה בשרת) בקבצים מה-ZIP
4. Push ל-GitHub → Railway יעשה deploy אוטומטי
5. הרץ אופטימיזציה ובדוק שסיבוב 2 לא מראה מיליונים

## פרט טכני חשוב
התיקון הקריטי נמצא ב-`smartOptimizer.ts` שורות 488-501:
```typescript
if (estimatedCombos > 5000) {
  console.log(`⚠ Zone config too large (${estimatedCombos} combos), falling back to fine-tune`);
  stageCfg = createFineTuneConfig(baseConfig, bestParams, stage.parametersToOptimize, 2);
}
```

