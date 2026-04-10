

# תיקון נתונים תקועים — באג במיזוג REST

## הבעיה
ה-Edge Function מחזיר נתונים טריים (15:56 UTC = 18:56 ישראל), אבל ה-UI מציג 18:54 כי:

1. `useEffect` בשורה 207 מכניס נתוני REST ל-`data` state **פעם אחת** (בגלל `!updated[sym]?.source`)
2. בשורה 237: `mergedData = { ...restData, ...data }` — ה-`data` הישן **דורס** את `restData` החדש
3. תוצאה: הנתון הראשון שנכנס ל-state נשאר לנצח

## הפתרון
שני שינויים ב-`src/hooks/useMarketDataWebSocket.ts`:

### 1. להסיר את ה-seeding של REST ל-data state
ה-`useEffect` בשורות 207-235 מיותר. ה-REST data כבר זמין דרך `restData` ומגיע דרך ה-merge.

### 2. לתקן את ה-merge כך ש-WS דורס REST, אבל לא להפך
```typescript
// REST as base, WS data overrides only if source === "ws"
const wsEntries = Object.fromEntries(
  Object.entries(data).filter(([_, v]) => v.source === "ws")
);
const mergedData = { ...((restData as MarketDataMap) || {}), ...wsEntries };
```

כך כל poll חדש של REST יתעדכן מיד, ו-WS ידרוס רק כשיש באמת tick חי.

### 3. לשמור prev_close מ-REST ב-ref בלבד
`firstPriceRef` ימשיך להתעדכן מ-REST לצורך חישוב שינוי, בלי לגעת ב-`data` state.

## קובץ אחד לעדכון
`src/hooks/useMarketDataWebSocket.ts`

## תוצאה צפויה
- כל 15 שניות ה-timestamp יתעדכן עם נתון טרי מה-REST
- אם WS יעבוד — ידרוס בזמן אמת
- לא עוד "18:54 תקוע"

