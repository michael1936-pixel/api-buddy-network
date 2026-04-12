

# תיקון מהירות האופטימיזציה — חזרה ל-400K+/דקה

## הבעיה
שינויים שהוספתי ל-`smartOptimizer.ts` גרמו לירידה מ-400K ל-300K קומבינציות/דקה. הקוד הזה רץ גם בשרת Railway.

## 3 שינויים שגרמו לאיטיות

### 1. `indicatorCache.clear()` בין כל שלב (שורה 423)
מנקה את כל ה-indicator cache בכל שלב — מכריח חישוב מחדש של RSI, EMA, ATR וכו' עבור 12K+ bars. **זה ההאטה הכי גדולה.**

### 2. `indicatorCache.setMaxSize(5)` ב-Round 2/3 (שורה 432)
Cache של 5 כניסות בלבד = כמעט כל קומבינציה מחשבת אינדיקטורים מאפס.

### 3. Cache eviction + GC בין כל שלב (שורות 416-428)
ניקוי כל ה-combination cache + קריאת GC ידנית בין כל שלב — מיותר ומאט.

## התיקונים

### `src/lib/optimizer/smartOptimizer.ts`:
1. **מחיקת שורות 416-428** — הסרת inter-stage cleanup שלם (cache eviction + indicatorCache.clear + GC בין שלבים). להשאיר ניקוי רק בין **rounds** (שורות 398-413, שכבר קיים).
2. **שינוי שורה 432** — `indicatorCache.setMaxSize(5)` → `indicatorCache.setMaxSize(50)` גם ב-Round 2/3.
3. **השתקת console.log** — להסיר/להחליף ב-no-op את כל ה-console.log בקובץ (שורות 349-356, 386, 394, 404, 411, 422, 426, 437-438, ועוד ~15 מקומות). להשאיר רק שגיאות.

### `src/lib/optimizer/portfolioOptimizer.ts`:
הקובץ הזה כבר תוקן נכון — progress כל 500 + yield כל 500. אין שינוי נוסף.

## תוצאה צפויה
חזרה ל-400K+ קומבינציות/דקה — חיסכון עיקרי מ-indicator cache שנשאר חי בין שלבים.

