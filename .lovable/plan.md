

## תיקון מהירות — Indicator Cache + Pre-filter

### שורש הבעיה
כל קומבינציה (מתוך אלפים):
1. מסננת 12K candles לפי תאריך — **×2** (train+test)
2. מחשבת 15 אינדיקטורים על ~6K bars — **×2** (train+test)
3. רק אז מריצה את ה-backtest עצמו

סה"כ: ~90% מזמן הריצה הולך על אינדיקטורים + filter, לא על הסימולציה.

### הפתרון — 2 שינויים ב-Worker בלבד

**1. Pre-filter candles פעם אחת (ב-init)**
ב-`optimizer.worker.ts`, ברגע שמקבלים `init` עם periodSplit — מסננים train/test candles ושומרים. לא צריך לסנן שוב.

**2. Indicator cache לפי hash**
מתוך ~80 פרמטרים, רק 14 משפיעים על `buildIndicators`:
```
s1_rsi_len, s1_ema_fast_len, s1_ema_mid_len, s1_ema_trend_len,
s1_atr_len, s1_atr_ma_len, s1_adx_len, s1_bb_len, s1_bb_mult, s1_vol_len,
bb2_adx_len, bb2_bb_len, bb2_bb_mult, bb2_ma_len
```

נבנה hash מ-14 הערכים האלה. אם ה-hash זהה לקומבינציה קודמת — משתמשים באינדיקטורים שכבר חושבו. אם שונה — מחשבים ושומרים ב-cache.

**שינויים:**

| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/portfolioSimulator.ts` | ייצוא `buildIndicators` + פונקציה חדשה `runSingleBacktestWithIndicators(candles, indicators, params)` שמדלגת על חישוב אינדיקטורים |
| `src/workers/optimizer.worker.ts` | pre-filter candles ב-init + indicator cache עם Map לפי hash של 14 פרמטרים |

### למה לא להוריד אינדיקטורים מהשרת?
כי האינדיקטורים תלויים בפרמטרים שמשתנים בין קומבינציות (כמו `s1_rsi_len=10` vs `s1_rsi_len=14`). אי אפשר לחשב מראש את כל הווריאציות. ה-cache פותר את זה — מחשב פעם אחת per unique indicator combo (~100-500 ייחודיים מתוך אלפי קומבינציות).

### תוצאה צפויה
- שיפור ×50-200 — מ-0.3 ל-~60-300 קומב׳/שניה
- אותה תוצאה מתמטית בדיוק
- הדף נשאר רספונסיבי (כבר ב-Worker)

