

## תיקון 9M קומבינציות + הוספת לוג עסקאות מפורט

### חלק 1: למה עדיין 9 מיליון?

הבעיה: ב-`optimizationStore.ts` ה-cap מחושב כ:
```
allStages.length * 300_000 = 30 × 300,000 = 9,000,000
```
אבל רוב השלבים הם הרבה פחות מ-300K (למשל 23, 15,625, 2,500). ה-cap צריך להיות **סכום האומדנים האמיתיים**, לא מכפלה.

**תיקון**: במקום `allStages.length * 300_000`, לחשב את הסכום מ-`estimateAllStageCombinations`:
```typescript
const estimates = estimateAllStageCombinations(NNE_PRESET_CONFIG);
const maxTotal = Object.values(estimates).reduce((a, b) => a + b, 0);
const totalCombos = Math.min(run.total_combos || 0, maxTotal);
```
זה ייתן מספר ריאלי (בערך 350K-500K סה"כ במקום 9M).

### חלק 2: הדפסת כל העסקאות + סוכן אימות

כרגע ה-DB שומר רק סיכום (return, win_rate, drawdown) ולא את העסקאות עצמן. הפרמטרים האופטימליים נשמרים ב-`optimization_results.parameters`.

**מה צריך:**

1. **טבלת DB חדשה `optimization_trades`** — תשמור את כל העסקאות מההרצה הטובה ביותר:
   - `id`, `optimization_result_id`, `symbol`, `direction`, `entry_time`, `entry_price`, `exit_time`, `exit_price`, `pnl_pct`, `exit_reason`, `strategy`, `bars_held`

2. **שינוי בשרת Railway** — אחרי שהאופטימיזציה מסתיימת, לשמור את מערך ה-`trades` של התוצאה הטובה ביותר לטבלה החדשה (כרגע השרת מוחק את ה-trades: `trades: []`)

3. **UI בדף Backtest** — כשלוחצים על תוצאה בטבלה, נפתח פאנל עם כל העסקאות: כניסה, יציאה, כיוון, רווח/הפסד, סיבת יציאה

4. **סוכן אימות (Verification Agent)** — Edge Function שמקבל את הפרמטרים האופטימליים + דאטה היסטורי, מריץ סימולציה מחדש, ומשווה לתוצאות. מדווח:
   - האם מספר העסקאות תואם
   - האם התשואה תואמת
   - אם יש פער — מאיפה הוא נובע (בר ספציפי, תנאי כניסה שונה, וכו')

### קבצים לעדכון

| קובץ | שינוי |
|---|---|
| `src/stores/optimizationStore.ts` | תיקון חישוב cap ל-totalCombos (סכום estimates) |
| `src/pages/Backtest.tsx` | הוספת פאנל עסקאות בלחיצה על תוצאה |
| DB migration | טבלת `optimization_trades` |
| `supabase/functions/verify-optimization/index.ts` | Edge Function חדש — סוכן אימות |
| Railway server | שמירת trades ל-DB (שינוי בקוד השרת) |

### סדר ביצוע
1. תיקון ה-9M cap (מיידי)
2. יצירת טבלת optimization_trades
3. בניית UI להצגת עסקאות
4. בניית Edge Function לאימות
5. הנחיות לעדכון שרת Railway

### הערה חשובה
שמירת העסקאות ל-DB דורשת שינוי בשרת Railway — כרגע הוא מוחק אותן (`trades: []`). אתן לך את הקוד הנדרש.

