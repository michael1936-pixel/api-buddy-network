

# תיקון: שגיאת "out of range for type integer"

## הבעיה

הערך `total_combos = 24,414,062,500` חורג ממגבלת `integer` (מקס 2.1 מיליארד). זה קורה גם ב-`optimization_runs` וגם ב-`optimization_run_logs`.

## הפתרון

### 1. מיגרציה — שינוי עמודות מ-integer ל-bigint

שתי טבלאות צריכות עדכון:

**optimization_runs:**
- `current_combo`: integer → bigint
- `total_combos`: integer → bigint

**optimization_run_logs:**
- `current_combo`: integer → bigint
- `total_combos`: integer → bigint
- `combination_cache_size`: integer → bigint
- `indicator_cache_size`: integer → bigint

```sql
ALTER TABLE public.optimization_runs 
  ALTER COLUMN current_combo TYPE bigint,
  ALTER COLUMN total_combos TYPE bigint;

ALTER TABLE public.optimization_run_logs
  ALTER COLUMN current_combo TYPE bigint,
  ALTER COLUMN total_combos TYPE bigint,
  ALTER COLUMN combination_cache_size TYPE bigint,
  ALTER COLUMN indicator_cache_size TYPE bigint;
```

### 2. אין שינוי בקוד

הקוד בצד השרת (Railway) לא צריך שינוי — הוא כבר שולח את המספרים הנכונים, רק הDB לא מקבל אותם.

## תוצאה צפויה

אחרי המיגרציה, ה-ServerLogger יפסיק לזרוק שגיאות ותוכל לראות לוגים נכונים בDB. האופטימיזציה תמשיך לרוץ בלי להיתקע.

