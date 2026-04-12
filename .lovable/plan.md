
# אבחון מדויק לבעיה של "10 קומבינציות"

## מה בדקתי
- בקוד הנוכחי `smartOptimizer.ts` ה-Combo Guard כבר מוגבל ל-`roundNumber === 2`, לכן הוא לא אמור לחנוק את שלב 1 בסיבוב 1.
- לפי אותו קוד, שלב 1 בסיבוב 1 אמור להיות בערך `37,800`, שלב 2 בערך `36,000`, ורק S1 אמור להיות `373,248`.
- אבל בריצות האחרונות שנשמרו בבסיס הנתונים השרת כבר מדווח על `stage 3` עם `373,248`, ואין כרגע telemetry ששומר במפורש כמה קומבינציות רצו בפועל בשלבים 1-2.

## מסקנה
כרגע יש 2 אפשרויות:
1. שרת Railway לא מריץ בדיוק את אותה גרסה שאנחנו רואים כאן.
2. השרת כן רץ נכון, אבל ה-UI מטעה: הוא מציג progress גלובלי של ה-stage הפעיל מתוך `optimization_runs`, בלי רישום מפורש של start/end לכל stage, ולכן אפשר לראות `10/729` תחת label לא נכון.

## מה איישם
1. אוסיף בשרת/`smartOptimizer` חישוב רשמי של `plannedCombos` לפני תחילת כל stage, עם log מפורש:
```text
START R1/S1 Long Management | source=expandConfig | combos=37800
START R1/S2 Short Management | source=expandConfig | combos=36000
START R1/S3 S1 EMA | source=customRanges | combos=373248
```
2. אוסיף log סיום לכל stage עם `actualTestedCombinations`, כדי לדעת אם stage באמת רץ מלא או עבר fine-tune/skip.
3. אבדוק ואקשיח את ה-branch שבונה `stageCfg` כך שכל שלב ב-R1:
   - S1 EMA ישתמש רק ב-`customRanges`
   - כל שאר השלבים ישתמשו רק ב-`expandConfigForStage`
   - שום `createFineTuneConfig` ושום Combo Guard לא יוכלו לגעת ב-R1
4. אעדכן את שכבת ה-progress באפליקציה:
   - `optimizationStore` יקרא stage logs מפורשים
   - `OptimizationProgress` יציג את המספר האמיתי של כל stage, לא רק estimate סטטי ולא רק `current_combo/total_combos` הגלובליים
5. אם יתברר שהבעיה היא בגרסת Railway החיצונית ולא בקוד של הפרויקט הזה, אעדכן גם את תיקיית/ZIP השרת שהעלית ל-Railway כדי ששני הצדדים יהיו מסונכרנים.

## קבצים שיידרשו לעדכון
- `src/lib/optimizer/smartOptimizer.ts` — ספירת קומבינציות אמיתית + logs + הקשחת מסלול R1
- `src/stores/optimizationStore.ts` — קריאת stage logs אמיתיים
- `src/components/backtest/OptimizationProgress.tsx` — הצגת planned/actual per stage
- אם צריך: העתק השרת החיצוני שעל Railway (`algomaykl-optimizer/optimizer/smartOptimizer.ts` ב-ZIP/תיקיית השרת)

## תוצאה צפויה
- נדע בוודאות אם שלב 1 באמת רץ עם `37,800` או נחתך ל-`729`
- ה-UI יפסיק להציג `10/729` תחת stage לא נכון
- רק אסטרטגיה 1 בסיבוב 1 תישאר חריגה עם `373,248`; שאר שלבי R1 יחזרו למספרים המקוריים לפי ה-PDF

## פרטים טכניים
- R1 Stage 1 expected: `3 × 9 × 8 × 5 × 5 × 7 = 37,800`
- R1 Stage 2 expected: `4 × 9 × 8 × 5 × 5 × 5 = 36,000`
- R1 Stage 3 expected: `3^6 × 2^9 = 373,248`

אני לא אתקן עכשיו "על עיוור" עוד range או עוד guard; קודם אוסיף telemetry חד-משמעי ואז אתקן בדיוק בנקודה שמקצרת את R1 אם אכן יש קיצור כזה.
