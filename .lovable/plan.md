

## מנוע אופטימיזציה אוטומטי — לחיצה על מניה מפעילה הכל

### הרעיון
המשתמש לוחץ על מניה בגריד → הסוכנים מריצים לבד את כל התהליך:
1. הורדת נתונים (market_data מה-DB)
2. חלוקה אוטומטית ל-train/test (70/30)
3. הרצת SmartOptimizer עם preset config (21 שלבים × 3 סבבים)
4. שמירת תוצאות ל-optimization_results
5. עדכון הגריד בזמן אמת

### מה קיים ומה חסר

**קיים ועובד:**
- `smartOptimizer.ts` — 368 שורות, 7 שלבים × 3 סבבים, מנגנון שלם
- `strategies.ts` — 5 אסטרטגיות (EMA Trend, Bollinger, Breakout, Inside Bar, ATR Squeeze)
- `indicators.ts` — RSI, EMA, ATR, ADX, Bollinger Bands
- `strategyEngine.ts` — מנוע סימולציה עם כל הלוגיקה
- `presetConfigs.ts` — NNE preset מוכן
- `types.ts` — כל הטיפוסים

**Stubs שצריך לממש:**
- `portfolioOptimizer.ts` — stub, צריך לממש backtest אמיתי עם `strategyEngine`
- `portfolioSimulator.ts` — stub, צריך לממש סימולטור פורטפוליו

**חסר לגמרי:**
- Click handler על מניה בגריד
- קומפוננטת Progress עם שלבי אופטימיזציה
- שמירת תוצאות ל-DB אחרי סיום

### שלבי מימוש

**שלב 1: מימוש portfolioSimulator.ts**
- לקחת candles מה-DB לפי סימול
- להריץ `evaluateAllSignals` + trade management loop
- להחזיר `BacktestResult` עם trades, return, drawdown, win rate

**שלב 2: מימוש portfolioOptimizer.ts**
- grid search על פרמטרים לפי config ranges
- הרצת portfolioSimulator לכל קומבינציה
- החזרת `MultiObjectiveResult` עם best params

**שלב 3: עדכון Backtest.tsx**
- לחיצה על מניה → פותח dialog של התקדמות
- טוען נתונים מ-`market_data` table לפי סימול
- מחלק אוטומטית ל-70% train / 30% test
- מריץ `runSmartOptimization` עם preset config
- Progress bar עם שם שלב נוכחי + אחוזים
- כפתור ביטול

**שלב 4: שמירת תוצאות**
- בסיום: insert ל-`optimization_results` עם כל המטריקות
- עדכון הגריד אוטומטית (React Query invalidation)

### קבצים שישתנו
| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/portfolioSimulator.ts` | מימוש מלא — backtest engine |
| `src/lib/optimizer/portfolioOptimizer.ts` | מימוש מלא — grid search |
| `src/pages/Backtest.tsx` | click handler + optimization dialog |
| `src/components/backtest/OptimizationProgress.tsx` | חדש — progress UI |

### הערות טכניות
- האופטימיזציה רצה בדפדפן (client-side) — מתאים למניה בודדת
- לסריקת 420 מניות צריך את שרת Railway
- נשתמש ב-`requestAnimationFrame` batching כדי לא לתקוע את ה-UI
- `AbortController` לביטול

