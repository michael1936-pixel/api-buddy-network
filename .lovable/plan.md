

# תיקון: זירוז אופטימיזציה — הפחתת תדירות דיווח + שמירת best גלובלי

## הבעיה
ב-`portfolioOptimizer.ts` שורה 231, דיווח progress מתרחש **כל 10 איטרציות** עם `await setTimeout(0)`. עבור 668K קומבינציות זה **66,800 yields** לא הכרחיים — כל yield עולה ~1-4ms, סה"כ **67-267 שניות אבודות** רק על דיווח.

## התיקון

### 1. `src/lib/optimizer/portfolioOptimizer.ts` — שורה 231
שינוי תדירות דיווח מ-`% 10` ל-`% 500`:
```typescript
if (current % 500 === 0 || current === totalCombos) {
```
זה מוריד מ-66,800 yields ל-~1,336 — שיפור של **x50** בתקורת דיווח.

### 2. `src/lib/optimizer/smartOptimizer.ts` — שורה 672
הוספת `globalBestReturn` ל-progress callback כדי שה-UI יציג תמיד את הערך הכי טוב מכל השלבים (ולא רק מהשלב הנוכחי):
```typescript
(info) => onProgress?.({
  ...info,
  globalBestReturn: Math.max(globalBestTrain, info.bestReturn || 0),
  globalBestTestReturn: Math.max(globalBestTest, info.bestTestReturn || 0),
  ...
})
```

### 3. `src/lib/optimizer/smartOptimizer.ts` — stepMultiplier default
שינוי ברירת מחדל מ-4 ל-6 ב-Round 1, שמוריד Long/Short מ-37K ל-~8K קומבינציות.

## תוצאה צפויה
- **מהירות**: x2-3 שיפור (פחות yields + פחות קומבינציות)
- **UI**: best return לא "נעלם" בין שלבים

