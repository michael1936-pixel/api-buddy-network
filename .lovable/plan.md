

# תוכנית: חילוץ קבצי ה-Bolt ZIP והשוואה עם הקוד הנוכחי

## מה יקרה
1. **חילוץ ה-ZIP** — אעתיק את הקובץ שהעלית ל-filesystem ואפתח אותו
2. **השוואת 4 קבצים מרכזיים** — אשווה את הקבצים הבאים מ-Bolt מול מה שרץ אצלך ב-Lovable/Railway:
   - `smartOptimizer.ts`
   - `portfolioOptimizer.ts`  
   - `portfolioSimulator.ts`
   - `simulatorV2.ts`
3. **זיהוי הפערים** — אמצא את ההבדלים שגורמים ל-0% תשואה
4. **תיקון** — אעדכן את הקוד ב-edge function ו/או בקבצי ה-optimizer כך שהנתונים יגיעו בפורמט הנכון לשרת Railway

## הבעיה הידועה
`periodSplit` נשלח כ-strings במקום `Date` objects, מה שגורם ל-`preFilterSymbols` לסנן את כל הנרות → 0 עסקאות → 0% תשואה.

## קבצים שישתנו
- `supabase/functions/start-optimization/index.ts` — תיקון פורמט `periodSplit` + `candles`
- ייתכן שגם קבצי optimizer ב-`src/lib/optimizer/` — התאמה לפורמט שהשרת מצפה לו

