

# V18 — הוספת Regression Detection + השוואה סופית

## מה חסר

### 1. Regression Detection (סעיף 8 במסמך)
בסוף כל שלב מסיבוב 2 ואילך, צריך לבדוק:
```
if (roundNumber >= 2 && stageTrainReturn < globalBestTrain) → rollback
```
אם השלב הנוכחי החזיר תוצאה גרועה מהגלובלית — מחזירים את הפרמטרים שהשלב שינה לערכי globalResult.bestForProfit.parameters.

### 2. השוואה סופית (סעיף 9 במסמך)
לפני return בשורה 719, צריך:
```typescript
// Compare fine-tuned bestParams vs global best
const fineTunedAvg = (lastStageTrainReturn + lastStageTestReturn) / 2;
const globalAvg = globalResult.bestForProfit ? 
  (globalResult.bestForProfit.totalTrainReturn + globalResult.bestForProfit.totalTestReturn) / 2 : -Infinity;

if (globalAvg > fineTunedAvg) {
  // Global wins — use its parameters
  finalResult = globalResult;
} else {
  // Fine-tuned wins — run one last simulation with bestParams to get full result
}
```

### 3. bestForTestPeriod (4th objective)
הוספת יעד רביעי ל-MultiObjectiveResult שבוחר לפי testReturn בלבד.

## קבצים שישתנו
1. **`src/lib/optimizer/smartOptimizer.ts`** — הוספת regression detection בלולאה הראשית (אחרי שורה 688) + השוואה סופית לפני return
2. **`src/lib/optimizer/multiObjectiveMetrics.ts`** — הוספת bestForTestPeriod
3. **`src/lib/optimizer/types.ts`** — עדכון MultiObjectiveResult type

## מה ייווצר
חבילת `railway-server-v18.tar.gz` מעודכנת עם כל השינויים.

