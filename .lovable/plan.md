

## 3 תיקונים — תוצאות בזמן אמת, תור מניות, קומבינציות לכל שלב

### 1. תוצאה הכי טובה בזמן אמת (Train + Test)

**הבעיה:** `smartProgress` כבר מכיל `bestReturn` ו-`bestTestReturn` מה-callback של `optimizePortfolio`, אבל ה-UI לא מציג אותם בזמן הריצה — רק אחרי שהשלב נגמר (ב-`stageResults`).

**הפתרון:**
- הוספת `bestTrainReturn` ו-`bestTestReturn` ל-state ב-`optimizationStore.ts` — מתעדכנים בכל progress callback
- הוספת תיבה חדשה "תוצאה טובה ביותר" ב-`OptimizationProgress.tsx` שמציגה בזמן אמת Train/Test עם צבעים (ירוק/אדום)

### 2. תור מניות — בחירת כמה מניות ברצף

**הבעיה:** `SymbolSearch` שולח `onSelect(symbol)` עם מניה בודדת, ו-`runOptimization` לא מקבל תור.

**הפתרון:**
- הוספת `symbolQueue: string[]` ו-`queueIndex: number` ל-store
- פונקציה חדשה `runOptimizationQueue(symbols, queryClient)` שרצה כל מניה ברצף
- בסיום מניה אחת → עוברת לבאה (עם toast קצר)
- ב-`SymbolSearch` — תמיכה בבחירה מרובה (multi-select) עם כפתור "הרץ X מניות"
- הצגת תור מניות ב-UI עם סטטוס לכל אחת

### 3. מספר קומבינציות לכל שלב לפני ריצה

**הבעיה:** `smartOptimizer` מחשב את מספר הקומבינציות רק תוך כדי ריצה. ה-UI מקבל את ה-`total` מה-progress callback, אבל לפני שהשלב מתחיל — אין מידע.

**הפתרון:**
- הוספת פונקציה `estimateStageCombinations(stageIndex, baseConfig, bestParams)` ב-`smartOptimizer.ts` שמחשבת כמה קומבינציות צפויות לכל שלב
- הוספת `stageEstimates: Record<number, number>` ל-store — מחושב פעם אחת בתחילת ריצה
- ב-`StageRow` — אם השלב עוד לא התחיל, מציג "~X,XXX קומבינציות" (כבר יש prop `combinationsEstimate`)

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/stores/optimizationStore.ts` | הוספת `bestTrainReturn`, `bestTestReturn`, `symbolQueue`, `queueIndex`, `stageEstimates`, `runOptimizationQueue()` |
| `src/components/backtest/OptimizationProgress.tsx` | תיבת "Best" בזמן אמת, הצגת estimates לשלבים ממתינים |
| `src/components/backtest/SymbolSearch.tsx` | מצב multi-select: בחירת כמה מניות → כפתור "הרץ" |
| `src/lib/optimizer/smartOptimizer.ts` | export `estimateStageCombinations()` |
| `src/pages/Backtest.tsx` | הצגת תור מניות, העברת estimates ל-progress card |

### זרימת תור מניות
```text
User selects: AAPL, TSLA, NVDA → clicks "הרץ 3 מניות"
  → store.symbolQueue = ['AAPL', 'TSLA', 'NVDA']
  → runOptimization('AAPL') 
  → on complete → runOptimization('TSLA')
  → on complete → runOptimization('NVDA')
  → done
UI shows: [✅ AAPL] [🔄 TSLA] [⬜ NVDA]
```

