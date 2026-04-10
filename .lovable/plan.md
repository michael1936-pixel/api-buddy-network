

# המשך העתקת מנוע האופטימיזציה — שלב 2

## מצב נוכחי
5 מתוך 19 קבצי ליבה הועתקו, רובם stubs ריקים. צריך להעתיק את הקוד האמיתי.

## שלב 2א: העתקת קבצי הליבה (הקוד האמיתי)
העתקה ישירה מהפרויקט השני באמצעות `cross_project` tools:

1. **indicators.ts** — RSI, EMA, ATR, BB, ADX (~429 שורות)
2. **simulatorV2.ts** — מנוע סימולציה (~2,171 שורות)
3. **strategies.ts** — לוגיקת 5 אסטרטגיות
4. **strategyEngine.ts** — מנוע אסטרטגיות
5. **smartOptimizer.ts** — אופטימיזציה רב-שלבית (~496 שורות)
6. **portfolioOptimizer.ts** — אופטימיזציית פורטפוליו
7. **portfolioSimulator.ts** — החלפת ה-stub בקוד אמיתי
8. **multiObjectiveMetrics.ts** — מטריקות מתקדמות
9. **presetConfigs.ts** — הגדרות ברירת מחדל
10. **stageUtils.ts** — עזרים לשלבים
11. **csvParser.ts** — פרסור נתונים
12. **utils.ts** — פונקציות עזר
13. **types.ts** — החלפה בגרסה המלאה מהפרויקט השני
14. **strategyCombinationOptimizer.ts** — אופטימיזציה משולבת

## שלב 2ב: Worker + Hook
- העתקת `optimizer.worker.ts` → `src/workers/optimizer.worker.ts`
- העתקת hook ל-`src/hooks/useOptimizationWorker.ts`

## שלב 2ג: תיקון imports
- עדכון כל ה-imports מ-`@/lib/` ל-`@/lib/optimizer/` או `./`
- וידוא שאין תלויות שבורות

## הערה
זה שלב גדול (~6,000+ שורות קוד). אעשה את זה בכמה צעדים — קודם indicators + simulator + strategies, אח"כ optimizer + portfolio, ולבסוף worker + hook.

קומפוננטות UI ודף Backtest — בשלב הבא.

