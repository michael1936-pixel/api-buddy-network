

## תיקון התקדמות כללית — שימוש ב-stageEstimates לחישוב מדויק

### הבעיה
הלוגיקה הנוכחית צוברת combos רק כשרואים מעבר שלב בזמן אמת. אם המשתמש פותח את הדף באמצע ריצה, או אם שלבים 1-2 כבר הסתיימו לפני שה-polling התחיל — הצבירה מתפספסת. לכן "התקדמות כללית" מציגה את אותם מספרים כמו "שלב נוכחי".

### פתרון — חישוב מבוסס stageEstimates + currentStage
במקום לצבור ידנית, נחשב מ-`stageEstimates` (שכבר קיים ומכיל את מספר הקומבינציות לכל שלב):

```
completedCombos = סכום stageEstimates של כל השלבים שמספרם < currentStage
overallCurrent = completedCombos + currentCombo
overallTotal = סכום stageEstimates של כל השלבים המופעלים
```

### שינויים

| קובץ | שינוי |
|---|---|
| `src/stores/optimizationStore.ts` | בשני מקומות (startPolling + startPollingQueue): חישוב overall מתוך stageEstimates במקום צבירה ידנית. הסרת completedCombos/lastTrackedStage/lastStageTotalCombos |

### לוגיקה בפולינג
```typescript
// Get estimates (from store state or compute once)
const estimates = get().stageEstimates;
const enabledStages = get().enabledStages;

// Sum completed stages
let completedCombos = 0;
for (const [stageNum, combos] of Object.entries(estimates)) {
  if (Number(stageNum) < currentStage) {
    completedCombos += combos;
  }
}

const overallCurrent = completedCombos + currentCombo;

// Total = sum of all enabled stage estimates
let overallTotal = 0;
for (const [stageNum, combos] of Object.entries(estimates)) {
  overallTotal += combos;
}

set({ overallCombinations: { current: overallCurrent, total: overallTotal } });
```

- הסרת המשתנים `completedCombos`, `lastTrackedStage`, `lastStageTotalCombos` (כבר לא נחוצים)
- חישוב `stageEstimates` בתחילת הריצה (כבר קורה ב-Backtest.tsx → `computedEstimates`) ושמירתו ב-store
- וידוא ש-`stageEstimates` מאוכלס ב-store לפני הפולינג (בפונקציית `runOptimization`/`runOptimizationQueue`)

