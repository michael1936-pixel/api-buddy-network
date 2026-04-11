
כן — אם אתה רוצה תצוגה כמו ברוקר, צריך להחליף גם ספק וגם ארכיטקטורה. עם המימוש הנוכחי זה בלתי אפשרי, כי:
- `fetch-market-data` משתמש ב-`time_series` של דקה => candles, לא ticks
- `useMarketDataLive` עושה polling כל 15s => לא realtime
- `VIX` מגיע מ-DB / `VIXY proxy` => לא VIX חי ואמיתי
- `MarketDataProvider` מבוסס Context => כל tick מרנדר עץ React שלם, לא מתאים ל-high frequency

## ההמלצה
המסלול הנכון הוא:
1. מקור live ראשי = feed של ברוקר/ספק מקצועי עם streaming אמיתי
2. `VIX` = feed רשמי שכולל CBOE VIX real-time
3. Railway = שכבת stream קבועה
4. React = רק צרכן של stream פנימי, לא מתחבר ישירות לספק

אם כבר יש לך subscriptions ב-Interactive Brokers — זה המסלול המועדף.
אם לא — צריך ספק בתשלום שתומך גם US equities real-time וגם VIX/CBOE real-time.
בלי entitlement אמיתי ל-VIX, אי אפשר לתת VIX חי “כמו ברוקר”.

## מה אבנה
### 1. להוציא את ה-live path מה-polling
- לבטל את `fetch-market-data` כמקור live
- להשאיר REST רק ל-snapshot/fallback
- להסיר את `VIXY -> VIX` proxy מהמסלול החי

### 2. לבנות stream קבוע דרך Railway
- חיבור persistent לספק הנתונים
- subscribe/unsubscribe לפי symbols
- נרמול ticks לפורמט אחיד
- WebSocket פנימי אחד לדשבורד

### 3. לשכתב את שכבת ה-client ל-high frequency
- להחליף את `MarketDataContext`/`useState` ב-store חיצוני עם subscription לפי symbol
- batching עם `requestAnimationFrame`
- לא לרנדר את כל האפליקציה על כל tick

### 4. VIX אמיתי בלבד
- לא יותר DB freshness כתחליף ל-live
- לא יותר `VIXY proxy`
- אם feed VIX לא זמין: להציג `feed unavailable` ולא נתון מטעה

### 5. תמיכה במניות מרובות
- לא hardcoded ל-`SPY,VIX,VIXY`
- מנגנון subscribe דינמי לפי watchlist / מסכים פעילים

## קבצים שיתעדכנו בריפו הזה
- `src/hooks/useMarketDataWebSocket.ts` — מעבר ל-stream פנימי במקום Twelve Data
- `src/contexts/MarketDataContext.tsx` — החלפה/צמצום לטובת store מהיר
- `src/hooks/use-trading-data.ts` — REST כ-snapshot בלבד
- `src/pages/News.tsx` — צריכת ticks חיים + source/latency
- `src/components/AppLayout.tsx` — top bar חי בלי polling מטעה
- `supabase/functions/get-ws-token/index.ts` — טוקן גישה פנימי ל-stream או הסרה
- `supabase/functions/fetch-market-data/index.ts` — snapshot בלבד

## עבודה שנדרשת מחוץ לריפו הזה
הקוד של שרת Railway לא נמצא כאן, אבל הוא הכרחי לפתרון:
- market stream service קבוע
- חיבור לברוקר/ספק
- fan-out ללקוחות
- optional: שמירת 1s/1m aggregates ל-history, לא כל tick

## פרטים טכניים
```text
Broker / market-data feed
        ↓
Railway market-stream service
        ↓
normalized internal WebSocket
        ↓
client-side market store
        ↓
News / top bar / שאר המסכים
```

פורמט tick מומלץ:
```text
symbol, last, bid, ask, size, exchange_ts, received_at, provider, sequence
```

מגבלה חשובה:
- feed יכול להיות מהיר מאוד
- אבל ה-UI יצויר לפי קצב המסך (בד"כ 60Hz/120Hz), אז המטרה היא broker-like smooth streaming — לא polling ולא candles

## תוצאה צפויה
- מניות יתעדכנו tick-by-tick
- VIX יהיה חי רק אם יש entitlement רשמי מתאים
- לא יהיה יותר delay של דקות
- אם אין feed מתאים, נדע שזה חסם ספק/רישוי — לא באג React

## תנאי לביצוע
כדי לממש את זה באמת צריך אחד מאלה:
- גישה ל-Interactive Brokers / feed של הברוקר עם market data subscriptions
- או ספק חדש בתשלום עם real-time equities + official VIX

זה הכיוון הנכון אם הדרישה היא “כמו ברוקר”, ולא “REST מהיר יותר”.
