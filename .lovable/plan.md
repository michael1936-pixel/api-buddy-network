

## שני שינויים

### 1. הוספת מניות לתור
ה-SymbolSearch **כבר תומך** בבחירה מרובה — מקלידים סימול, לוחצים Enter או בוחרים מהרשימה, והוא נוסף כ-Badge. אפשר להוסיף כמה ורק אז ללחוץ "הרץ X מניות".

**אבל** — כרגע אי אפשר להוסיף מניות **תוך כדי ריצה** (הכפתור `disabled`). צריך לאפשר הוספה לתור גם כשאופטימיזציה כבר רצה.

**שינוי:**
- `SymbolSearch.tsx` — להסיר את `disabled` מה-Input ולהוסיף לוגיקה: אם כבר רצה, לחיצה על "הוסף לתור" במקום "הרץ"
- `optimizationStore.ts` — פונקציה `addToQueue(symbols)` שמוסיפה לתור הקיים בלי לאפס

### 2. החלפת פונט מספרים ל-JetBrains Mono

**שינויים:**
- `src/index.css` — להחליף את ה-import מ-`IBM Plex Mono` ל-`JetBrains Mono` (wght 400;500;600;700)
- `src/index.css` — לעדכן `.font-mono` ל-`font-family: 'JetBrains Mono', monospace`
- `tailwind.config.ts` — לעדכן `mono: ['JetBrains Mono', 'monospace']`

### קבצים

| קובץ | שינוי |
|-------|-------|
| `src/index.css` | החלפת Google Fonts import + `.font-mono` |
| `tailwind.config.ts` | `mono` font family |
| `src/components/backtest/SymbolSearch.tsx` | אפשר הוספה לתור תוך כדי ריצה |
| `src/stores/optimizationStore.ts` | `addToQueue()` |

