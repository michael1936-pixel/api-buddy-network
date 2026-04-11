

## תיקון הקפאת הדף — העברת האופטימיזציה ל-Web Worker

### שורש הבעיה
האופטימיזציה רצה על ה-**main thread** של הדפדפן. כל backtest מחשב אינדיקטורים (RSI, EMA, ATR, ADX, BB) על 12,000+ bars — חישוב כבד שלוקח ~50ms+ לקומבינציה. גם עם yield כל 20 קומבינציות, ה-main thread נחסם לכ-1 שנייה בין yields, מה שגורם לדף להיתקע לגמרי.

**בפרויקט השני** (`Real-Time Trading Insights`) זה פתור — שם יש **Web Worker** (`src/workers/optimizer.worker.ts`) שמריץ את כל החישוב ב-thread נפרד. ה-UI חופשי לגמרי.

### מה ייבנה

**1. Web Worker לאופטימיזציה**
- קובץ חדש `src/workers/optimizer.worker.ts`
- מקבל `init` עם candles + config + fixedParams
- מקבל `process` ומריץ את כל הקומבינציות ב-thread נפרד
- שולח `progress` updates כל ~50 קומבינציות
- שולח `results_batch` עם תוצאות
- שולח `complete` בסיום
- lazy generator לקומבינציות (ללא memory spike)

**2. עדכון portfolioOptimizer.ts**
- פונקציה חדשה `optimizeWithWorker()` שמתקשרת עם ה-Worker
- ה-Worker מייצר קומבינציות ומריץ backtests בעצמו
- ה-main thread רק מקבל progress ו-results דרך `postMessage`

**3. העתקת התצוגה מהפרויקט השני (1:1)**
- קובץ `OptimizationProgress.tsx` — העתקה ישירה של 674 השורות מ-`SmartOptimizationProgress.tsx` של הפרויקט השני
- כולל: 3 סיבובים צבעוניים, checkboxes, Legend, current/best results עם Zap, progress bars כפולים, מהירות ו-ETA

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/workers/optimizer.worker.ts` | **חדש** — Worker שמריץ backtests מחוץ ל-main thread |
| `src/lib/optimizer/portfolioOptimizer.ts` | הוספת `optimizeWithWorker()` שמתקשר עם ה-Worker |
| `src/components/backtest/OptimizationProgress.tsx` | **שכתוב** — העתקה 1:1 מהפרויקט השני |
| `src/pages/Backtest.tsx` | שימוש ב-Worker במקום חישוב ישיר על main thread |

### תוצאה צפויה
- הדף **לא ייתקע** — כל החישוב רץ ב-thread נפרד
- מהירות ~300 קומב׳/שניה (כמו בפרויקט השני)
- תצוגה זהה 1:1 לפרויקט השני

