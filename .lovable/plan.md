

# תיקון מהירות + עצירת ריצה בשרת

## בעיות
1. **שורה 423 ב-`smartOptimizer.ts`**: `indicatorCache.setMaxSize(50)` דורסת את ה-500 **בכל תחילת stage** — זה מה שגורם לאיטיות
2. **Railway לא בודק abort**: כשלוחצים "עצור" בדשבורד, הסטטוס מתעדכן ל-`aborted` ב-DB, אבל השרת ב-Railway לא בודק את זה ומשיך לרוץ

## שינויים

### 1. `src/lib/optimizer/smartOptimizer.ts`
- **מחיקת שורה 423** (`indicatorCache.setMaxSize(50)`) — לגמרי, לא להחליף ב-500. ה-cache נוצר עם `maxSize=500` ב-`indicatorCache.ts` ואין סיבה לגעת בזה
- **הוספת `abortCheckFn` parameter** ל-`runSmartOptimization` — callback אופציונלי שהשרת ב-Railway יכול להעביר כדי לבדוק את סטטוס ה-run ב-DB
- **בדיקת abort בתוך הלולאה** — כל 5 שניות, קריאה ל-`abortCheckFn()` ואם מחזיר `true` עוצרים

### 2. יצירת חבילת ZIP חדשה
- `/mnt/documents/optimizer-bundle-v13.zip` עם הקוד המתוקן
- תעתיק ל-repo של Railway ותעשה push

## פרטים טכניים

ה-`abortCheckFn` יעבוד כך:
```typescript
// בשרת Railway — לפני הקריאה ל-runSmartOptimization:
const abortCheckFn = async () => {
  const { data } = await supabase
    .from('optimization_runs')
    .select('status')
    .eq('id', runId)
    .single();
  return data?.status === 'aborted';
};
```

בתוך `smartOptimizer.ts` הלולאה תבדוק:
```typescript
// כל 5 שניות
if (abortCheckFn && Date.now() - lastAbortCheck > 5000) {
  lastAbortCheck = Date.now();
  if (await abortCheckFn()) break;
}
```

