

# קיבוע פרמטרי S1 לפי הערכים מהתמונה + חבילת פרויקט מלאה

## שינוי יחיד — `src/lib/optimizer/presetConfigs.ts` שורות 51-62

הערכים הקבועים מהתמונה (min === max):

```
// Strategy 1 - EMA Trend
enable_strat1: true, enable_rsi_exit: false,
rsi_exit_long: { min: 40, max: 75, step: 1 }, rsi_exit_short: { min: 20, max: 60, step: 1 },
min_bars_in_trade_exit: { min: 2, max: 12, step: 1 },
s1_ema_fast_len: { min: 9, max: 9, step: 1 },
s1_ema_mid_len: { min: 21, max: 21, step: 1 },
s1_ema_trend_len: { min: 50, max: 50, step: 1 },
s1_rsi_len: { min: 14, max: 14, step: 1 },
s1_atr_len: { min: 16, max: 16, step: 1 },
s1_atr_ma_len: { min: 12, max: 12, step: 1 },
s1_atr_hi_mult: { min: 0.85, max: 0.85, step: 0.01 },
s1_adx_len: { min: 11, max: 11, step: 1 },
s1_adx_strong: { min: 18, max: 18, step: 1 },
s1_bb_len: { min: 20, max: 20, step: 1 },
s1_bb_mult: { min: 2.2, max: 2.2, step: 0.1 },
s1_far_from_bb_pc: { min: 2, max: 2, step: 1 },
s1_vol_len: { min: 16, max: 16, step: 1 },
s1_hi_vol_mult: { min: 1, max: 1, step: 0.1 },
s1_min_conds: { min: 3, max: 3, step: 1 },
```

**הבהרה**: `rsi_exit_long/short` ו-`min_bars_in_trade_exit` נשארים עם טווחים כי הם מסננים שנבדקים רק בסוף האופטימיזציה, לא חלק מ-S1.

## חבילת Railway מלאה

אייצר artifact אחד `/mnt/documents/railway-server-full.zip` שכולל:
- כל קבצי ה-optimizer המתוקנים (עם הערכים הקבועים של S1)
- `IndicatorCacheManager` לזירוז
- שמירת עסקאות ל-`optimization_trades`
- `server.ts` עם endpoint `/api/optimize` מוכן
- `package.json` עם dependencies
- `tsconfig.json`

## תוצאה
- S1 = קומבינציה אחת בכל שלב ובכל סיבוב
- אסטרטגיות 2-5 ממשיכות עם טווחים רגילים
- חבילת שרת מוכנה להורדה והרצה

