

# חיבור נתוני שוק בזמן אמת לסרגל העליון

## הבעיה
הנתונים מגיעים מ-`fetch-market-data` בהצלחה (SPY: 681.22, VIX: 18.98), אבל בסרגל העליון (`AppLayout.tsx`) הערכים hardcoded כ-`--`.

שורות 59, 63:
```
<span className="font-mono text-trading-profit">VIX --</span>
<span className="text-muted-foreground">שוק: --</span>
```

## הפתרון
קובץ אחד לעדכון: `src/components/AppLayout.tsx`

1. ייבוא `useMarketDataLive` מ-`use-trading-data`
2. שליפת נתוני SPY ו-VIX מה-hook
3. הצגת VIX עם צבע דינמי (ירוק מתחת ל-20, אדום מעל 25)
4. הצגת מצב שוק: "פתוח" / "סגור" לפי שעות מסחר NYSE (14:30-21:00 UTC)
5. הצגת מחיר SPY נוכחי
6. צבע ירוק אם SPY עולה, אדום אם יורד

## תצוגה צפויה בסרגל
```
VIX 18.98 · SPY 681.22 ↑ · שוק: פתוח · זמן אמת · 17:20:37
```

## פרטים טכניים
- `useMarketDataLive()` כבר קיים ב-`use-trading-data.ts` עם `refetchInterval: 30000`
- ה-response מחזיר `{ SPY: { close, prev_close }, VIX: { close, prev_close } }`
- חישוב שינוי: `((close - prev_close) / prev_close * 100).toFixed(2)`

