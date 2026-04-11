

## תיקון מהירות + התאמת תצוגה מהפרויקט השני

### בעיה 1: מהירות 0.4 קומב׳/שניה (במקום 300)

**שורש הבעיה**: ב-`portfolioOptimizer.ts` יש yield ל-UI כל 16ms עם `setTimeout(0)`. בפועל `setTimeout(0)` לוקח ~4ms מינימום בדפדפן, וכשכל קומבינציה מעבדת 12,374 bars עם חישובי אינדיקטורים — ה-yield קורה כמעט אחרי כל קומבינציה, מה שהורג את הביצועים.

**תיקון**: לעבור ל-yield כל 20 קומבינציות עם `requestAnimationFrame` — בדיוק כמו בפרויקט השני:
```typescript
// במקום yield כל 16ms:
if (processedCount % 20 === 0) {
  await new Promise(resolve => {
    requestAnimationFrame(() => resolve(undefined));
  });
  // update progress here
}
```
זה יתן שיפור של x50-x100 במהירות.

### בעיה 2: התצוגה לא זהה

ההבדלים בין הקומפוננטה הנוכחית לפרויקט השני:
- חסר `preRunMode` (מצב לפני הרצה)
- חסר `onRoundToggle` (toggle כל סיבוב)  
- חסר תצוגת "שלב נוכחי" (Train/Test results) ו-"הטוב ביותר כללי" עם Zap icon
- חסר Legend בתחתית (Train/Test/הושלם/הושבת)

**תיקון**: העתקה ישירה של הקומפוננטה מהפרויקט השני (`SmartOptimizationProgress.tsx` — 674 שורות) עם התאמות import בלבד.

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/portfolioOptimizer.ts` | yield כל 20 קומבינציות עם `requestAnimationFrame` במקום כל 16ms עם `setTimeout` |
| `src/components/backtest/OptimizationProgress.tsx` | העתקה מהפרויקט השני עם התאמת imports |

### תוצאה צפויה
- מהירות ~200-400 קומב׳/שניה (כמו בפרויקט השני)
- תצוגה זהה לפרויקט השני

