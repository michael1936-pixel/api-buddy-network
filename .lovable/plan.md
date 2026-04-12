

## הגבלת שלב אסטרטגיה 3 (Breakout) ל-100K קומבינציות בכל סיבוב

### מה יתוקן

1. **`src/lib/optimizer/smartOptimizer.ts`** — בפונקציה `estimateAllStageCombinations` (שורה 775):
   - במקום cap גלובלי של 300K לכל שלב, נזהה שלבים שהם S3 (parametersToOptimize כולל `s3_breakout_len`) ונגביל אותם ל-100K
   - שאר השלבים נשארים עם cap של 300K

2. **`src/stores/optimizationStore.ts`** — שורה 109:
   - להסיר את ה-`Math.min(..., 100_000)` הכללי שהוספנו קודם — זה הגביל את **כל** הסך הכולל ל-100K במקום רק S3

### שינויים

**`src/lib/optimizer/smartOptimizer.ts`** שורה 775:
```typescript
// לפני:
estimates[i + 1] = Math.min(300_000, Math.max(1, count));

// אחרי:
const isS3Stage = stage.parametersToOptimize.some(p => p.startsWith('s3_'));
const cap = isS3Stage ? 100_000 : 300_000;
estimates[i + 1] = Math.min(cap, Math.max(1, count));
```

**`src/stores/optimizationStore.ts`** שורה 109:
```typescript
// לפני:
total: Math.min(Math.max(overallTotal, completedCombos + totalCombos), 100_000),

// אחרי:
total: Math.max(overallTotal, completedCombos + totalCombos),
```

**`.lovable/plan.md`** — עדכון התיעוד.

