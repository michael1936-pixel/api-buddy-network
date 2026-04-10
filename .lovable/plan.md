
# מצב נוכחי
לא, זה עדיין לא מתוקן. לפי הלוגים, ה-WebSocket מתחבר אבל ה-subscribe עצמו נכשל בכל פעם:
```text
[WS] Subscribe status: error
fails: SPY / VIX / VIXY
```
כלומר אין בכלל stream חי, והמערכת נופלת חזרה ל-REST.

בנוסף, ה"זמן עדכון" שמוצג לך מטעה:
- `fetch-market-data` מחזיר ל-SPY/VIXY `timestamp` כטקסט גולמי כמו `2026-04-10 11:34:00`
- ה-UI עושה `new Date(...)` ומציג אותו ב-`he-IL`
- בלי timezone מפורש, הדפדפן מפרש את הזמן לא נכון, ולכן אתה רואה `11:28` וחושב שהמערכת תקועה

## מה צריך לתקן עכשיו

### 1. ניסיון אחרון נכון ל-WebSocket
הקוד הנוכחי שולח:
```json
"SPY:NYSE,VIX:CBOE,VIXY:NYSE"
```
לפי הדוקומנטציה של Twelve Data, פורמט ה-subscribe צריך להיות פשוט:
```json
{ "action": "subscribe", "params": { "symbols": "SPY,VIX,VIXY" } }
```
אני אעדכן את ה-hook לפורמט הזה ואבדוק subscribe-status נקי.

### 2. אם גם זה נכשל — לעצור להעמיד פנים שזה זמן אמת
אם גם בפורמט הפשוט כל הסמלים נכשלים, המסקנה היא שהחשבון שלך לא מאפשר WS לסמלים האלה כרגע (או מאפשר רק trial symbols).
במצב כזה אני אעשה:
- הפסקת reconnect אינסופי
- מעבר מסודר ל-REST
- badge ברור של `Delayed / REST`
- לא להציג `⚡ WS` לפני שיש subscribe מוצלח בפועל

### 3. לתקן את ה-timestamp
ב-`fetch-market-data` צריך להחזיר timestamps תקינים ב-ISO עם timezone, ולא את `latest.datetime` הגולמי.
כך ה-UI יציג זמן אמיתי ולא `11:28` תקוע.

### 4. לשפר את fallback כדי שירגיש הרבה יותר חי
גם אם WS לא זמין, ה-fallback הנוכחי הוא `time_series` של 1 דקה, ולכן הוא לעולם לא יהיה tick-by-tick.
אני אשפר את fallback ל:
- polling מהיר יותר בזמן שהשוק פתוח
- עדיפות ל-endpoint של latest price / quote במקום candle של דקה, אם הוא נתמך לסמלים האלה
- חיווי כמה זמן עבר מהעדכון האחרון

## קבצים לעדכון
| קובץ | שינוי |
|---|---|
| `src/hooks/useMarketDataWebSocket.ts` | מעבר ל-`SPY,VIX,VIXY`, הצלחת WS רק אחרי subscribe מוצלח, עצירת reconnect שגוי |
| `supabase/functions/fetch-market-data/index.ts` | החזרת timestamp תקין עם timezone, ושיפור מקור הנתון ל-fallback |
| `src/hooks/use-trading-data.ts` | polling מהיר יותר/חכם יותר בזמן שוק פתוח |
| `src/pages/News.tsx` | הצגת זמן עדכון אמיתי + age indicator + badge אמין |
| `src/components/AppLayout.tsx` | badge מצב נתונים אמין גם בסרגל העליון |

## תוצאה צפויה
יש שני תרחישים אפשריים:

### תרחיש A — ה-WS עובד בפורמט הפשוט
- SPY / VIX / VIXY יתעדכנו בזמן אמת
- זמן העדכון יוצג נכון
- ה-badge יעבור ל-`⚡ WS`

### תרחיש B — ה-WS עדיין נדחה
- נפסיק reconnect מיותר
- נעבור ל-REST מהיר ואמין יותר
- זמן העדכון יוצג נכון
- יוצג בבירור שזה `REST / Delayed`
- תדע שהחסם הוא ברמת ספק הנתונים/תוכנית, לא בבאג React או Context

## פרטים טכניים
- ה-Context provider כבר קיים, אז בעיית ה"חיבור הכפול" כנראה כבר נפתרה
- הבעיה המרכזית עכשיו היא `subscribe-status: error` לכל הסמלים
- הקוד הנוכחי מסמן `connected` כבר ב-`onopen`, אבל זה מוקדם מדי; צריך לסמן realtime רק אחרי subscribe מוצלח
- ה-REST הנוכחי מחזיר זמן Candle של ניו-יורק/Exchange בלי timezone מפורש, וזה מה שיוצר את הבלבול בצילום

## סדר עבודה
1. להחליף subscribe ל-`SPY,VIX,VIXY`
2. לקשור `isRealtime` רק ל-subscribe מוצלח
3. לעצור reconnect אם כל הסמלים נדחו
4. לתקן timestamps ב-backend
5. לשפר polling/fallback ולהציג age של הנתון
