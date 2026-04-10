

# למה הדשבורד לא מציג נתונים — ניתוח ותיקון

## הבעיה הראשית
רוב הטבלאות **ריקות לגמרי** בבסיס הנתונים:

| טבלה | שורות |
|-------|--------|
| agent_memory | 2 ✅ |
| market_data | 1 ✅ |
| כל השאר | **0** ❌ |

אבל **גם הנתונים שכן קיימים** לא מוצגים בגלל בעיות מיפוי בקוד:

## באגים שצריך לתקן

### 1. VIX — מחפש במקום הלא נכון
הקוד ב-News.tsx מחפש `agent_id === "vix"` ב-`agent_memory`, אבל נתוני VIX נמצאים ב-**`market_data`** (symbol: "VIX", close: 19.49). צריך hook `useMarketData("VIX")` שישלוף מ-market_data.

### 2. SPY — הרדקודד "--"
כרטיס SPY מציג "--" תמיד. צריך לשלוף מ-`market_data` (symbol: "SPY").

### 3. סוכן חדשות — שדות לא תואמים
הקוד מחפש `newsState.riskLevel`, `newsState.reasoning`, `newsState.tradesMonitored` — אבל ה-state האמיתי של `news_research` מכיל:
```
{ patterns: [], conclusions: {}, lastResearch: "...", totalPatterns: 0 }
```
צריך למפות לשדות הנכונים.

### 4. חסר hook למשיכת market_data
אין `useMarketData` ב-hooks — צריך להוסיף אחד שמושך את הנתון האחרון לכל סימבול.

## התוכנית

1. **הוספת `useMarketData(symbol)` hook** — שולף שורה אחרונה מ-`market_data` לפי symbol
2. **תיקון News.tsx** — VIX ו-SPY ישלפו מ-`market_data` במקום `agent_memory`
3. **תיקון מיפוי news agent** — שימוש בשדות `conclusions`, `totalPatterns`, `lastResearch` במקום השדות הלא קיימים
4. **הוספת fallback חכם** — כשאין נתונים, הצגת הודעה ברורה עם זמן העדכון האחרון של כל טבלה

**קבצים:** `src/hooks/use-trading-data.ts`, `src/pages/News.tsx`

