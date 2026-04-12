

# תיקון Stage 10: Combinatorial Explosion (לא בעיית זיכרון!)

## הבעיה האמיתית
Stage 10 (Round 2, "דיוק אסטרטגיה 1 EMA Trend") מנסה לבדוק **5^15 ≈ 30 מיליארד** קומבינציות. הסיבה:
- ב-`presetConfigs.ts` כל 15 הפרמטרים של S1 מוגדרים כ-`min === max` (ערך קבוע)
- Round 1 בודק רק 1 קומבינציה → round1Zones מכיל תוצאה אחת
- Zone guard (>5000) תופס ונופל ל-fine-tune fallback
- Fine-tune עם ±2 × 15 פרמטרים = 5^15 קומבינציות — אין סיכוי שזה יסתיים

## הפתרון — 2 שינויים

### 1. הוספת combo guard גם ל-fine-tune fallback (`smartOptimizer.ts`)
אחרי שורה 521, אחרי שה-fine-tune config נבנה — לבדוק שוב estimatedCombos. אם עדיין > 5000:
- לפצל את 15 הפרמטרים ל-sub-groups קטנים (EMA בנפרד, RSI/ATR בנפרד, BB/ADX בנפרד)
- או להקטין tuneRange ל-1 (3 ערכים במקום 5 = 3^15 ≈ 14M — עדיין הרבה)
- **הפתרון הנכון**: להגביל כל fine-tune stage למקסימום ~5000 combos. אם חורגים, להקטין tuneRange דינמית עד שנכנסים לתקציב

### 2. הרחבת טווחים ב-presetConfigs (אופציונלי אבל מומלץ)
ב-`presetConfigs.ts`, לתת טווחים אמיתיים ל-S1 params שבאמת שווה לבדוק:
```
s1_ema_fast_len: { min: 5, max: 15, step: 2 }    // 6 values
s1_ema_mid_len: { min: 15, max: 30, step: 3 }     // 6 values  
s1_ema_trend_len: { min: 30, max: 70, step: 10 }  // 5 values
```
זה יתן ל-Round 1 מספיק מגוון כדי למצוא zones אמיתיים, ו-Round 2 יוכל לעבוד על zones עם משמעות.

## קבצים שישתנו
- `src/lib/optimizer/smartOptimizer.ts` — combo guard + dynamic tuneRange reduction
- `src/lib/optimizer/presetConfigs.ts` — (אופציונלי) טווחים אמיתיים ל-S1

## הערה חשובה
תיקוני הזיכרון מהגרסה הקודמת (intra-stage cleanup כל 200 combos) לא מזיקים — הם עדיין שימושיים לשלבים ארוכים. אבל הם לא פותרים את הבעיה הזו כי הבעיה היא כמות, לא זיכרון.

## Technical Detail
הלוגיקה של ה-guard תהיה:
```
// After building fine-tune config, check combo count
// If > MAX_COMBOS (5000), reduce tuneRange until fits
let tuneRange = stage.tuneRange || 2;
while (estimatedCombos > 5000 && tuneRange > 0) {
  tuneRange--;
  stageCfg = createFineTuneConfig(..., tuneRange);
  estimatedCombos = recalculate();
}
// If still too many, lock least-impactful params
```

