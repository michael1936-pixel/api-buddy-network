

## הבעיה: 24.41B קומבינציות — באג בשרת, לא ב-UI

### ניתוח
בדקתי את ה-DB. ההרצות האחרונות (#40-#42) מדווחות `total_combos = 24,414,062,500` (24.41 מיליארד). לעומת זאת, הרצות #38-#39 שהצליחו הראו `total_combos = 16,236`.

**המספר 24.41B נראה כמו מכפלה** של כל הקומבינציות בכל השלבים (multiply) במקום **סכום** (sum). השרת כנראה עושה:
```
total = stage1_combos × stage2_combos × stage3_combos × ...
```
במקום:
```
total = stage1_combos + stage2_combos + stage3_combos + ...
```

### מה צריך לתקן

**בשרת Railway** — למצוא את המקום שמחשב `total_combos` ולשנות מ-multiply ל-sum. כל שלב רץ **בנפרד** אז הסכום הכולל הוא **סכום** ולא מכפלה.

### מה לתקן ב-Lovable (UI)

1. **Runtime error** — יש שגיאת `REALISTIC_MAX_TOTAL is not defined` מ-build ישן. צריך לוודא שה-build נקי (כנראה יספיק rebuild).

2. **Safety cap ב-UI** — להוסיף cap של 2,000,000 כ-safety net בצד ה-UI, כדי שגם אם השרת שולח מספר מטורף, ה-UI לא יציג 24 מיליארד:

```typescript
const totalCombos = Math.min(run.total_combos || 0, 2_000_000);
```

### קבצים

| קובץ | שינוי |
|---|---|
| `src/stores/optimizationStore.ts` | הוספת safety cap של 2M על totalCombos |
| שרת Railway | תיקון חישוב total_combos מ-multiply ל-sum |

### הנחיה לשרת Railway
אתן לך את השורה לשנות בשרת — תצטרך לחפש איפה מחושב `total_combos` ולהחליף מ-`reduce((a,b) => a*b)` ל-`reduce((a,b) => a+b)`.

