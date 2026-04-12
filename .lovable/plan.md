

## תיקון שגיאות Runtime בחנות האופטימיזציה

### בעיות
1. **`Cannot destructure 'activeRunId'`** — ב-`startPolling` יש guard (`if (!state)`) אבל ב-`startPollingQueue` (שורה 438) אין — `get()` מחזיר `undefined` אחרי HMR/hot reload
2. **`REALISTIC_MAX_TOTAL is not defined`** — שארית מגרסה ישנה שנשמרה ב-cache של Vite. כבר לא בקוד הנוכחי, אבל צריך לוודא שאין התייחסות

### שינויים

| קובץ | שינוי |
|---|---|
| `src/stores/optimizationStore.ts` | הוספת guard ב-`startPollingQueue`: `const state = get(); if (!state) { stopPolling(); return; }` לפני כל destructure. אותו דבר בכל מקום ש-`get()` נקרא ב-interval callbacks |

### פירוט
- **שורה ~438**: שינוי `const { isRunning } = get()` ל:
  ```typescript
  const state = get();
  if (!state) { stopPolling(); return; }
  const { isRunning } = state;
  ```
- **שורות ~461-470**: הוספת guard דומה לפני גישה ל-`activeRun` data
- השגיאה `REALISTIC_MAX_TOTAL` תיעלם אחרי rebuild (כבר לא בקוד)

