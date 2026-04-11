

## העברת אופטימיזציה לשרת Railway — ריצה ברקע

### הבעיה
מנוע האופטימיזציה (30 שלבים, אלפי קומבינציות) רץ ב-JavaScript בדפדפן. סוגרים טאב = הכול מת. Edge Functions לא מתאימים כי יש timeout של 60 שניות, והאופטימיזציה לוקחת דקות/שעות.

### הפתרון
העברת הריצה לשרת Railway הקיים. הקליינט רק שולח job ומאזין להתקדמות דרך ה-DB.

### ארכיטקטורה

```text
Client                    Edge Function              Railway Server
  │                           │                           │
  ├─ POST /trigger-optimize ──►│                           │
  │   {symbol, config}        ├── POST /api/optimize ────►│
  │                           │   {symbol, config}        ├── load data from DB
  │   ◄── {runId, status} ────┤                           ├── run stage 1...30
  │                           │                           ├── UPDATE optimization_runs 
  │                           │                           │   (progress every 5s)
  │   poll optimization_runs  │                           ├── INSERT optimization_results
  │   every 3s ───────────────┼───────────────────────────┤   (when done)
  │                           │                           │
  ▼ show real-time progress   │                           ▼
```

### שינויים

| קובץ | שינוי |
|-------|-------|
| `supabase/functions/trigger-optimization/index.ts` | **חדש** — Edge Function שמקבל `{symbol}`, יוצר שורה ב-`optimization_runs`, ושולח POST לשרת Railway |
| `src/stores/optimizationStore.ts` | שינוי `runOptimization` — במקום להריץ מקומית, קורא ל-Edge Function וסוקר DB כל 3 שניות |
| `src/pages/Backtest.tsx` | ללא שינוי משמעותי — ה-store כבר מזין את ה-UI |
| **Railway server** (חיצוני) | צריך להוסיף endpoint `/api/optimize` שמקבל symbol, טוען נתונים מה-DB, מריץ את מנוע האופטימיזציה, ומעדכן `optimization_runs` |

### פירוט טכני

**1. Edge Function: `trigger-optimization`**
- מקבל `{ symbol, enabledStages? }` 
- יוצר שורה ב-`optimization_runs` עם `status: 'queued'`
- שולח POST ל-`RAILWAY_API_URL/api/optimize` עם `{ symbol, runId, enabledStages }`
- מחזיר `{ runId }` ללקוח

**2. Store: polling במקום ריצה מקומית**
```typescript
runOptimization: async (symbol) => {
  // 1. Trigger via edge function
  const { data } = await supabase.functions.invoke('trigger-optimization', { body: { symbol } });
  const runId = data.runId;
  set({ isRunning: true, activeRunId: runId, currentSymbol: symbol });

  // 2. Poll optimization_runs every 3s
  const poll = setInterval(async () => {
    const { data: run } = await supabase
      .from('optimization_runs').select('*').eq('id', runId).single();
    
    set({
      bestTrainReturn: run.best_train,
      bestTestReturn: run.best_test,
      overallCombinations: { current: run.current_combo, total: run.total_combos },
      smartProgress: { currentStage: run.current_stage, totalStages: run.total_stages, ... },
    });
    
    if (run.status === 'completed' || run.status === 'failed') {
      clearInterval(poll);
      set({ isRunning: false });
    }
  }, 3000);
}
```

**3. Railway server endpoint (קוד שאכין לך להעתיק)**
- טוען candles מ-`market_data` (כמו שהקליינט עושה היום)
- מריץ `runSmartOptimization()` (אותו קוד בדיוק)
- כל 5 שניות: `UPDATE optimization_runs SET current_stage=X, best_train=Y, best_test=Z`
- בסיום: `INSERT INTO optimization_results` + `UPDATE optimization_runs SET status='completed'`

**4. Secret נדרש**
- `RAILWAY_API_URL` — כתובת ה-base URL של שרת Railway (כבר יש `VITE_RAILWAY_WS_URL` ל-WS, צריך גם HTTP)

### מה אצטרך ממך
1. כתובת ה-HTTP API של שרת Railway (למשל `https://algomaykl-server.up.railway.app`)
2. האם יש כבר auth/API key על השרת, או שכל בקשה מתקבלת?

### יתרונות
- האופטימיזציה רצה 24/7 גם כשהדפדפן סגור
- ה-UI פשוט סוקר את ה-DB ומציג התקדמות
- אפשר להריץ כמה מניות ברצף — השרת מנהל את התור
- הקוד של מנוע האופטימיזציה לא משתנה — רק המיקום שלו

