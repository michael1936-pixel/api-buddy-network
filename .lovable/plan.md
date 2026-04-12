
# תיקון “נתקע” באופטימיזציה

## אבחון
- בעיית פיצוץ הקומבינציות כבר תוקנה: הריצות האחרונות ירדו לשלב 9 עם `total_combos = 3600`, לא מיליונים.
- הבעיה הנוכחית היא לייבנס/דיווח התקדמות:
  - `src/stores/optimizationStore.ts` מסמן `slow` אחרי 30 שניות ו-`stalled` אחרי 120 שניות לפי `optimization_runs.updated_at`.
  - לטבלת `optimization_runs` אין trigger/function שמעדכנים `updated_at` אוטומטית.
  - `supabase/functions/start-optimization/index.ts` רק יוצר run ושולח job ל-Railway, בלי heartbeat/watchdog.
  - `src/pages/Backtest.tsx` מציג כפתור “דלג לשלב הבא”, אבל כרגע הוא רק `console.log` ולא באמת עושה כלום.
- המשמעות: אם שרת Railway ממשיך לחשב אבל לא כותב ל-DB מספיק זמן, ה-UI נראה “תקוע” גם כשהריצה אולי עוד חיה. זה גם מסביר למה ריצות אחרונות נגמרו כ-`aborted` — כנראה נעצרו ידנית אחרי אזהרת stall.

## מה אבצע
1. לחזק את ה-UI כאן כדי שלא יטעה:
   - לעדן את לוגיקת ה-stall/store כך שתבדיל בין “אין heartbeat לאחרונה” לבין “הריצה נכשלה באמת”.
   - לשפר את ההודעה ב-`OptimizationProgress` כך שתציג “אין עדכון מהשרת” במקום להסיק מיד שהריצה תקועה.
   - להציג זמן עדכון אחרון בצורה ברורה יותר.
   - להסיר/להשבית זמנית את כפתור הדילוג עד שיהיה backend אמיתי עבורו.

2. להגדיר תיקון אמיתי מול שרת Railway:
   - להוסיף heartbeat קבוע ל-`optimization_runs` כל 10–15 שניות או כל N קומבינציות.
   - לוודא שכל update של progress מעדכן גם `updated_at`.
   - להוסיף try/catch סביב כתיבות progress, ולסמן `failed` + `error_message` במקרה של crash/exception/timeout במקום להשאיר `running`.

3. רק אם צריך, להרחיב את הסכמה:
   - אופציונלית להוסיף `heartbeat_at` או `last_progress_message` אם יתברר ש-`updated_at` לא מספיק אמין.
   - כרגע אעדיף להתחיל בלי שינוי schema, כי ייתכן ש-heartbeat מסודר על אותו שדה יפתור את זה.

## קבצים/אזורים רלוונטיים
- `src/stores/optimizationStore.ts`
- `src/components/backtest/OptimizationProgress.tsx`
- `src/pages/Backtest.tsx`
- `supabase/functions/start-optimization/index.ts` (אם צריך לשפר dispatch/response)
- ריפו Railway החיצוני של האופטימיזר — שם נמצא התיקון העיקרי של heartbeat/progress

## פרט טכני חשוב
התיקון המלא לא יכול להיות רק בפרויקט הזה. השורש האמיתי נמצא בשרת Railway החיצוני, כי הוא זה שאמור לכתוב heartbeat ל-DB בזמן שלבים ארוכים. בלי זה אפשר רק לרכך אזהרות UI, לא לפתור את הבעיה באמת.

## בדיקות אחרי המימוש
- להריץ אופטימיזציה אחת end-to-end ולוודא שבמהלך שלב ארוך ה-DB מתעדכן לפחות כל 10–15 שניות.
- לוודא שה-UI לא מציג “תקוע” כל עוד heartbeat ממשיך להגיע.
- לוודא ש-crash אמיתי מסומן `failed` עם הודעת שגיאה.
- לוודא שכפתור עצירה עדיין עובד, ושאין יותר כפתור דילוג מטעה אם לא חיברנו לו backend.
