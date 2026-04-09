

# תוכנית: המרת הדשבורד לעברית + RTL

## הבעיה
הדשבורד המקורי שלך (`dashboard.html`) הוא **כולו בעברית עם RTL** — כל הלייבלים, ניווט, כותרות, empty states, ושמות סוכנים בעברית. הדשבורד שנבנה ב-React יצא באנגלית מלאה.

## מה ישתנה

### 1. RTL גלובלי
- הוספת `dir="rtl"` ו-`lang="he"` ל-`index.html`
- החלפת פונט Heebo (כמו במקור) כפונט ראשי במקום Inter
- IBM Plex Mono לנתונים מספריים (כמו במקור)

### 2. Layout — סיידבר ימני
- הסיידבר עובר לצד **ימין** (RTL)
- שמות הטאבים בעברית: סקירה, פוזיציות, סוכנים, אופטימיזציה, חדשות, מוח AI, הגדרות

### 3. כל הדפים — תרגום מלא לעברית
כל טקסט UI יתורגם בהתאם למקור:

| דף | דוגמאות לתרגום |
|---|---|
| **Dashboard** | "פוזיציות פתוחות", "סיגנלים היום", "עסקאות", "אחוז הצלחה" |
| **Positions** | "פתוחות/סגורות", "כיוון", "מחיר כניסה", "סטופ", "טייק פרופיט" |
| **Agents** | שמות קטגוריות: ניתוח, הגנה, מודיעין, אופטימיזציה, ניהול, תפעול. "ביצועי סוכנים", "דיוק" |
| **Optimization** | "תשואת אימון", "תשואת מבחן", "סיכון התאמת-יתר", "שארפ" |
| **News** | "סוכן מודיעין חדשות", "סיכון: גבוה/נמוך", "מגזרים מושפעים" |
| **Brain** | "תובנות AI", "סוג", "ביטחון" |
| **Settings** | "הגדרות מערכת" |

### 4. Empty states בעברית
- "אין פוזיציות פתוחות" במקום "No open positions"
- "ממתין לסיגנלים..." במקום "No signals yet"
- כמו שמופיע ב-dashboard.html המקורי

## קבצים שישתנו
- `index.html` — dir, lang, fonts
- `tailwind.config.ts` — Heebo + IBM Plex Mono
- `src/index.css` — RTL adjustments
- `src/components/AppLayout.tsx` — ניווט עברית, סיידבר ימין
- `src/pages/Index.tsx` — דשבורד ראשי בעברית
- `src/pages/Positions.tsx` — עברית
- `src/pages/Agents.tsx` — עברית + קטגוריות סוכנים
- `src/pages/Optimization.tsx` — עברית
- `src/pages/News.tsx` — עברית
- `src/pages/Brain.tsx` — עברית
- `src/pages/SettingsPage.tsx` — עברית
- `src/components/trading/StatCard.tsx` — RTL fixes

