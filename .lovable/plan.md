

# תיקון ביצועים — הסרת ניקוי cache אגרסיבי

## הבעיה
בשורות 230-250 של `portfolioOptimizer.ts`, כל 200 קומבינציות:
- נמחק ה-indicator cache (float arrays ענקיים) — ואז מחושב מאפס
- מופעל GC ידני
- זה גורם ל-172 combos/sec במקום אלפים

## התיקון

### קובץ: `src/lib/optimizer/portfolioOptimizer.ts` שורות 229-251

הסרת הניקוי האגרסיבי. במקום זה:
- **indicator cache** — לא לנקות בכלל (ה-LRU ב-IndicatorCacheManager מגביל ל-50 ערכים, מספיק)
- **combination cache** — להשאיר את ה-prune רק אם הגודל עובר 1000 (במקום 300)
- **GC ידני** — להסיר לגמרי (Node.js מנהל את זה לבד עם 24GB)

```typescript
// Intra-stage memory cleanup every 500 combos (light touch)
if (current > 0 && current % 500 === 0) {
  if (combinationCache && combinationCache.size > 1000) {
    let pruned = 0;
    for (const [key, entry] of combinationCache) {
      if (!entry.protected) {
        combinationCache.delete(key);
        pruned++;
      }
      if (combinationCache.size <= 500) break;
    }
    if (pruned > 0) console.log(`🧹 Intra-stage prune: removed ${pruned} cache entries (now ${combinationCache.size})`);
  }
}
```

### קובץ: `src/lib/optimizer/indicatorCache.ts`

הגדלת ה-maxSize מ-50 ל-500 (יש 24GB RAM):
```
maxSize = 500
```

## תוצאה
- indicator cache לא נמחק באמצע שלב — חישוב אינדיקטורים פעם אחת בלבד
- GC לא מופעל ידנית — Node.js מנהל לבד
- combination cache מנוקה רק מעל 1000 ערכים
- צפי: חזרה ל-5,000-10,000+ combos/sec

## חבילה מעודכנת
אייצר חבילת Railway מעודכנת עם התיקון.

