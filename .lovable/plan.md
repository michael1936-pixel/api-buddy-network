

## תיקון דף Backtest — שורת חיפוש + הורדת נתונים אוטומטית + סוכני Train/Test

### הבעיה
1. אין שורת חיפוש — אי אפשר למצוא מניה בקלות
2. אין מספיק נתונים ב-DB (SPY=93 bars, NVDA=35) — צריך לפחות 200
3. ה-train/test split קשיח 70/30 במקום להשתמש בסוכן שלומד

### מה ייבנה

**1. שורת חיפוש בראש הדף**
- Input עם autocomplete מתוך `sp500_symbols` + `tracked_symbols`
- אפשר לכתוב כל סימול (גם לא S&P)
- לחיצה על תוצאה → מפעיל את כל הזרימה

**2. Edge Function: `download-historical-data`**
- מקבל symbol, מוריד 5 שנים של 15min bars מ-Twelve Data
- Twelve Data נותן מקסימום 5000 bars per request → צריך pagination (כ-8 requests ל-5 שנים)
- שומר ל-`market_data` table
- מעדכן `data_download_jobs` עם סטטוס
- מעדכן `tracked_symbols` עם `total_bars`

**3. סוכני Train/Test Split + Test Threshold (client-side)**
- מימוש `TrainTestSplitAgent` ב-client — טוען מ-`agent_memory` table
- מימוש `TestThresholdAgent` ב-client — מעריך אם תוצאה "עוברת"
- ה-split נקבע דינמית לפי מה שהסוכן למד (ברירת מחדל 30% train / 70% test)
- אחרי אופטימיזציה: TestThresholdAgent מחליט passed/failed + score

**4. זרימה מלאה בלחיצה על מניה**
```text
User types "AAPL" → selects from search
  ↓
Check market_data count for AAPL
  ↓ (< 200 bars?)
Call download-historical-data edge function
  ↓ (downloads ~33K bars, 5 years of 15min)
Load TrainTestSplitAgent from agent_memory
  ↓ (gets recommended split, e.g. 30% train)
Run smartOptimization with dynamic split
  ↓
TestThresholdAgent evaluates result (score 0-100)
  ↓
Save to optimization_results with agent decision
```

### קבצים

| קובץ | שינוי |
|-------|-------|
| `supabase/functions/download-historical-data/index.ts` | **חדש** — Edge Function להורדת 5 שנים נתונים מ-Twelve Data |
| `src/lib/optimizer/trainTestSplitAgent.ts` | **חדש** — סוכן split (client-side, טוען מ-agent_memory) |
| `src/lib/optimizer/testThresholdAgent.ts` | **חדש** — סוכן threshold (client-side, מעריך תוצאות) |
| `src/pages/Backtest.tsx` | שורת חיפוש + שילוב הסוכנים בזרימת האופטימיזציה |
| `src/components/backtest/SymbolSearch.tsx` | **חדש** — קומפוננטת חיפוש מניה |

### Edge Function — download-historical-data
- משתמש ב-`TWELVE_DATA_API_KEY` (כבר קיים ב-secrets)
- Twelve Data: `outputsize=5000` נותן 5000 bars, צריך ~7 requests עם `start_date/end_date` לכיסוי 5 שנים
- Rate limit: 8 requests/min ב-free tier → מוסיף delay בין requests
- שומר batch ב-upsert ל-`market_data` (on conflict: symbol+interval+timestamp)
- מחזיר progress updates (כמה bars הורדו)

### הערות
- הסוכנים רצים client-side (קוראים מ-agent_memory) — הסנכרון עם Claude יהיה דרך שרת Railway
- ה-TestThresholdAgent משתמש בציון 0-100: עובר מ-70+ נקודות
- אם אין state ב-agent_memory (ריק כרגע) → משתמש בברירות מחדל מהמסמך

