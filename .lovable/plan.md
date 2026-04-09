

# חיבור שרת Railway ל-Lovable Cloud

## מה צריך לעשות

השרת שלך ב-Railway כבר עובד ומחובר לפרויקט Supabase ישן (`tymaylrydvzcxvgmavvf`). צריך לעדכן 2 משתנים ב-Railway כדי שיצביעו ל-Lovable Cloud החדש (`ckyvvfwpetarfsiqirrf`).

## השלבים

### שלב 1: קבלת ה-Service Role Key
הפרויקט של Lovable Cloud כבר מכיל service role key. אני אשלוף את ה-URL וה-key שצריך.

- **SUPABASE_URL** החדש: `https://ckyvvfwpetarfsiqirrf.supabase.co`
- **SUPABASE_SERVICE_KEY** — צריך להעתיק מהגדרות Lovable Cloud (אני אעזור לך למצוא אותו)

### שלב 2: עדכון משתנים ב-Railway
ב-Railway dashboard, תחליף את שני המשתנים הבאים:

| משתנה | ערך ישן | ערך חדש |
|---|---|---|
| `SUPABASE_URL` | `https://tymaylrydvzcxvgmavvf.supabase.co` | `https://ckyvvfwpetarfsiqirrf.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (הישן) | (של Lovable Cloud) |

שאר המשתנים (TWELVE_DATA_API_KEY, TRADERSPOST_WEBHOOK_URL, CLAUDE_API_KEY, FINNHUB_API_KEY, API_KEY, SYMBOLS, PORT, MAX_DAILY_LOSS) **לא צריכים להשתנות** — הם לא קשורים ל-Supabase.

### שלב 3: Redeploy ב-Railway
אחרי עדכון המשתנים, Railway יעשה redeploy אוטומטי והשרת יתחיל לכתוב נתונים ל-DB החדש.

### שלב 4: אימות
אני אבדוק שנתונים מתחילים להגיע לטבלאות (signals, positions, agent_logs) דרך query על ה-DB.

## מה אני אעשה בצד שלי
- אפתח לך גישה ל-Service Role Key דרך Lovable Cloud
- אוודא שה-DB schema תואם למה שהשרת מצפה (כבר יצרנו 17 טבלאות)
- אבדוק שנתונים זורמים אחרי החיבור

## הערה חשובה
הטבלאות ב-Lovable Cloud **כבר נוצרו** עם אותו schema בדיוק כמו בפרויקט הישן, אז השרת אמור לעבוד מיד.

