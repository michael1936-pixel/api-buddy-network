

## הוספת IB Gateway (Paper) על Railway — צעד צעד

### מצב נוכחי
- יש לך שרת Railway פעיל בדומיין `selfless-kindness-production-0003.up.railway.app`
- צריך להוסיף service חדש של IB Gateway (Docker) — לא מצאת את כפתור + New

### שלב 1: מציאת כפתור + New ב-Railway
1. היכנס ל-Railway dashboard: https://railway.com/dashboard
2. לחץ על **שם הפרויקט** (לא על service ספציפי)
3. ברגע שאתה רואה את כל ה-services שלך בתצוגת פרויקט — תמצא כפתור **+ New** או **+ Add Service** בפינה הימנית/שמאלית העליונה
4. בחר **Docker Image** והכנס: `ghcr.io/gnzsnz/ib-gateway:latest`

### שלב 2: הגדרת Variables ל-IB Gateway service
```
TWS_USERID=שם_משתמש_IBKR_שלך
TWS_PASSWORD=סיסמה_של_IBKR
TRADING_MODE=paper
READ_ONLY_API=yes
```

**חשוב**: בפעם הראשונה IB Gateway ידרוש אישור 2FA מאפליקציית IBKR בטלפון.

### שלב 3: בפרויקט Lovable — הגדרת VITE_RAILWAY_WS_URL
אחרי שה-service רץ, נגדיר ב-Lovable את ה-URL של ה-WebSocket:
```
VITE_RAILWAY_WS_URL=wss://selfless-kindness-production-0003.up.railway.app/ws/market
```

### שלב 4: בניית market-stream endpoint על Railway
צריך להוסיף לשרת Railway שלך endpoint `/ws/market` שמתחבר ל-IB Gateway ומשדר ticks לדשבורד. זה קוד Node.js שירוץ על אותו שרת Railway או כ-service נפרד.

### מה אבנה בפרויקט הזה (Lovable)
- שום דבר כרגע — הצד של הלקוח (React) כבר מוכן מהשלב הקודם
- `useMarketDataWebSocket.ts` כבר יודע להתחבר ל-`VITE_RAILWAY_WS_URL`
- `marketDataStore.ts` כבר תומך ב-RAF batching

### סיכום הצעדים
1. **אתה**: מצא + New ב-Railway, הוסף IB Gateway Docker service
2. **אתה**: הגדר variables (credentials + paper mode)
3. **אני**: אעזור לבנות את ה-market-stream endpoint על Railway
4. **אני**: אגדיר את ה-VITE_RAILWAY_WS_URL בפרויקט

