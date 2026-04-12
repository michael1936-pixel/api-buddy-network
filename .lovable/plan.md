

# תיקון אופטימיזציית שרת — שתי בעיות

## מה מצאתי

1. **השרת `selfless-kindness` רץ עם Memory limit: 12MB** — זה קטן מדי. ה-payload עם 12,374 נרות בלבד הוא כמה MB, בלי לדבר על חישוב אינדיקטורים ואופטימיזציה. השרת כנראה קורס מ-OOM (Out of Memory) ומחזיר 502.

2. **ה-edge function שולחת את כל הנתונים סינכרוני** — היא ממתינה לתשובה מ-Railway, שיכולה לקחת דקות. Edge functions יש להן timeout (בדרך כלל 60 שניות), אז גם אם השרת היה עובד, הפונקציה הייתה עושה timeout.

## מה צריך לעשות

### שלב 1: הגדלת זיכרון ב-Railway (עליך לעשות)
ב-Railway → `selfless-kindness` → Settings → Resources:
- **הגדל את ה-Memory ל-512MB לפחות** (מומלץ 1GB)
- זה השינוי הקריטי ביותר — 12MB זה פשוט בלתי אפשרי

### שלב 2: שינוי ה-edge function ל-fire-and-forget (אני אעשה)
במקום לחכות לתשובה מ-Railway (ו-timeout), הפונקציה:
- תשלח את הבקשה ל-Railway **בלי לחכות לתוצאה**
- תחזיר מיד את ה-`run_id` ללקוח
- Railway יעדכן את ה-DB ישירות עם progress/results (כמו שהוא כבר עושה)

### שלב 3: הוספת error handling טוב יותר (אני אעשה)
- לוג של גודל ה-payload שנשלח
- timeout מפורש על ה-fetch ל-Railway
- הודעות שגיאה ברורות יותר

## סיכום
| בעיה | פתרון | מי |
|-------|--------|-----|
| Memory 12MB | הגדלה ל-512MB+ | אתה ב-Railway |
| Edge function timeout | fire-and-forget | אני |
| Error messages ריקות | logging טוב יותר | אני |

**הדבר הראשון והקריטי: להגדיל את הזיכרון ב-Railway. בלי זה שום דבר לא יעבוד.**

