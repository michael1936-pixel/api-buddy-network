

## איך לזרז את השרת ב-Railway (בלי להוריד קומבינציות)

### הבעיה
השרת רץ על כל הקומבינציות סדרתית — כל combo = חישוב אינדיקטורים + סימולציה. עם 100K+ combos זה לוקח זמן.

### אופטימיזציות מומלצות (בצד השרת — Railway)

#### 1. Indicator Caching (אם עוד לא מיושם)
הקוד ב-Lovable כבר כולל `IndicatorCacheManager` — מחשב RSI/EMA/ATR פעם אחת ומשתמש שוב. **וודא שהשרת ב-Railway משתמש באותו מנגנון.** בלי זה, כל קומבינציה מחשבת אינדיקטורים מחדש — 600K חישובים מיותרים.

#### 2. Worker Threads (Parallelism)
Node.js רץ על thread אחד. הוסף `worker_threads`:
```text
Main Thread
  ├── Worker 1: Stage combos 0-25K
  ├── Worker 2: Stage combos 25K-50K
  ├── Worker 3: Stage combos 50K-75K
  └── Worker 4: Stage combos 75K-100K
```
כל worker מקבל את הנתונים + טווח קומבינציות ורץ במקביל. על 4 cores = x3-4 מהירות.

#### 3. Early Exit / Pruning
אם קומבינציה מסוימת כבר הפסידה 30% אחרי חצי מהתקופה — תעצור אותה מוקדם ותעבור לבאה. חוסך ~40% זמן.

#### 4. Typed Arrays במקום Objects
במקום `{ open, high, low, close, volume }` לכל נר — השתמש ב-`Float64Array` רציף. זה מאיץ את הלופים בגלל CPU cache locality.

#### 5. Combination Cache (כבר קיים בקוד)
`CombinationCache` — אם שתי קומבינציות מפיקות אותו hash, לא צריך לרוץ שוב. וודא שזה פעיל גם בשרת.

---

### מה לעדכן בשרת (Railway) — שמירת עסקאות

בסוף כל אופטימיזציה, אחרי שנמצאו הפרמטרים הכי טובים, הוסף:

```javascript
// אחרי שמצאת את bestResult עם העסקאות:
const trades = bestResult.trades; // מערך העסקאות מהסימולציה

const rows = trades.map(t => ({
  run_id: currentRunId,
  symbol: symbol,
  direction: t.direction,
  entry_date: t.entryDate,
  entry_price: t.entryPrice,
  exit_date: t.exitDate,
  exit_price: t.exitPrice,
  profit_pct: t.profitPct,
  strategy_name: t.strategyName,
  entry_reason: t.entryReason,
  exit_reason: t.exitReason,
}));

await supabase
  .from('optimization_trades')
  .insert(rows);
```

**חשוב:** בלי זה, פאנל העסקאות ב-Lovable יישאר ריק.

---

### סיכום סדר עדיפויות

| עדיפות | שינוי | שיפור צפוי |
|---------|--------|-------------|
| 1 | Indicator Cache (אם חסר) | x10-x50 |
| 2 | Worker Threads (4 cores) | x3-x4 |
| 3 | Early Exit pruning | x1.3-x1.5 |
| 4 | שמירת trades ל-DB | אפשר אימות |
| 5 | Typed Arrays | x1.2-x1.5 |

**הערה:** שינויים 1-5 הם בקוד השרת ב-Railway — לא ב-Lovable. אם תרצה, אני יכול לייצר לך קובץ עם הקוד המדויק לכל אחד מהם.

