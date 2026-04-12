

## תיקון התקדמות כללית — הצגת סכום קומבינציות מכל השלבים

### הבעיה
השרת כותב ל-`optimization_runs` את ה-`current_combo` ו-`total_combos` של **השלב הנוכחי בלבד**, לא ערכים מצטברים. לכן "התקדמות כללית" מציגה 239,340 / 300,000 — שזה רק שלב 3, במקום הסכום של כל השלבים.

### פתרון — צבירה ב-Store
נעקוב ב-store אחרי מעברי שלבים ונצבור את הקומבינציות שהושלמו:

| קובץ | שינוי |
|---|---|
| `src/stores/optimizationStore.ts` | הוספת משתנים `completedCombos` ו-`lastTrackedStage` שצוברים combos כשהשלב עולה. חישוב overall = צבור + שלב נוכחי |

### לוגיקה
```
// Module-level refs
let completedCombos = 0;      // סכום combos משלבים שהסתיימו
let lastTrackedStage = 0;     // שלב אחרון שנספר
let lastStageTotalCombos = 0; // total_combos של השלב הקודם

// בכל poll, כשרואים שcurrent_stage עלה:
if (currentStage > lastTrackedStage && lastTrackedStage > 0) {
  completedCombos += lastStageTotalCombos;
}
lastTrackedStage = currentStage;
lastStageTotalCombos = totalCombos; // total של השלב הנוכחי

// Overall:
overallCombinations = {
  current: completedCombos + currentCombo,
  total: completedCombos + totalCombos  // מתעדכן בכל שלב
}
```

- ב-`resetState` מאפסים `completedCombos = 0`, `lastTrackedStage = 0`
- ה-cap של 300K מוסר מה-total (כבר לא רלוונטי — עכשיו זה סכום אמיתי)
- אותו תיקון גם ב-`startPollingQueue`

