

# ניתוח: למה האופטימיזציה איטית

## ממצא חשוב
**השינויים שעשיתי ב-`portfolioOptimizer.ts` ו-`smartOptimizer.ts` הם קוד צד-לקוח (client-side) בלבד — הם לא משפיעים על שרת Railway כלל.** Railway מריץ את הקוד שלו באופן עצמאי.

## מה מצאתי בקוד של Bolt (שרץ ב-Railway)

### בעיה 1: `onProgress` נקרא על כל קומבינציה בודדת
```text
portfolioOptimizer.ts שורה 537-549:
onProgress({...}) נקרא על כל איטרציה — לא כל 50 או 500
```
אם ה-`onProgress` ב-Railway כותב ל-DB בכל קריאה, זו כתיבת רשת (network round-trip) על **כל קומבינציה**. עם 6,250 קומבינציות = 6,250 כתיבות DB.

### בעיה 2: `setTimeout(0)` כל 3 איטרציות
```text
portfolioOptimizer.ts שורה 550:
if (current % 3 === 0) {
  await new Promise(resolve => setTimeout(resolve, 0));
}
```
ב-Node.js, `setTimeout(0)` עולה ~1ms. עבור 6,250 קומבינציות: 6,250/3 × 1ms = **~2 שניות** אבודות רק על yields, **לכל שלב**.

## מה צריך לתקן — **בקוד של Railway**

### תיקון 1: הפחתת תדירות progress
ב-`portfolioOptimizer.ts` של Railway, לעטוף את ה-onProgress:
```typescript
// במקום onProgress({...}) על כל איטרציה:
if (current % 500 === 0 || current === totalCombinations) {
  onProgress({...});
}
```

### תיקון 2: הפחתת yields
```typescript
// במקום current % 3:
if (current % 200 === 0) {
  await new Promise(resolve => setTimeout(resolve, 0));
}
```

### תיקון 3 (אופציונלי): throttle כתיבות DB
ב-route handler של `/api/optimize`, לוודא שכתיבות DB מתבצעות מקסימום כל 2-5 שניות, לא על כל progress callback.

## מה אני אעשה ב-Lovable
1. **אחזיר** את `stepMultiplier` ל-4 (לא 6) — כי זה לא משפיע על Railway
2. **אחזיר** את `MAX_STAGE_COMBOS` ל-300K — כי זה לא משפיע על Railway
3. **אשאיר** את תיקון ה-`globalBestReturn` ב-progress — כי זה כן משפיע על ה-UI

## סיכום
הבעיה היא **בקוד של Railway**, לא בקוד של Lovable. צריך לשנות 2 שורות בשרת Railway:
- `onProgress` כל 500 במקום כל 1
- `setTimeout` כל 200 במקום כל 3

זה אמור להחזיר את המהירות ל-400K+/דקה.

