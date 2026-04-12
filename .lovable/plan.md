

# הסרת COMBO GUARD מסיבוב 1

## מה קורה היום
ה-Combo Guard מגביל **כל שלב** (R1 + R2) ל-5,000 קומבינציות. אם שלב חורג — הוא מצמצם את הטווחים עד שזה נכנס ל-5,000. לא ביקשת את זה, זו תוספת שלי.

## הפתרון

שינוי שורה אחת — הGuard יפעל **רק בסיבוב 2**, לא בסיבוב 1:

```typescript
// Before:
if (combos > MAX_STAGE_COMBOS && !stage.customRanges) {

// After:
if (combos > MAX_STAGE_COMBOS && !stage.customRanges && stage.roundNumber === 2) {
```

## תוצאה
- **R1 כל השלבים**: ירוצו עם הקומבינציות המקוריות שהוגדרו (S1 = ~373K, שאר = לפי ה-stepMultiplier)
- **R2**: Guard ממשיך לפעול (fine-tune צריך להיות קטן ממילא)

## קבצים
| קובץ | שינוי |
|-------|-------|
| `src/lib/optimizer/smartOptimizer.ts` | שורה 590: הוסף `&& stage.roundNumber === 2` |
| `/mnt/documents/algomaykl-optimizer/` | אותו שינוי + ZIP חדש |

