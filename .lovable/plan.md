
עדכון אבחון: עכשיו יש לנו הוכחה שהשורש האמיתי הוא לא רק heartbeat חסר אלא crash אמיתי של שרת האופטימיזציה.

מה ראיתי
- בלוגים של Railway מופיע במפורש:
  `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`
- כלומר תהליך ה-Node של האופטימייזר נגמר בגלל זיכרון, סביב תקרת heap של בערך 4GB.
- במקביל, ה-UI כאן עדיין נשען על `optimization_runs.updated_at` כדי להסיק אם השרת "חי".
- בסנאפשוט של ה-backend כרגע קיימת הפונקציה `update_optimization_runs_updated_at()` אבל אין trigger פעיל בפועל, לכן גם עדכוני progress לא בהכרח יעדכנו `updated_at` אוטומטית.
- לכן יש 2 בעיות נפרדות:
  1. השרת החיצוני קורס מ-OOM.
  2. כשהוא קורס, הרשומה נשארת `running` או נראית "תקועה" במקום `failed`.

מה אבצע
1. לתקן את הבעיה האמיתית בשרת Railway
- לעדכן את ריפו ה-Railway החיצוני כך שכל ריצה תעבוד בתוך worker/child process מבודד.
- תהליך האב יישאר חי, יעקוב אחרי ה-worker, ואם ה-worker נסגר/נופל/מקבל exit code חריג:
  - יעדכן את `optimization_runs` ל-`failed`
  - ישמור `error_message` ברור כמו `OOM / process exited unexpectedly`
- להוסיף heartbeat אמיתי כל 10–15 שניות או כל N קומבינציות.

2. להוריד לחץ זיכרון במנוע האופטימיזציה
- לסנכרן/לתקן בשרת Railway את קבצי מנוע האופטימיזציה המקבילים ל:
  - `src/lib/optimizer/smartOptimizer.ts`
  - `src/lib/optimizer/portfolioOptimizer.ts`
  - `src/lib/optimizer/indicatorCache.ts`
  - `src/lib/optimizer/portfolioSimulator.ts`
- לוודא שהשרת לא שומר אובייקטים כבדים לאורך זמן:
  - לשמור רק top-N קליל של פרמטרים/ציון, לא מערכים מלאים של תוצאות
  - לקצץ aggressively את `CombinationCache`
  - לנקות `indicatorCache` ו-zone data מוקדם יותר
  - להוסיף telemetry של `process.memoryUsage()` בתחילת/סוף כל שלב ובכל heartbeat
- אם עדיין צריך: להקטין fan-out של שלבים כבדים (פחות zones / פחות top results).
- רק כפתרון זמני/משלים: להגדיל heap או instance ב-Railway, לא כתחליף לאופטימיזציה בזיכרון.

3. לתקן את אמינות הסטטוס ב-backend
- להחיל בפועל את trigger של `updated_at` על `optimization_runs` (כרגע רואים פונקציה אבל לא trigger פעיל).
- אם צריך, להוסיף שדה מפורש כמו `heartbeat_at` כדי להפריד בין "עוד מחשב" לבין "נפל".
- לעדכן את flow כך שכל progress update ירענן heartbeat, וכל crash יסמן `failed` ולא ישאיר `running`.

4. ליישר את ה-UI למה שבאמת קורה
- להשאיר את ניסוח "אין עדכון מהשרת" במקום להסיק מיד failure.
- אם ריצה נשארת בלי heartbeat מעבר לסף, להציג סטטוס חשוד, אבל כשה-backend מסמן כשל אמיתי להציג `failed` ברור.
- לתקן את תצוגת המונים ב-RTL (כרגע מופיע כמו `3600 / 1150` במקום `1150 / 3600`) עם עטיפת LTR למספרים.
- לתקן גם את ה-warning בקונסול של `Function components cannot be given refs` באזור progress card, כנראה דרך `Badge`/קומפוננטה דומה שלא משתמשת ב-`forwardRef`.

קבצים/אזורים שאגע בהם
- בפרויקט הזה:
  - `src/stores/optimizationStore.ts`
  - `src/components/backtest/OptimizationProgress.tsx`
  - `src/components/ui/badge.tsx`
  - `supabase/functions/start-optimization/index.ts`
  - migration ל-`optimization_runs`
- בריפו Railway החיצוני:
  - ה-runner / endpoint שמריץ `/api/optimize`
  - מנוע האופטימיזציה והעדכונים ל-DB בזמן ריצה

חשוב
- בלי גישה לריפו Railway אפשר רק לשפר UI ודיווח.
- כדי להפסיק את ה-"נתקע" באמת, חייבים לתקן את ה-crash של הזיכרון בשרת החיצוני.

בדיקות אחרי המימוש
- להריץ אופטימיזציה אחת end-to-end ולוודא שבמהלך ריצה יש heartbeat קבוע.
- לוודא שאם ה-worker נופל, הרשומה עוברת ל-`failed` תוך זמן קצר עם `error_message`.
- לוודא שאין יותר מצב של `running` תקוע אחרי crash.
- לוודא שמונה הקומבינציות מוצג נכון ב-RTL.
- לוודא שה-warning של refs נעלם מהקונסול.
