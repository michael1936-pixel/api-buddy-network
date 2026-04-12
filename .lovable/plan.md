

# תיקון OOM (Out of Memory) בשרת Railway

## הבעיה
הלוגים מראים בבירור: **`FATAL ERROR: JavaScript heap out of memory`** — הזיכרון הגיע ל-3.5GB וקרס. ה-combo guard עובד (2,187 קומבינציות, לא מיליארדים), אבל **הזיכרון מצטבר בין שלבים** עד שהשרת קורס.

## למה הזיכרון דולף — 4 מקורות עיקריים

1. **`PortfolioOptimizationResult`** — כל תוצאה שמורה עם `trainResults` ו-`testResults` שכוללים **מערכי trades מלאים לכל סימבול** (~420 סימבולים × עשרות trades = אלפי אובייקטים). `multiResult` שומר 3 כאלה (profit/consistency/drawdown), ו-`globalResult` ב-smartOptimizer שומר עוד 3.

2. **`round1Zones`** — 200 תוצאות × 7 שלבים = 1,400 אובייקטים עם parameters מלאים, נשמרים לכל אורך Round 2.

3. **`combinationCache`** — הניקוי כל 200 combos מוחק רק entries משלבים קודמים, אבל בשלב הנוכחי ה-cache גדל ללא הגבלה.

4. **`indicatorCache`** — נמחק כל 200 combos אבל מיד נבנה מחדש — מערכי Float64 גדולים.

## הפתרון — 4 שינויים

### 1. Strip trades מתוצאות שמורות (`portfolioOptimizer.ts`)
ב-`updateMultiObjectiveResult`, לפני שמירה — להסיר את מערכי ה-trades מ-trainResults/testResults. לשמור רק summary (totalReturn, wins, losses, maxDrawdown):

```typescript
function stripHeavyData(result: PortfolioOptimizationResult): PortfolioOptimizationResult {
  return {
    ...result,
    trainResults: result.trainResults.map(r => ({
      ...r,
      result: { ...r.result, trades: [] }  // strip trades array
    })),
    testResults: result.testResults.map(r => ({
      ...r, 
      result: { ...r.result, trades: [] }
    })),
  };
}
```
להפעיל את זה על כל `portfolioResult` לפני `updateMultiObjectiveResult`.

### 2. מחיקת round1Zones אחרי שימוש (`smartOptimizer.ts`)
אחרי שכל שלב Round 2 משתמש ב-zones שלו, למחוק:
```typescript
if (stage.round1StageIndex !== undefined) {
  delete round1Zones[stage.round1StageIndex];
}
```
בסוף Round 1 (לפני תחילת Round 2), לקצץ round1Zones ל-50 תוצאות במקום 200.

### 3. הגבלת combinationCache גם בשלב הנוכחי (`portfolioOptimizer.ts`)
לשנות את הניקוי כך שיגביל גם את ה-cache הנוכחי:
```typescript
if (combinationCache.size > 300) {
  // Remove non-protected entries (oldest first), even from current stage
  // Keep max 200 entries
}
```

### 4. הגדלת זיכרון ב-Railway + הפעלת GC (הוראות לשרת)
ב-Railway, להוסיף environment variable:
```
NODE_OPTIONS=--max-old-space-size=4096 --expose-gc
```

## קבצים שישתנו
- `src/lib/optimizer/portfolioOptimizer.ts` — strip trades, aggressive cache pruning
- `src/lib/optimizer/smartOptimizer.ts` — round1Zones cleanup, between-stage memory release

## ייצור ZIP
אחרי השינויים, אייצר ZIP מעודכן עם אותן הוראות deploy.

