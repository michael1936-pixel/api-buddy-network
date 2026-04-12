
בדקתי את הקוד הנוכחי לעומק, והבעיה היא לא במקום שחשבנו קודם.

## מה אימתתי עכשיו
- `indicatorCache.clear()` כבר לא קיים בקוד הנוכחי.
- אין כרגע שום קריאה ל-`setMaxSize(...)`; יש רק את המתודה עצמה בתוך `indicatorCache.ts`.
- ב-`portfolioOptimizer.ts` אין בלוק cleanup שמוחק cache באמצע ריצה; באזור שציינת יש רק progress/yield.
- ה-`50` שעדיין קיים ב-`smartOptimizer.ts` שייך ל-`round1Zones` (שמירת top 50 zones), לא ל-indicator cache.

## מסקנה
כן, נגעו חלקית במקום הנכון, אבל לא בכל צווארי הבקבוק. כרגע ההאטה הסבירה יותר מגיעה מ-3 דברים אחרים:
1. `smartOptimizer.ts` עדיין עושה eviction ל-`combinationCache` במעבר בין rounds.
2. `portfolioSimulator.ts` עדיין מחשב שוב ושוב rolling arrays של S3/S5 בכל קומבינציה (`rollingHighest/Lowest`, `s5AtrMa`) במקום לשמור גם אותם ב-cache.
3. `indicatorCache.ts` כבר תומך ב-`datasetId`, אבל בפועל `runPortfolioBacktest()` לא מעביר `datasetId`, אז ה-cache לא מבדיל נכון בין symbol/train/test. זה גם באג נכונות וגם מונע cache אמין.

## תוכנית תיקון
1. לעדכן את `portfolioSimulator.ts` כך שכל `getOrCompute()` יקבל `datasetId` נפרד ל-train ול-test לכל symbol.
2. להרחיב את מנגנון ה-cache ב-`indicatorCache.ts` כדי לשמור גם את ה-derived indicators של S3/S5, במקום לחשב אותם מחדש בכל קומבינציה.
3. להסיר מ-`smartOptimizer.ts` את ה-eviction של `combinationCache` בין rounds, כדי שלא יהיה cleanup באמצע ריצה.
4. לעדכן את `OPTIMIZER_BUILD` לגרסה חדשה וברורה, כדי שאפשר יהיה לוודא ב-Railway שהקוד הנכון באמת רץ.
5. לא לגעת ב-`portfolioOptimizer.ts` cleanup, כי לפי הקוד הנוכחי אין שם את הבלוק הבעייתי.

## מה ישתנה בפועל
- תחילת הריצה אמורה לזוז מהר יותר כי פחות עבודה תתבצע לפני hit ראשון.
- reuse של אינדיקטורים יהיה אמיתי ועקבי בין symbols/phases.
- פחות חישובים חוזרים בכל stage.
- יהיה קל לבדוק דרך הלוג איזה build באמת עלה ל-Railway.

## פרטים טכניים
קבצים לשינוי:
- `src/lib/optimizer/indicatorCache.ts`
- `src/lib/optimizer/portfolioSimulator.ts`
- `src/lib/optimizer/smartOptimizer.ts`

אימות אחרי היישום:
- חיפוש חוזר בקוד: אין `indicatorCache.clear`, אין call sites ל-`setMaxSize`, ואין eviction פעיל בין rounds.
- לוג build חדש בתחילת ריצה.
- בדיקה שהשלב הראשון מתחיל מיד ושקצב הקומבינציות עולה לעומת המצב הנוכחי.
