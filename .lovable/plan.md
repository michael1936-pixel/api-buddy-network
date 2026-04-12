

## צמצום הצגת קומבינציות מ-1.27M למספר ריאלי

### הבעיה
`estimateAllStageCombinations` מחזיר `Math.min(300_000, count)` לכל שלב. שלב 4 (EMA Trend) באמת מגיע ל-300K, אבל שאר השלבים קטנים בהרבה. הסכום יוצא ~1.27M. 

אבל ה-**שרת** שולח `total_combos` שמייצג את המספר האמיתי — ולאחר מכן ה-UI עושה `Math.min(server_total, 1.27M)`. אם השרת שולח 1.27M, זה לא נחתך.

### הפתרון
במקום להשתמש ב-`REALISTIC_MAX_TOTAL` כ-cap קשיח, פשוט להציג את מה שהשרת שולח **כפי שהוא** — כי אחרי ה-combo guard שתיקנו בשרת, ה-`total_combos` כבר נכון.

### שינויים

**`src/stores/optimizationStore.ts`**:
- הסרת `REALISTIC_MAX_TOTAL` וה-`Math.min` — להשתמש ישירות ב-`run.total_combos`
- כ-safety net, להשאיר cap של 500K (5 אסטרטגיות × ~100K max = סביר)

```typescript
// הסרה:
const REALISTIC_MAX_TOTAL = ...
// החלפה:
const totalCombos = run.total_combos || 0;
```

אם עדיין רוצים cap, אפשר `Math.min(run.total_combos || 0, 500_000)` — אבל אם השרת כבר מדווח נכון אחרי ה-guard, אין צורך.

### קבצים
| קובץ | שינוי |
|---|---|
| `src/stores/optimizationStore.ts` | הסרת REALISTIC_MAX_TOTAL, שימוש ישיר ב-total_combos מהשרת |

