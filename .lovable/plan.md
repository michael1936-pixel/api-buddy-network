

# תיקון הערכת קומבינציות לסיבוב 2

## הבעיה

הקוד **בפועל** כן משתמש ב-zone data לסיבוב 2 (שורות 463-465) — כלומר לוקח את הערכים הטובים מסיבוב 1 ועושה ±expansion סביבם. אבל:

1. **פונקציית ההערכה** (`estimateAllStageCombinations`, שורה 534) לא יודעת על zones — היא מחשבת R2 כאילו הוא רץ על הטווח המלא עם step=1, מה שנותן **מיליוני** קומבינציות בתצוגה
2. **אם ה-zone data לא קיים** (למשל אם R1 לא אסף תוצאות), R2 נופל ל-`expandConfigForStage` שמשתמש בטווח המלא בלי stepMultiplier — כלומר step=1 על כל הטווח = מיליונים באמת

## מה צריך לתקן

### בקובץ `src/lib/optimizer/smartOptimizer.ts`:

1. **הערכת R2 ב-`estimateAllStageCombinations`** — לשלבים עם `useZoneData: true`, לחשב:
   - `numGoodZones × (2 × expansionSteps + 1)` לכל פרמטר (במקום הטווח המלא)
   - ברירת מחדל: 10 zones × 3 ערכים = 30 ערכים לפרמטר (במקום מאות)

2. **Fallback בטוח ל-R2** — אם אין zone data מ-R1, להשתמש ב-`createFineTuneConfig` עם ±2 steps סביב ה-best (במקום לרוץ על הטווח המלא)

## שינוי ספציפי

שורות 536-562 ב-`estimateAllStageCombinations`:
- הוסף בדיקה: `if (stage.useZoneData)` → חשב `numZones * (2*expansion+1)` לכל פרמטר
- זה יתקן את ההערכה מ-~מיליונים ל-~אלפים בודדים

שורות 463-468 (fallback):
- שנה את ה-else (שורה 467) כך שאם זה R2 (`stage.roundNumber === 2`), ישתמש ב-`createFineTuneConfig` במקום `expandConfigForStage`

