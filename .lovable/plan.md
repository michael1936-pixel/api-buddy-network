

# תיקון OOM בלי להוריד מספר קומבינציות

## הבעיה
השרת קורס ב-OOM (V8 FatalProcessOutOfMemory) כי שלושה מבני נתונים גדלים ללא הגבלה:

1. **`round1Zones`** (שורה 340) — שומר את **כל** התוצאות מ-Round 1 (`collectAll = true`). לדוגמה 36,000 קומבינציות × אובייקט params מלא = עשרות MB
2. **`CombinationCache`** (שורה 335) — מצטבר לאורך כל 30 השלבים, לעולם לא מתנקה
3. **`IndicatorCacheManager`** (שורה 337) — שומר חישובי אינדיקטורים לכל שילוב פרמטרים ייחודי

## פתרון — ניקוי זיכרון חכם (בלי לשנות כמות קומבינציות)

### 1. הגבלת `round1Zones` — שמירת Top N בלבד
**קובץ:** `src/lib/optimizer/smartOptimizer.ts`

במקום לשמור את כל `allTestedResults` (שורה 511), נשמור רק Top 200 תוצאות (ממוינות לפי trainReturn). זה מספיק בשביל `collectTopZones` שלוקח רק 10 zones.

```
if (collectAll && result.allTestedResults) {
  // Keep only top 200 instead of all results
  const sorted = result.allTestedResults
    .sort((a, b) => b.trainReturn - a.trainReturn)
    .slice(0, 200);
  round1Zones[si] = sorted;
}
```

### 2. ניקוי `round1Zones` אחרי Round 2
**קובץ:** `src/lib/optimizer/smartOptimizer.ts`

אחרי שכל שלבי Round 2 סיימו, `round1Zones` כבר לא נחוץ:

```
// After Round 2 ends (stage transitions to Round 3)
if (stage.roundNumber === 3 && Object.keys(round1Zones).length > 0) {
  for (const key in round1Zones) delete round1Zones[key];
}
```

### 3. ניקוי `CombinationCache` בין סיבובים
**קובץ:** `src/lib/optimizer/smartOptimizer.ts`

בתחילת כל סיבוב חדש, לנקות entries שלא מסומנים כ-protected:

```
// At round boundary, evict non-protected entries
if (prevRound !== stage.roundNumber) {
  for (const [key, entry] of cache) {
    if (!entry.protected) cache.delete(key);
  }
}
```

### 4. הוספת LRU limit ל-`IndicatorCacheManager`
**קובץ:** `src/lib/optimizer/indicatorCache.ts`

הגבלה ל-50 entries (כל entry הוא מערכי float גדולים):

```
getOrCompute(candles, params) {
  // ... existing logic ...
  if (this.cache.size > 50) {
    const firstKey = this.cache.keys().next().value;
    this.cache.delete(firstKey);
  }
}
```

### 5. ניקוי `allTestedResults` מתוך `optimizePortfolio`
**קובץ:** `src/lib/optimizer/portfolioOptimizer.ts`

מערך `allResults` (שורה 145) גדל ל-36K entries. במקום לשמור הכל, נשמור heap של Top 200 תוך כדי:

```
// Instead of pushing all results, maintain sorted top-N
if (collectAllResults) {
  if (allResults.length < 200 || trainReturn > allResults[allResults.length - 1].trainReturn) {
    allResults.push({ params, trainReturn });
    allResults.sort((a, b) => b.trainReturn - a.trainReturn);
    if (allResults.length > 200) allResults.length = 200;
  }
}
```

## סיכום שינויים

| קובץ | שינוי | חיסכון זיכרון |
|-------|--------|---------------|
| `smartOptimizer.ts` | Top 200 ב-round1Zones + ניקוי אחרי R2 | ~90% מ-round1Zones |
| `smartOptimizer.ts` | ניקוי cache non-protected בין סיבובים | ~70% מ-cache |
| `indicatorCache.ts` | LRU limit של 50 | מונע גדילה אינסופית |
| `portfolioOptimizer.ts` | Top 200 ב-allResults | ~95% מ-allResults |

## מה לא משתנה
- מספר הקומבינציות שנבדקות — **זהה לחלוטין**
- הלוגיקה של zones, fine-tune, strategy combination — **ללא שינוי**
- רק הנתונים שנשמרים **בזיכרון** מצטמצמים

## המלצה נוספת (Railway)
גם אחרי התיקונים, מומלץ להוסיף ב-Railway:
- `NODE_OPTIONS=--max-old-space-size=4096`
- שדרוג instance ל-1GB+ RAM

