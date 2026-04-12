

# תיקון Build Error — FileReader ב-csvParser.ts

## הבעיה
`csvParser.ts(85,24): error TS2304: Cannot find name 'FileReader'`

`FileReader` ו-`File` הם APIs של דפדפן. ב-Node.js הם לא קיימים. הפונקציה `readCSVFile` לא נחוצה בשרת (השרת קורא CSV כטקסט מה-DB, לא מקבצים).

## מה אעשה

1. **עדכון `csvParser.ts`** בפרויקט Lovable — הוספת `// @ts-ignore` או הסרת הפונקציות `readCSVFile` ו-`detectTickerFromCSV` (לא נחוצות בשרת)

2. **ייצור חבילה מתוקנת `railway-server-v15.zip`** — אותו דבר כמו v14, רק ש-`csvParser.ts` לא כולל את `readCSVFile` (שמשתמש ב-`FileReader`) ו-`detectTickerFromCSV` (שמשתמש ב-`File`). שתי הפונקציות האלה רלוונטיות רק לדפדפן.

שאר הקבצים ללא שינוי מ-v14.

