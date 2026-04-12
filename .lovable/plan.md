
## תיקון: הצגת 24.41B קומבינציות בממשק

### הבעיה
הפונקציה `estimateAllStageCombinations` (שורה 728 ב-`smartOptimizer.ts`) מחשבת את מספר הקומבינציות **בלי** להחיל את ה-combo guard של 300K. לשלבי `isFinalTuning` עם 15 פרמטרים ו-`tuneRange=2`, זה נותן `5^15 = 30.5B` — מה שמסביר את ה-24.41B שמוצג.

בנוסף, ה-`total_combos` שנכתב ל-DB ע"י שרת Railway גם לא מוגבל — אבל זה תלוי בשרת.

### הפתרון

**קובץ: `src/lib/optimizer/smartOptimizer.ts`**

בפונקציה `estimateAllStageCombinations` (שורה 728-778), להוסיף cap של 300K לכל שלב:

```typescript
estimates[i + 1] = Math.min(300_000, Math.max(1, count));
```

שורה 775 — שינוי בודד. זה יגרום ל-UI להציג מספרים ריאליים (אחרי ה-guard) במקום המספרים התיאורטיים.

**קובץ: `src/stores/optimizationStore.ts`**

אם ה-`total_combos` מגיע מהשרת עם ערך מנופח, להוסיף cap גם ב-UI:
```typescript
const totalCombos = Math.min(run.total_combos || 0, enabledStagesCount * 300_000);
```

### מה צריך לתקן גם ב-Railway
השרת צריך לעדכן `total_combos` **אחרי** שה-combo guard חותך — לא לפני. זה שינוי בקוד השרת, לא כאן.

### קבצים לעדכון
1. `src/lib/optimizer/smartOptimizer.ts` — שורה 775 (cap estimate)
2. `src/stores/optimizationStore.ts` — שורות 307, 437 (cap total from server)
