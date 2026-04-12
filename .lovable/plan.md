

## הגבלת מספר הקומבינציות ל-100,000

### שינוי (קובץ יחיד)

**`src/stores/optimizationStore.ts`** — שורה 109:

```typescript
// לפני:
total: Math.max(overallTotal, completedCombos + totalCombos),

// אחרי:
total: Math.min(Math.max(overallTotal, completedCombos + totalCombos), 100_000),
```

זה יגביל את התצוגה ל-100K מקסימום, לא משנה מה השרת מדווח.

