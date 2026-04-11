

## החלפת מנוע האופטימיזציה — העתקת הקוד המדויק מהשרת

### מה הבעיה
הפרויקט כאן משתמש ב-**מנוע backtest פשוט ושונה** מהשרת. ההבדלים:

1. **מודל עמלות** — בלובאבל: `0.1% per side` קבוע. בשרת: `max(1¢/share, $2.50)` + slippage + overnight fees
2. **ניהול עסקה** — בלובאבל: stop/TP פשוטים בלי stepping. בשרת: TP stepping, RSI trailing, breakeven, non-regress stop, trail tighten
3. **Indicator Cache** — בלובאבל: hash על 14 פרמטרים בלבד. בשרת: `IndicatorCacheManager` class עם `getOrCompute`
4. **אין `rollingHighest/rollingLowest`** — בלובאבל S3/S5 משתמשים ב-`highest()` per bar. בשרת: מחשב deque-based rolling פעם אחת
5. **Smart Optimizer** — שונה לגמרי מהשרת (חסרים zone collection, strategy combination stage, parameter validation)

### הפתרון — להחליף את הקבצים העיקריים בקוד מהשרת

הקוד מהשרת צריך התאמות קלות (הסרת `import { logger }`, `import { getSupabase }` → `import { supabase }`, הסרת `import { config }`), אבל הלוגיקה זהה.

### קבצים שישתנו

| # | קובץ | פעולה |
|---|-------|-------|
| 1 | `src/lib/optimizer/indicatorCache.ts` | **חדש** — `IndicatorCacheManager` + `precomputeIndicators` + `rollingHighest/rollingLowest` מהשרת |
| 2 | `src/lib/optimizer/portfolioSimulator.ts` | **החלפה** — `runBacktest` מ-`simulatorV2.ts` עם כל ניהול העסקה (TP stepping, RSI trail, BE, flip, commissions) |
| 3 | `src/lib/optimizer/strategies.ts` | **החלפה** — 5 אסטרטגיות מהשרת (פשוט יותר, בלי debug bloat, עם `s3RangeHigh/s3RangeLow/s5AtrMa/s5RangeHigh/s5RangeLow`) |
| 4 | `src/lib/optimizer/portfolioOptimizer.ts` | **החלפה** — `optimizePortfolio` מהשרת עם `CombinationCache`, `preFilterSymbols`, `indicatorCache.getOrCompute` |
| 5 | `src/lib/optimizer/smartOptimizer.ts` | **החלפה** — 30 שלבים ב-3 סבבים מהשרת עם `generateDynamicStages`, `expandConfigForStage`, `collectTopZones` |
| 6 | `src/lib/optimizer/presetConfigs.ts` | **החלפה** — `NNE_PRESET_CONFIG` מהשרת (96 פרמטרים עם טווחים) |
| 7 | `src/lib/optimizer/strategyEngine.ts` | **מחיקה** — כל הלוגיקה עוברת ל-`portfolioSimulator.ts` (כמו בשרת) |
| 8 | `src/workers/optimizer.worker.ts` | **עדכון** — להשתמש ב-`optimizePortfolio` מה-`portfolioOptimizer` החדש במקום לולאה ידנית |
| 9 | `src/lib/optimizer/parameterValidation.ts` | **חדש** — `getMinConstraint` שהשרת משתמש בו |
| 10 | `src/lib/optimizer/debugConfig.ts` | **עדכון** — כל הדגלים כבויים (כמו בשרת) |
| 11 | `src/pages/Backtest.tsx` | **עדכון** — התאמת imports לממשקים החדשים |

### התאמות שרת → דפדפן
- `import { logger }` → `console.log/warn/error`
- `import { getSupabase }` → `import { supabase }` from client
- `import { config }` → קונסטנטים ישירים
- `import { memoryManager }` → הסרה (לא רלוונטי בדפדפן)
- `import { getMinConstraint }` → פונקציה חדשה פשוטה
- Worker: ה-`optimizePortfolio` רץ ישירות ב-Worker (כבר off-thread)

### מבנה הזרימה אחרי השינוי
```text
Backtest.tsx
  → smartOptimizer.runSmartOptimization()
    → 30 stages, each calls:
      → portfolioOptimizer.optimizePortfolio()
        → generates combinations iteratively
        → for each combo:
          → indicatorCache.getOrCompute() (hash-based, ~600K cache hits)
          → portfolioSimulator.runBacktest() (full engine with commissions)
            → strategies.ts (5 strategies, pre-computed rolling arrays)
```

### Zustand store לריצה ברקע (מהתוכנית הקודמת)
גם ייצור `src/stores/optimizationStore.ts` — כדי שהאופטימיזציה תמשיך לרוץ גם כשעוברים עמוד.

### תוצאה צפויה
- **אותם תוצאות** כמו בשרת — אותו מנוע, אותם עמלות, אותה לוגיקה
- **מהירות** — indicator cache עם `IndicatorCacheManager` + rolling arrays = ~100-300 קומב׳/שניה
- **ריצה ברקע** — Zustand store מחזיק את ה-Worker, לא נהרג בניווט

