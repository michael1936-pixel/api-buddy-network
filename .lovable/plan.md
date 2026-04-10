

# תיקון WebSocket — כל הסמלים נכשלים ב-Subscribe

## הבעיה (3 בעיות)

1. **שני חיבורים מתחרים**: ה-hook נקרא ב-`AppLayout` וגם ב-`News.tsx` — שני חיבורי WebSocket נפתחים במקביל ומתחרים על אותם סלוטים
2. **Reconnect אינסופי**: `reconnectCount` מתאפס ל-0 ב-`onopen` (שורה 91), אז גם אם ה-subscribe נכשל, ה-counter לעולם לא מגיע ל-MAX — לולאה אינסופית
3. **ייתכן שהשרת ב-Railway תופס סלוטים**: אם שרת Railway גם משתמש ב-WebSocket עם אותו API key, הוא צורך חלק מ-8 הסלוטים

## הפתרון

### 1. Context Provider — חיבור WS אחד לכל האפליקציה
- קובץ חדש: `src/contexts/MarketDataContext.tsx`
- Context שמנהל חיבור WS יחיד
- `AppLayout` ו-`News.tsx` יצרכו מה-Context במקום ליצור hook נפרד

### 2. תיקון reconnect
- **לא** לאפס `reconnectCount` ב-`onopen` — לאפס רק אחרי subscribe מוצלח
- להוסיף exponential backoff: `delay = RECONNECT_DELAY_MS * 2^attempt` (עד 60 שניות)
- אחרי MAX_RECONNECT_ATTEMPTS, להישאר ב-REST fallback בלי לנסות שוב

### 3. פורמט סמלים עם exchange
לפי הדוקומנטציה, אפשר לציין exchange אחרי נקודתיים:
```
"SPY:NYSE,VIX:CBOE,VIXY:NYSE"
```

### קבצים

| קובץ | פעולה |
|-------|-------|
| `src/contexts/MarketDataContext.tsx` | חדש — Provider עם WS יחיד |
| `src/hooks/useMarketDataWebSocket.ts` | עדכון — תיקון reconnect + פורמט סמלים |
| `src/components/AppLayout.tsx` | עדכון — שימוש ב-Context |
| `src/pages/News.tsx` | עדכון — שימוש ב-Context |
| `src/App.tsx` | עדכון — עטיפה ב-Provider |

### תוצאה צפויה
- חיבור WS יחיד לכל האפליקציה
- אם subscribe נכשל — לא reconnect אינסופי, עובר ל-REST
- פורמט סמלים מדויק עם exchange

### הערה חשובה
אם גם אחרי התיקון כל הסמלים נכשלים, ייתכן שהשרת ב-Railway תופס את כל 8 הסלוטים. תצטרך לבדוק את זה בדשבורד של Twelve Data (API Usage → WebSocket connections).

