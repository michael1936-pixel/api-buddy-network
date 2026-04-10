

# תיקון WebSocket — Subscribe נכשל

## הבעיה
הלוגים מראים:
```
[WS] Connected to Twelve Data
[WS] Subscribe status: error
[WS] Disconnected
```

ה-WebSocket מתחבר בהצלחה, אבל ה-subscribe נכשל ← Twelve Data סוגר את החיבור ← reconnect אינסופי ← נתונים לא מגיעים.

ה-hook לא מדפיס את הודעת השגיאה המלאה (`msg.fails`), אז לא יודעים למה בדיוק זה נכשל.

## הפתרון — שני שינויים ב-`src/hooks/useMarketDataWebSocket.ts`:

### 1. לוג מלא של שגיאת subscribe
שורה 82 — להוסיף את `msg.fails` ואת ה-message המלא ללוג כדי לראות מה Twelve Data מחזיר.

### 2. תיקון VIX — שימוש בפורמט מורחב
VIX הוא אינדקס (Index), לא מניה. ייתכן שצריך לציין `type` או `exchange` בפורמט המורחב:
```json
{
  "action": "subscribe",
  "params": {
    "symbols": [
      {"symbol": "SPY", "exchange": "NYSE"},
      {"symbol": "VIX", "exchange": "CBOE"},
      {"symbol": "VIXY", "exchange": "NYSE"}
    ]
  }
}
```

### 3. הוספת heartbeat
לפי הדוקומנטציה, צריך לשלוח `{"action": "heartbeat"}` כל 10 שניות כדי לשמור על החיבור יציב.

### 4. לא לעשות reconnect על subscribe error
אם ה-subscribe נכשל, לא לנתק — להישאר מחובר ולנסות שוב עם הסמלים שהצליחו.

## קובץ אחד לעדכון
`src/hooks/useMarketDataWebSocket.ts`

## תוצאה צפויה
- לוג מלא שמראה למה ה-subscribe נכשל
- פורמט מורחב שמטפל נכון ב-VIX כאינדקס
- Heartbeat שומר על חיבור יציב
- נתוני SPY, VIX, VIXY בזמן אמת

