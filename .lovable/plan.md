

# תיקון סיבוב 2 + שינויים נוספים לפי המסמך

## בעיות שנמצאו

### 1. באג ב-enabledStrategies — R1 + R2 (בעיה עיקרית!)
**קובץ:** `src/lib/optimizer/smartOptimizer.ts`, שורות 104-121

הקוד הנוכחי (R1 ו-R2):
```typescript
enabledStrategies: { 
  strat1: true,  // ← תמיד true!
  strat2: stratNum === 2, 
  strat3: stratNum === 3, ... 
}
```

**לפי המסמך:**
- שלבים 1-3 (R1) ו-8-10 (R2): Strat1 only ✓ (תקין)
- שלב 4/11 (S2 Bollinger): **Strat2 only** — אבל הקוד מפעיל גם Strat1!
- שלב 5/12 (S3 Breakout): **Strat3 only** — אבל הקוד מפעיל גם Strat1!
- שלב 6/13 (S4 Inside Bar): **Strat4 only** — אבל הקוד מפעיל גם Strat1!
- שלב 7/14 (S5 ATR Squeeze): **Strat5 only** — אבל הקוד מפעיל גם Strat1!

**תיקון:** שינוי `strat1` ל-`i <= 2` (true רק עבור Long, Short, ו-S1 EMA).

### 2. Zone Collection Scoring
**קובץ:** `src/lib/optimizer/smartOptimizer.ts`, שורות 232-250

הקוד ממיין לפי `avg` (ממוצע תשואה) בלבד.
המסמך מגדיר: `score = avg_return / std × log(count)`

**תיקון:** הוספת חישוב סטיית תקן ו-log(count) לנוסחת הציון.

### 3. שלב 15 — 23 שילובים (לא 16)
**קובץ:** `src/lib/optimizer/smartOptimizer.ts`, שורות 348-376 + שורה 472

הקוד בודק 16 combos (power set). המסמך מגדיר 23 שילובים ספציפיים (5 singles + 9 pairs + 4 triples + 5 "all except").

**תיקון:** הגדרת מערך של 23 combos מפורשים + נוסחת ציון חדשה.

### 4. נוסחת ציון לשילוב מנצח
כרגע נבחר לפי profit בלבד. המסמך:
```
score = returnScore × overfitPenalty × diversityBonus × (1 + winRateBonus×0.3 + tradeCountBonus×0.2)
```

### 5. עדכון total_stages ב-Edge Function
**קובץ:** `supabase/functions/start-optimization/index.ts` — ללא שינוי כי כבר 30 שלבים (תואם).

## קבצים שישתנו

| קובץ | שינוי |
|-------|--------|
| `src/lib/optimizer/smartOptimizer.ts` | תיקון enabledStrategies (R1+R2), zone scoring, 23 combos, scoring formula, estimation |
| `supabase/functions/start-optimization/index.ts` | total_stages נשאר 30 — ללא שינוי |

## סיכום השינויים
- **4 תיקונים** בקובץ אחד (`smartOptimizer.ts`)
- התיקון הקריטי ביותר: `strat1: true` תמיד — גורם לכך שאסטרטגיות 2-5 נבדקות ביחד עם S1 במקום בנפרד

