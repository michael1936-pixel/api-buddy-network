

# צירוף מנוע האופטימיזציה מהפרויקט השני

## מצב נוכחי
הפרויקט **Real-Time Trading Insights** מכיל מנוע אופטימיזציה מלא עם:
- **סימולטור** (`simulatorV2.ts`) — 2,171 שורות, 5 אסטרטגיות מסחר
- **אינדיקטורים** (`indicators.ts`) — 429 שורות (RSI, EMA, ATR, BB, ADX)
- **אופטימייזר חכם** (`smartOptimizer.ts`) — 496 שורות, רב-שלבי עם 3 סבבים
- **Web Worker** — מריץ backtests במקביל ללא חסימת UI
- **טיפוסים** (`types.ts`) — 639 שורות, Candle, Trade, BacktestResult, ParameterRange
- עוד ~15 קבצי lib ו-17 קומפוננטות UI

## הגישה — העתקה + התאמה

### שלב 1: העתקת קבצי הליבה (lib)
העתקת כל קבצי ה-lib מהפרויקט השני לתיקייה `src/lib/optimizer/`:

| קובץ | תיאור | שורות |
|-------|--------|-------|
| `simulatorV2.ts` | מנוע הסימולציה | ~2,171 |
| `indicators.ts` | חישוב אינדיקטורים | ~429 |
| `smartOptimizer.ts` | אופטימיזציה רב-שלבית | ~496 |
| `strategies.ts` | לוגיקת אסטרטגיות | ? |
| `strategyEngine.ts` | מנוע אסטרטגיות | ? |
| `portfolioOptimizer.ts` | אופטימיזציית פורטפוליו | ? |
| `portfolioSimulator.ts` | סימולציית פורטפוליו | ? |
| `multiObjectiveMetrics.ts` | מטריקות | ? |
| `debugConfig.ts` | קונפיגורציית דיבאג | ? |
| `presetConfigs.ts` | הגדרות ברירת מחדל | ? |
| `stageUtils.ts` | עזרים לשלבים | ? |
| `csvParser.ts` | פרסור CSV | ? |
| `memoryAwareOptimizer.ts` | אופטימייזר עם זיכרון | ? |
| `utils.ts` | פונקציות עזר | ? |

### שלב 2: העתקת types + worker
- `types.ts` → `src/lib/optimizer/types.ts`
- `optimizer.worker.ts` → `src/workers/optimizer.worker.ts`
- `useOptimizationWorker.ts` → `src/hooks/useOptimizationWorker.ts`

### שלב 3: העתקת קומפוננטות UI
כל 17 הקומפוננטות מ-`src/components/optimizer/` לתיקייה מקבילה בפרויקט הנוכחי.

### שלב 4: עדכון דף Backtest
- שדרוג `src/pages/Backtest.tsx` לכלול את ה-UI המלא של האופטימייזר
- חיבור לנתונים מ-DB (market_data, tracked_symbols, optimization_results)
- שמירת תוצאות אופטימיזציה ל-DB אוטומטית

### שלב 5: אינטגרציה עם סוכנים
- Edge function `run-optimization` שמפעילה אופטימיזציה אוטומטית
- הסוכן הייעודי (Optimizer Agent) יוכל להפעיל אופטימיזציה ולשמור תוצאות

### שלב 6: תיקון imports
- עדכון כל ה-imports הפנימיים בקבצים המועתקים
- התאמה למבנה התיקיות של הפרויקט הנוכחי

## סיכום היקף
- ~20 קבצי lib + 17 קומפוננטות + 1 worker + 1 hook + types
- עדכון דף Backtest
- Edge function חדש לאוטומציה

## הערה חשובה
זוהי העתקה של כ-40 קבצים עם אלפי שורות קוד. מומלץ לעשות זאת בשלבים — קודם את קבצי הליבה (lib + types), אחר כך ה-UI, ולבסוף האינטגרציה עם הסוכנים.

