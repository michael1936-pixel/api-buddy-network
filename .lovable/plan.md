
כיוון מדויק

אני לא מתכוון לנחש יותר. מה שמאומת מהקוד ומהצילומים:

- הקריסה עצמה לא קורית ב-React app הזה אלא בשרת Railway החיצוני. כאן `supabase/functions/start-optimization/index.ts` רק יוצר `optimization_runs` ואז עושה POST ל-`/api/optimize` ב-Railway.
- לכן עוד שינוי עיוור ב-`src/lib/optimizer/*` בלבד לא יפתור את ה-process שנופל.
- כן מצאתי פה באג אמיתי שצריך לתקן: `src/lib/optimizer/indicatorCache.ts` בונה cache key רק לפי פרמטרים, בלי symbol/train/test/dataset. זה יוצר reuse שגוי בין train/test ואפילו בין סימבולים שונים.
- ויש גם באג UI: `src/components/backtest/OptimizationProgress.tsx` קשיח על 7 שלבים לכל round, בזמן שבפועל `src/lib/optimizer/smartOptimizer.ts` מגדיר 30 שלבים (7+7+16), אז הממשק יכול להציג מצב מטעה של “נתקע”.

מה אבנה אחרי אישור

1. לוג אמיתי מהשרת אל המסך
- אוסיף טבלת `optimization_run_logs` עם שדות כמו:
  `run_id, symbol, stage_number, stage_name, round_number, current_combo, total_combos, heap_used_mb, heap_total_mb, combination_cache_size, indicator_cache_size, message, created_at`
- אעדכן את `/backtest` כדי להציג live log של הריצה הפעילה, כך שתראה כאן ממש שורות כמו:
```text
R2/S10 NNE combo 457/500 heap 457MB cache=198 indicatorCache=5
```
- לא אסתמך יותר רק על `updated_at` ו-`error_message`.

2. אינסטרומנטציה במקום שבו זה באמת נופל
- אכין patch מוכן לריפו Railway האמיתי — לקובץ שמוציא את לוגי ה-`[NNE] heartbeat` ול-entry של `/api/optimize`.
- אוסיף checkpoint קבוע:
  - בתחילת כל stage
  - כל N קומבינציות
  - לפני/אחרי prune/GC
  - בחריגת זיכרון
  - ב-error/exit
- כל checkpoint ייכתב גם ל-console וגם לטבלת הלוגים, כדי שלא נאבד את המיקום האחרון לפני crash.

3. Memory guard במקום blackout
- אוסיף guard שמזהה עלייה מסוכנת בזיכרון, כותב לוג סופי עם stage+combo+heap, ומפסיק את הריצה בצורה נשלטת לפני OOM קשיח.
- כך גם אם עוד יש בעיה, נקבל מיקום מדויק במקום “שוב נתקע”.

4. תיקון באגי correctness שכבר מצאתי
- `indicatorCache.ts`: לשנות key כך שיכלול dataset identity אמיתי (לפחות symbol + phase train/test + candle count/date range, או hash יציב של הסדרה).
- אם אותם קבצי optimizer משותפים גם ל-Railway, אעדכן את אותו תיקון גם שם.
- `OptimizationProgress.tsx`: לתקן את round 3 והחישוב של total stages/progress כדי שישקפו 30 שלבים אמיתיים.

5. אימות end-to-end
- אבדוק תרחיש שחוזר על NNE / Stage 10.
- אאשר שיש live logs במסך, שהריצה או מסתיימת או נכשלת עם שורת לוג ברורה, ושאין יותר מצב של “נתקע” בלי לדעת איפה.

פרטים טכניים

- השינוי פה יתחלק ל-2 חלקים:
  1. שינויים בפרויקט הזה: DB + UI ללוגים + תיקון progress UI
  2. patch bundle מוכן לריפו Railway: instrumentation + memory guard + תיקון cache key אם הקוד שם ממורקר/מועתק
- אני לא הולך “להקטין cache שוב” בלי מדידה. קודם נוסיף observability אמיתי למסלול שרץ ב-Railway, ואז נזהה אם הבעיה היא stage ספציפי, growth pattern בזיכרון, או קוד שרץ בריפו אחר מהקוד שכאן.

התוצאה הצפויה

- לוג חי בתוך האפליקציה, לא רק ב-Railway
- זיהוי מדויק של symbol/stage/combo/heap לפני נפילה
- תיקון באג cache אמיתי שפוגע באמינות התוצאות
- UI שמציג את ההתקדמות האמיתית
- וגם אם השרת ייכשל שוב, תהיה שורת אבחון ברורה במקום “נתקע”
