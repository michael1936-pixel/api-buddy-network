

# נתוני שוק בזמן אמת עם WebSocket של Twelve Data

## המצב היום
הנתונים נשלפים כל 30 שניות דרך REST API (polling). יש לך 8 חיבורי WebSocket בתוכנית Grow — אפשר לקבל עדכונים בזמן אמת (מיליוינות) במקום כל 30 שניות.

## הבעיה הטכנית
Edge functions הם stateless — לא יכולים להחזיק חיבור WebSocket פתוח. הפתרון: **חיבור WebSocket ישירות מהדפדפן** לשרתי Twelve Data.

## הפתרון

### 1. Edge function חדש: `get-ws-token`
פונקציה קטנה שמחזירה את ה-API key לדפדפן (בצורה מאובטחת דרך edge function):
- `supabase/functions/get-ws-token/index.ts`
- מחזירה את `TWELVE_DATA_API_KEY` ללקוח

### 2. Hook חדש: `useMarketDataWebSocket`
- `src/hooks/useMarketDataWebSocket.ts`
- מתחבר ל-`wss://ws.twelvedata.com/v1/quotes/price`
- שולח subscribe ל-`SPY,VIX,VIXY` (3 מתוך 8 הסלוטים שלך)
- מעדכן state בכל tick שמגיע (בזמן אמת)
- reconnect אוטומטי אם החיבור נופל
- fallback ל-`useMarketDataLive()` (REST) אם ה-WS נכשל

### 3. עדכון דפים שמשתמשים בנתוני שוק
- `News.tsx` — יחליף את `useMarketDataLive` ב-`useMarketDataWebSocket`
- `AppLayout.tsx` — אותו דבר לסרגל העליון

### תוצאה צפויה
- VIX, SPY, VIXY יתעדכנו **בזמן אמת** (כל שינוי מחיר)
- נשארים 5 סלוטי WS פנויים למניות אחרות בעתיד
- Fallback אוטומטי ל-REST אם ה-WebSocket לא זמין

### קבצים
| קובץ | פעולה |
|-------|-------|
| `supabase/functions/get-ws-token/index.ts` | חדש |
| `src/hooks/useMarketDataWebSocket.ts` | חדש |
| `src/pages/News.tsx` | עדכון hook |
| `src/components/AppLayout.tsx` | עדכון hook |

