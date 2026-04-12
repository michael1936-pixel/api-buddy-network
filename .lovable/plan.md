

## תוכנית: הגבלת קומבינציות R2/S3 (EMA Trend) ל-300,000

### הבעיה
שלב 3 בסיבוב 2 ("דיוק אסטרטגיה 1 EMA Trend") מייצר 14.35M קומבינציות כי:
- יש 15 פרמטרים נומריים
- `tuneRange=1` נותן 3 ערכים לכל פרמטר → 3^15 = 14.3M
- ה-combo guard הקיים (שורה 592) מנסה להוריד tuneRange מ-2→1→0, אבל הוא מתחיל מ-2 ובונה מחדש — לא תופס שהקונפיג כבר נבנה עם tuneRange=1

### הפתרון
שינוי אחד בקובץ `src/lib/optimizer/smartOptimizer.ts`:

**הרחבת ה-combo guard כך שיחול על כל שלב (לא רק R2 ללא customRanges), עם סף של 300,000:**

1. שינוי `MAX_STAGE_COMBOS` מ-5000 ל-300,000
2. הסרת התנאי `!stage.customRanges && stage.roundNumber === 2` — הגנה תחול על כל שלב
3. כשהקומבינציות עדיין חורגות אחרי tuneRange=0, הגנה חדשה: הגבלת מספר הערכים לכל פרמטר (למשל, חיתוך לערכים הקרובים ביותר ל-best) עד שנכנסים ל-300K

**לוגיקה:**
```
MAX = 300,000
combos = countCombos(stageCfg)
if combos > MAX:
  // שלב 1: נסה tuneRange קטן יותר (אם fineTune)
  // שלב 2: אם עדיין חורג, צמצם ערכים פר-פרמטר
  //   חשב maxValuesPerParam = floor(300000^(1/numParams))
  //   לכל פרמטר, שמור רק maxValuesPerParam ערכים הקרובים ל-best
```

עם 15 פרמטרים: 300000^(1/15) ≈ 2.4 → 2 ערכים לכל פרמטר → 2^15 = 32,768 ✅

### קבצים לעדכון
- `src/lib/optimizer/smartOptimizer.ts` — שורות 573-605 (הרחבת combo guard)

### פרטים טכניים
- הפונקציה `createFineTuneConfig` לא תשתנה
- ה-guard החדש יעבוד על `stageCfg` שכבר נבנה, ויחתוך ערכים מתוך ranges קיימים
- לוג ברור: `⚠ Combo cap: ${originalCombos} → ${newCombos} (maxValsPerParam=${n})`
- חשוב: אחרי העדכון כאן, צריך להעתיק שוב ל-railway-server repo ולדחוף

