

# תיקון האטה — מחיקת indicatorCache.clear()

## הבעיה
שורה 416 ב-`smartOptimizer.ts`: `indicatorCache.clear()` — מאפסת את כל ה-cache בין rounds. עם 24GB RAM אין סיבה לזה. זה מה שגורם לאיטיות.

## השינוי
**קובץ אחד**: `src/lib/optimizer/smartOptimizer.ts`

מחיקת שורות 415-420 (הבלוק של clear + GC):
```typescript
// DELETE these lines:
      // Clear indicator cache between rounds to free float arrays
      indicatorCache.clear();
      // Force GC at round boundary
      if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
        (globalThis as any).gc();
      }
```

## אחרי התיקון
- ייצור ZIP חדש (`optimizer-bundle-v14.zip`)
- תעתיק רק את `smartOptimizer.ts` ל-Railway ותעשה push

