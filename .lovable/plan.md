

## תיקון מהירות — 3 באגים קריטיים שהורגים ביצועים

### באג 1: `candles.map()` בכל קריאה לאסטרטגיות 3 ו-5 (הכי חמור)
ב-`strategies.ts`, אסטרטגיות 3 ו-5 מריצות:
```javascript
const highs = candles.map(c => c.high);  // מערך חדש של 6,000 אלמנטים
const lows  = candles.map(c => c.low);   // מערך חדש של 6,000 אלמנטים
```
**בכל קריאה, בכל bar, בכל קומבינציה**. עם 6,000 bars × 3,000 קומבינציות = **36 מיליון הקצאות מערכים** — כל אחד 6,000 אלמנטים. זה GC hell.

**תיקון**: `highs[]` ו-`lows[]` כבר חושבו ב-`buildIndicators`. נוסיף אותם ל-`StrategyIndicators` ונשתמש בהם ישירות.

### באג 2: `evaluateAllSignals` מחזיר אובייקט ענק בכל bar
הפונקציה בונה אובייקט `EngineResult` עם `layer3` (12 שדות) + `s2Layers` בכל bar — ~6,000 אובייקטים לקומבינציה × 3,000 = 18M אובייקטים. רובם לא בשימוש.

**תיקון**: להחזיר רק `buyFinal`, `sellFinal`, `entryStrategyId` מהלולאה החמה. `layer3` ו-debug רק כשצריך.

### באג 3: `calculateMonthlyPerformance` ו-`trades` array בכל קומבינציה
כל קומבינציה שומרת את כל ה-trades ואז מחשבת monthly performance — ומעבירה הכל דרך `postMessage`. עם batch של 50 תוצאות, כל אחת עם 10-100 trades — זה structured clone כבד.

**תיקון**: ב-Worker, לא לשמור trades array בתוצאות. לחשב רק מטריקות מספריות.

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/strategies.ts` | S3 ו-S5: לקבל `highs`/`lows` מ-indicators במקום `.map()` |
| `src/lib/optimizer/strategies.ts` (StrategyIndicators) | הוספת `highs: number[]`, `lows: number[]` לממשק |
| `src/lib/optimizer/portfolioSimulator.ts` | `buildIndicators`: להוסיף `highs`/`lows` ל-indicators |
| `src/lib/optimizer/strategyEngine.ts` | `evaluateAllSignals`: החזרת struct קטן (3 שדות) בלולאה החמה |
| `src/workers/optimizer.worker.ts` | הסרת trades מתוצאות batch, הסרת monthly performance |

### תוצאה צפויה
- שיפור ×50-200 — הבאגים של `.map()` לבד אחראים לרוב האיטיות
- אותה תוצאה מתמטית בדיוק
- הדף נשאר רספונסיבי

