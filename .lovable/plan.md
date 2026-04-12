

## תיקון מספרים ארוכים + פונט + הוספת מהירות ממוצעת

### בעיות שזוהו

1. **מספרים ארוכים** — WR מציג `73.33333333333333%` במקום `73.3%`, DD מציג `76.47058823529411%` במקום `76.5%`
2. **פונט** — `font-mono` (JetBrains Mono) משמש לכל המספרים והטקסט באנגלית. המשתמש רוצה פונט רגיל (Inter/Heebo)
3. **חסר** — ממוצע קומבינציות/שניה לכל הריצה

### שינויים

| קובץ | שינוי |
|---|---|
| `src/pages/Backtest.tsx` | עיגול `win_rate` ו-`agent_confidence` ל-1 ספרה, הסרת `font-mono` מכל העמודות |
| `src/components/backtest/OptimizationProgress.tsx` | הסרת `font-mono` מכל הטקסטים (מספרים, Train/Test, combos), הוספת שורת "ממוצע קומבינציות/שניה" שמחושבת כ-`total_current / elapsedTime` |

### פירוט

**Backtest.tsx — טבלת תוצאות (שורות 221-231):**
- `win_rate`: שינוי מ-`{o.win_rate || 0}%` ל-`{(o.win_rate || 0).toFixed(1)}%`
- `agent_confidence`: כבר יש `toFixed(0)` — תקין
- `max_drawdown`: כבר יש `toFixed(0)` — תקין  
- הסרת `font-mono` מכל ה-spans בטבלה

**OptimizationProgress.tsx:**
- הסרת כל ה-`font-mono` classes מהקומפוננט (שורות 155, 159, 382, 400, 417, 420, 441, 455, 466, 500, 503, 521, 528)
- הוספת שורה חדשה ליד "מהירות" שמציגה: `ממוצע כללי: X קומבינציות/שניה` — מחושב כ-`overallCombinations.current / elapsedTime`

