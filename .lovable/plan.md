
אבחון מעודכן

- זה כבר לא נתקע ב-8-9. לפי הלוגים, שלב 8 ו-9 עברו עם fallback תקין, וה-heap אפילו ירד ל-78MB אחרי שלב 9.
- התקיעה החדשה מתחילה בשלב 10/30: "דיוק אסטרטגיה 1 EMA Trend" (Round 2).
- בלוגים רואים דפוס ברור: בתוך שלב 10 ה-heap מטפס 150 → 220 → 301 → 368 → 445MB בלי להשתחרר. זה אומר שהבעיה עכשיו היא צבירת זיכרון תוך-שלבית, לא zone explosion כמו קודם.

למה זה קורה

- `smartOptimizer.ts` מנקה זיכרון רק בין stages (`indicatorCache.clear()` + `gc()`), אבל לא בזמן stage ארוך.
- `indicatorCache.ts` מחזיק עד 50 `PrecomputedData` entries, וכל entry מכיל הרבה arrays גדולים של indicators. בשלב 10 יש 3,600 combos, אז ה-cache מתנפח עד תקרת הזיכרון.
- `portfolioOptimizer.ts` עדיין שומר `combinationCache` לאורך כל השלב, מה שמוסיף עוד לחץ מיותר.
- יש גם בעיית correctness: `s1_ema_fast_len`, `s1_ema_mid_len`, `s1_ema_trend_len` לא באמת מחווטים טוב לחישובי EMA ב-`indicatorCache.ts`/`strategies.ts`, אז שלב 10 גם עושה הרבה עבודה שחלקה לא באמת משפיעה כמו שצריך.

תוכנית התיקון

1. לייצב את הזיכרון בתוך stage, לא רק בין stages  
   - ב-`optimizer/portfolioOptimizer.ts` להוסיף ניקוי אגרסיבי כל N קומבינציות (למשל כל 100):
     - `indicatorCache.clear()`
     - prune ל-`combinationCache`
     - `global.gc?.()` רק כשעוברים סף heap מוגדר
   - המטרה: שלא נחכה לסוף stage כדי לשחרר מאות MB.

2. להקטין/לכבות cache בשלבי indicator-heavy  
   - ב-`optimizer/indicatorCache.ts` להוסיף mode של cache קטן מאוד או disabled לשלבים כמו Stage 10.
   - ב-`optimizer/smartOptimizer.ts` להעביר policy אגרסיבית ל-Round 2/3 stages שמזיזים פרמטרי אינדיקטורים.
   - זה יחליף מעט מהירות ביציבות, וזה שווה את זה כרגע.

3. לא לשמור cache מלא ב-Round 2/3  
   - ב-`optimizer/portfolioOptimizer.ts` להגביל את `combinationCache` ל-best/protected בלבד, או לתקרה קטנה, מחוץ ל-Round 1.
   - כרגע הערך של cache reuse בשלבים האלה נמוך, והמחיר בזיכרון גבוה.

4. לתקן את Stage 10 עצמו  
   - ב-`optimizer/indicatorCache.ts` / `optimizer/strategies.ts` לחבר באמת את:
     - `s1_ema_fast_len`
     - `s1_ema_mid_len`
     - `s1_ema_trend_len`
   - ואם צריך, לצמצם זמנית את Stage 10 רק לפרמטרים שבאמת משפיעים, כדי לא לבזבז 3,600 קומבינציות על פרמטרים חצי-מנותקים.

5. למסור לך שוב את כל ריפו Railway כמקשה אחת  
   - אחרי היישום אייצר לך ZIP מלא ומעודכן של ריפו ה-GitHub, כדי שלא תצטרך לערוך קבצים ידנית.

קבצים שאעדכן
- `optimizer/smartOptimizer.ts`
- `optimizer/portfolioOptimizer.ts`
- `optimizer/indicatorCache.ts`
- `optimizer/strategies.ts`
- ואם צריך גם `workers/optimizer-worker.ts` בשביל לוגי heap/guard ברורים יותר

פרט טכני חשוב
- מצאתי גם רמז לבעיה לוגית: ה-cache key באינדיקטורים מבוסס רק על פרמטרים, לא על dataset/segment, כך שצריך לבדוק שלא נעשה reuse שגוי בין train/test. זה לא נראה כמו הסיבה הישירה לתקיעה הנוכחית, אבל זה כן משהו שאסדר תוך כדי כי הוא עלול לפגוע באמינות התוצאות.

תוצאה צפויה אחרי התיקון
- שלבים 8-9 יישארו יציבים כמו עכשיו
- שלב 10 לא אמור לטפס שוב עד OOM
- ואם הוא עדיין יהיה כבד, הוא ירוץ לאט יותר אבל לא יקרוס
- ותקבל ממני שוב ZIP מלא מוכן ל-push ל-GitHub
