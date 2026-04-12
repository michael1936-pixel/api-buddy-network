

# תיקון: שינוי שם השדה מ-`data` ל-`candles`

## הבעיה
השרב Railway מצפה ל-`sd.candles` אבל ה-edge function שולח `sd.data`. זו הסיבה לשגיאה "sd.candles אינו ניתן לאיטרציה".

## התיקון
בקובץ `supabase/functions/start-optimization/index.ts`:
- שורה 41: שינוי `data:` ל-`candles:` בהגדרת הטיפוס
- שורה 74: שינוי `symbolsData.push({ symbol, data: allBars })` ל-`symbolsData.push({ symbol, candles: allBars })`

שינוי של שתי שורות בלבד.

