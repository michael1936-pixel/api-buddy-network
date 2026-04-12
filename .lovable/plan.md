

# תיקון: COMBO GUARD הורס את S1 customRanges

## הבעיה

ב-`smartOptimizer.ts` שורה 563 יש:
```text
const MAX_STAGE_COMBOS = 5000;
```

זה רץ על **כל** שלב, כולל S1 עם ה-customRanges שתכננו ל-373K. כשהוא מזהה 373K > 5000, הוא מחליף את הקונפיג ב-`createFineTuneConfig(tuneRange=0)` — ובכך מוריד את הכל ל-1 ערך לפרמטר.

## הפתרון

שורה אחת — לדלג על הCombo Guard כשלשלב יש `customRanges`:

```typescript
// Before the guard check, skip if stage has custom ranges (intentionally designed combo count)
if (combos > MAX_STAGE_COMBOS && !stage.customRanges) {
```

במקום:
```typescript
if (combos > MAX_STAGE_COMBOS) {
```

## קבצים לעדכון

| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/smartOptimizer.ts` | שורה ~590: הוסף `&& !stage.customRanges` לתנאי הguard |
| `/mnt/documents/algomaykl-optimizer/` | אותו שינוי + ZIP חדש להעלאה ל-Railway |

## תוצאה

- S1 R1: ירוץ עם 373K קומבינציות כמתוכנן
- שאר השלבים: Guard ממשיך לפעול רגיל (מגביל ל-5000)
- R2 S1 (isFinalTuning): לא מושפע כי הGuard בודק אחרי יצירת הconfig

