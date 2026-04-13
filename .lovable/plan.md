

# תיקון מהירות אופטימיזציה מקומית — 3 בעיות ביצועים

## מה מצאתי

### בעיה 1: BB מחושב 3 פעמים במקום פעם אחת (קריטי)
ב-`indicatorCache.ts` שורות 116-119, `calculateBBPine` נקרא **3 פעמים** עם אותם פרמטרים בדיוק — פעם ל-basis, פעם ל-upper, פעם ל-lower. כל קריאה רצה על 12K+ נרות. זה אמור להיות קריאה אחת.

### בעיה 2: derivedCache עם eviction
ב-`portfolioSimulator.ts` שורות 107-157, ה-`derivedCache` מוגבל ל-2000 entries ומוחק entries ישנים. כש-cache miss קורה, נדרש חישוב rolling arrays מחדש.

### בעיה 3: indicatorCache עם LRU eviction
ב-`indicatorCache.ts` שורות 136-167, ה-`IndicatorCacheManager` מוגבל ל-500 entries עם LRU eviction + `setMaxSize` שיכול לצמצם עוד. כל eviction = חישוב מחדש של RSI, EMA, ATR, ADX, BB על 12K נרות.

## התיקון

### קובץ 1: `src/lib/optimizer/indicatorCache.ts`
- **תיקון BB כפול**: לקרוא `calculateBBPine` פעם אחת ולשמור את התוצאה, במקום 3 קריאות
- **הסרת eviction**: להוריד את `maxSize` ואת הלוגיקה של מחיקת entries מה-cache
- **הסרת `setMaxSize`**: השיטה הזו מאפשרת צמצום cache חיצוני — להסיר

### קובץ 2: `src/lib/optimizer/portfolioSimulator.ts`
- **הסרת eviction מ-derivedCache**: להוריד את `derivedCacheMaxSize` ואת בדיקת הגודל

### תוצאה צפויה
- BB: ×3 שיפור בזמן חישוב אינדיקטורים
- ביטול eviction: cache hit rate של 100% — אין חישוב כפול של אינדיקטורים
- הדפדפן מקצה זיכרון לפי הצורך, אין סיבה להגביל

