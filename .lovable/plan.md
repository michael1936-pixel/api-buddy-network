

# תיקון דיליי בנתוני VIX בדף החדשות

## הבעיה
- **SPY**: מגיע ישירות מ-Twelve Data API (דיליי של דקה — תקין)
- **VIX**: מגיע מה-DB שהשרת ב-Railway כותב אליו **כל 5 דקות**. זה הדיליי שאתה רואה

ב-DB רואים שהנתונים של VIX מתעדכנים כל 5 דקות (14:25, 14:20, 14:15...) בזמן שהשוק פתוח. אין נתוני SPY בכלל ב-DB (רק VIX).

## הפתרון
לשנות את `fetch-market-data` edge function כך ש-VIX ייקרא **ישירות מ-Twelve Data API** במקום מה-DB — בדיוק כמו SPY.

### שינוי ב-`supabase/functions/fetch-market-data/index.ts`:
1. שנה את רשימת הסמלים מ-`['SPY', 'VIXY']` ל-`['SPY', 'VIXY', 'VIX']`
2. VIX נתמך ב-Twelve Data כסמל ישיר (CBOE Volatility Index)
3. אם Twelve Data מחזיר VIX — להשתמש בזה. אם לא (fallback) — לקרוא מה-DB כמו היום
4. לשמור גם את VIX ל-DB (כמו SPY) כדי שהשרת ב-Railway לא יהיה המקור היחיד

### תוצאה צפויה
- VIX יתעדכן כל 30 שניות (כמו SPY) במקום כל 5 דקות
- Fallback ל-DB אם Twelve Data לא מחזיר VIX

