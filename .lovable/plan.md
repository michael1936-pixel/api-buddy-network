

# תיקון OOM בשלב 8-9 (סיבוב 2 — Zone Tuning)

## הבעיה
הנתונים ב-DB מראים דפוס חוזר: כל ריצה מתה בשלב 8-9 (דיוק ניהול לונג/שורט). אלה שלבי Round 2 שמשתמשים ב-`useZoneData` — אוספים את כל תוצאות Round 1 לזיכרון כדי למצוא "אזורי ניצחון". זה גורם ל-OOM crash של ה-worker.

## הפתרון — 3 שינויים

### 1. ניקוי זיכרון בין שלבים (`smartOptimizer.ts`)
- אחרי כל שלב: לנקות את `combinationCache`, לשחרר מערכים גדולים
- לקרוא `global.gc?.()` בין שלבים
- להגביל את `collectTopZones` ל-top 50 zones במקום כולם

### 2. הגבלת תוצאות Round 1 שנשמרות
- במקום לשמור את **כל** תוצאות Round 1, לשמור רק top 200 לפי trainReturn
- זה מספיק לחישוב zones איכותי בלי להרוג את הזיכרון

### 3. עדכון `workers/optimizer-worker.ts` 
- הוספת `global.gc?.()` אחרי כל שלב (לא רק כל 500 combos)
- לוג של `process.memoryUsage()` בין שלבים לדיבוג

## קבצים שישתנו
- `src/lib/optimizer/smartOptimizer.ts` — ניקוי cache + הגבלת zones
- צריך לייצר ZIP חדש לריפו ב-GitHub

## הערה
השינויים האלה הם בקוד ה-optimizer שרץ גם בשרת Railway. אייצר ZIP מעודכן שתעלה ל-GitHub.

