
מה מצאתי

1. האופטימיזציות כן נשמרות במסד הנתונים.
   בדקתי את `optimization_results` ויש שם רשומות אחרונות ל-`AAPL` ו-`NNE`.

2. הסיבה שזה נראה כאילו "לא נשמר":
   ב-`src/hooks/use-trading-data.ts` הפונקציה `useOptimizationResults()` טוענת רק:
   `optimization_results WHERE is_active = true`
   אבל כל התוצאות האחרונות במסד הן `is_active = false` עם `agent_decision = 'rejected'`.
   כלומר: הן נשמרו, אבל ה-UI מסתיר אותן.

3. יש גם באג שקט בשמירה:
   ב-`src/stores/optimizationStore.ts` יש `insert` ל-`optimization_results`, אבל לא נבדק `error`.
   אם שמירה תיכשל, כרגע לא תקבל שגיאה ברורה.

4. לגבי "היא מתאפסת כשאני עובר עמוד":
   - לא מצאתי קוד שעוצר אופטימיזציה במעבר route
   - `stopOptimization()` נקראת רק ידנית
   - אבל גם לא מצאתי `new Worker` פעיל; כרגע `runSmartOptimization()` רץ מתוך ה-store על ה-main thread
   - לכן יש 2 מצבים:
     - מעבר פנימי בתוך האפליקציה: ה-state אמור להישאר רק בזיכרון
     - refresh / יציאה / סגירת טאב: הכול מתאפס, כי אין persistence של ריצה פעילה ואין backend job

מה צריך לבנות

1. לתקן את "לא נשמר"
   - ליצור hook נפרד ל"כל תוצאות האופטימיזציה"
   - להפסיק לסנן רק `is_active = true` במסך Backtest
   - להוסיף פילטר ברור: הכל / מאושרות / נדחו

2. לתקן שמירה שקטה
   - לבדוק `error` אחרי `insert`
   - אם יש כשלון: לעדכן store, להציג toast, ולרשום log ברור

3. לתקן reset של ריצה
   - להוסיף טבלת `optimization_runs` ב-Lovable Cloud
   - לשמור שם ריצה פעילה: `status`, `symbol`, `current_stage`, `current`, `total`, `best_train`, `best_test`, `updated_at`
   - בתחילת ריצה ליצור רשומת `running`
   - כל כמה שניות לעדכן progress
   - בסיום לסמן `completed` / `failed` / `aborted`

4. להחזיר state כשחוזרים לעמוד
   - להוסיף `rehydrate` ל-`optimizationStore`
   - בטעינת האפליקציה/חזרה ל-Backtest, לטעון את הריצה האחרונה ולהציג אותה מחדש
   - להוסיף אינדיקטור קטן ב-navbar שאומר שאופטימיזציה רצה ברקע

5. אם אתה רוצה שהיא תמשיך גם אחרי refresh / logout / סגירת טאב
   - זה כבר לא מספיק בזיכרון של הדפדפן
   - צריך להעביר את הרצת האופטימיזציה ל-job ב-Lovable Cloud, וה-UI רק יעקוב אחרי הסטטוס

קבצים שישתנו

- `src/hooks/use-trading-data.ts` — hook לכל התוצאות, בלי סינון קשיח
- `src/pages/Backtest.tsx` — טבלת תוצאות עם rejected/approved + פילטרים
- `src/stores/optimizationStore.ts` — בדיקת שגיאות insert + progress persistence + rehydrate
- `src/components/AppLayout.tsx` — אינדיקטור ריצה גלובלי
- migration חדשה — `optimization_runs` + RLS מתאים

פרטים טכניים

```text
היום:
runOptimization -> חישוב בזיכרון -> save רק בסוף
Backtest query -> מציג רק is_active=true
refresh/close -> מאפס הכול

אחרי התיקון:
start -> create optimization_run(running)
progress -> update optimization_run every few seconds
finish -> insert optimization_result + mark run completed
UI -> show all results, not only approved
app load/backtest return -> restore latest run from database
```

מסקנה קצרה

הבעיה הראשונה היא לא "אין שמירה" אלא "יש שמירה, אבל אתה מציג רק תוצאות מאושרות".
הבעיה השנייה היא שהריצה עצמה לא נשמרת כ-job מתמשך, ולכן כל יציאה אמיתית מה-session מאפסת אותה.
