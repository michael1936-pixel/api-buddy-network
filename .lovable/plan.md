

# תיקון פיצוץ קומבינציות בסיבוב 2

## הבעיה
`createZoneConfig` יוצר **מכפלה קרטזית** של ערכי zones לכל פרמטר. כשלב (כמו ATR Squeeze) יש 6 פרמטרים נומריים עם ~7 ערכי zone כל אחד:
- 7^6 = **~118,000** קומבינציות לשלב אחד
- במקום ~2,000-3,000 שהיה אמור להיות

זו הסיבה שסיבוב 2 לוקח מיליוני קומבינציות במצטבר.

## פתרון — הגבלת קומבינציות ב-zone config
ב-`src/lib/optimizer/smartOptimizer.ts`, **לפני** שקוראים ל-`optimizePortfolio` עם zone config, לבדוק כמה קומבינציות נוצרו. אם יותר מ-5,000 — fallback ל-`createFineTuneConfig` (שנותן 5^n × 4 = כמה אלפים מקסימום).

```
// After building zone config, check combo count
const numericParamsCount = stage.parametersToOptimize.filter(k => !BOOLEAN_PARAMS_SET.has(k));
// Estimate combos from zone values
let estimatedCombos = 1;
for (const key of numericParamsCount) {
  const val = (stageCfg as any)[key];
  if (val?.values?.length) estimatedCombos *= val.values.length;
}
if (estimatedCombos > 5000) {
  console.log(`⚠ Zone config too large (${estimatedCombos}), falling back to fine-tune`);
  stageCfg = createFineTuneConfig(baseConfig, bestParams, stage.parametersToOptimize, 2);
}
```

## קבצים שישתנו
| קובץ | שינוי |
|-------|--------|
| `src/lib/optimizer/smartOptimizer.ts` | הוספת בדיקת combo count אחרי `createZoneConfig`, fallback ל-fine-tune אם חורג |

## מה לא משתנה
- מספר ה-zones שנאספים ב-Round 1
- הלוגיקה של Round 1 ו-Round 3
- שלבים עם מעט פרמטרים (Long, Short, Bollinger) ימשיכו להשתמש ב-zones כרגיל

## תוצאה צפויה
- Round 2 ירד מ-~23M קומבינציות ל-~20K-30K
- זמן ריצה של Round 2 ירד מעשרות דקות לדקה-שתיים
- איכות התוצאות לא תיפגע — fine-tune ±2 סביב הערכים הטובים מ-R1 הוא בדיוק מה שצריך

