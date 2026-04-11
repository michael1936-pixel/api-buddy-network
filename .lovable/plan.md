

## תיקון מהירות — `toLocaleString` הוא צוואר הבקבוק

### שורש הבעיה
ב-`strategyEngine.ts` שורה 85, **כל קריאה ל-`evaluateAllSignals`** מריצה:
```javascript
dateObj.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', hour12: false });
```

זו פונקציה **איטית מאוד** — כל קריאה לוקחת ~0.1-0.5ms בגלל ICU lookup + timezone conversion + string parsing. עם ~6,000 bars × 3,000 קומבינציות = **18 מיליון קריאות** → ~30-150 דקות רק על שורה אחת.

**בפרויקט השני אין את הבדיקה הזו כלל** — אין session time check בלולאה הפנימית.

### הפתרון — Pre-compute timezone פעם אחת

במקום לחשב timezone בכל bar בכל קומבינציה, נחשב **פעם אחת** מערך `sessionMinutes[]` ב-`buildIndicators` (או ב-init) ונשתמש בו ישירות:

```typescript
// Pre-compute once per candle set:
const JERUSALEM_OFFSET_MS = 3 * 3600000; // UTC+3 (summer) or UTC+2
const sessionMinutes = candles.map(c => {
  const d = new Date(c.timestamp + JERUSALEM_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
});

// In hot loop — just array lookup, zero overhead:
const totalMinJerusalem = sessionMinutes[i];
```

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/strategyEngine.ts` | הסרת `toLocaleString` מהלולאה, קבלת `sessionMinutes[]` כפרמטר |
| `src/lib/optimizer/portfolioSimulator.ts` | חישוב `sessionMinutes[]` פעם אחת ב-`buildIndicators` או ב-`runSingleBacktestWithIndicators`, העברה ל-`evaluateAllSignals` |
| `src/workers/optimizer.worker.ts` | עדכון קטן אם צריך להעביר את המערך |

### תוצאה צפויה
- שיפור ×100-500 — מ-0.3 ל-~100-400 קומב׳/שניה
- אותה תוצאה מתמטית (אותו חישוב timezone, רק פעם אחת)
- בשילוב ה-indicator cache שכבר קיים — מהירות מקסימלית

