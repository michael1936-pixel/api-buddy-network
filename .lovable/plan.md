

# תיקון סוכנים — ודאות שכל סוכן מבצע את תפקידו + חיבור סקירות AI

## מצב נוכחי — מה חסר

מהניתוח של הקבצים שלך ומבסיס הנתונים עולה:

1. **הדשבורד מציג רק כרטיסי סוכנים סטטיים** — אין חיבור אמיתי ל-state של כל סוכן מ-`agent_memory`, אין הצגת מסקנות, אין feedback loop
2. **עמוד הזרימה (Pipeline) חסר 3 חלקים קריטיים** מהמקור:
   - טבלת **למידה מתמשכת** — דיוק סוכנים עם approve✅/approve❌/block✅/block❌/השפעה/משקל
   - **Shadow Trades** — עסקאות שנחסמו ונעקבות (האם החסימה הייתה נכונה)
   - **יומן למידה** — שיעורים שנלמדו מעסקאות
3. **עמוד הלמידה חסר** את חישוב `principleRankings` מטבלת `knowledge_learning` (principles_applied + is_win)
4. **עמוד ההחלטות חסר** את ה-expand עם הודעות הסוכנים (`messages[]` מתוך `agent_weights`)
5. **אין חיבור לסקירות שבועיות של AI** — ה-`WeeklyLearningSystem` ו-`AIBrain` שומרים ל-`trade_summaries` ו-`ai_insights`, אבל הדשבורד לא מציג weekly reviews
6. **סוכנים לא שולפים state פרטני** — כל סוכן (VIX, News, CEO, Psychology, וכו׳) שומר state ל-`agent_memory` עם מסקנות, אבל הדשבורד לא מציג אותם בכרטיסי הסוכנים

## התוכנית

### 1. עמוד סוכנים — הצגת state ומסקנות לכל סוכן
- בלחיצה על כרטיס סוכן, הצגת panel עם ה-state שלו מ-`agent_memory`
- כל סוכן שכתב state — יוצג: תפקיד, מסקנות אחרונות, זמן עדכון, פרמטרים מותאמים
- סוכנים שלא כתבו — סימון "ממתין לנתונים"

### 2. עמוד זרימה (Pipeline) — 3 חלקים חסרים
מהקוד המקורי (`renderAgentPipeline`):

**א. טבלת למידה מתמשכת:**
- שולף מ-`agent_feedback` (agent_snapshots) את דיוק כל סוכן
- מחשב: approve ונכון, approve וטעות, חסם ונכון, חסם וטעות
- מציג: דיוק %, השפעה (PnL impact), משקל מחושב

**ב. Shadow Trades:**
- שולף מ-`agent_feedback` עסקאות עם `final_verdict = 'BLOCKED'`
- מציג: סימול, כיוון, מי חסם, PnL נוכחי, האם החסימה הייתה נכונה

**ג. יומן למידה:**
- שולף מ-`ai_insights` (type = trade_analysis / shadow_analysis)
- מציג: שיעור, מקור (עסקה אמיתית / shadow / הצלבה), סוכנים מעורבים, ביטחון

### 3. עמוד החלטות — expand עם הודעות סוכנים
- בלחיצה על החלטה, פריסת panel עם כל הודעות הסוכנים מתוך `agent_weights.messages[]`
- כל הודעה: אייקון סוכן, שם, verdict (approve/warn/block), score, הודעה

### 4. עמוד למידה — principleRankings + סקירות שבועיות
- שליפת `knowledge_learning` וחישוב דיוק עקרונות (principles_applied vs is_win)
- הצגת רשימה ממוינת לפי דיוק עם progress bars
- הוספת hook `useKnowledgeLearning` ו-`useLearningSnapshots`
- הצגת **סקירות שבועיות AI** מ-`ai_insights` (type = 'weekly_review')

### 5. סקירות סוף שבוע (AI Weekly Reviews)
- הצגת כרטיס "סקירה שבועית" בעמוד הלמידה ובסקירה הראשית
- שולף מ-`trade_summaries` (period starts with 'week-') ומ-`ai_insights` (type = 'weekly_review')
- מציג: סה"כ עסקאות, אחוז הצלחה, PnL, מסקנות, בעיות שנמצאו, שיפורים
- מציג `agentLessons` — מה Claude למד על כל סוכן השבוע

## פרטים טכניים

**Hooks חדשים ב-`use-trading-data.ts`:**
- `useKnowledgeLearning(limit)` — שליפה מ-`knowledge_learning`
- `useLearningSnapshots()` — שליפה מ-`learning_snapshots`

**קבצים שישתנו:**
- `src/pages/Agents.tsx` — הוספת agent detail panel עם state
- `src/pages/Pipeline.tsx` — 3 חלקים חדשים (למידה, shadow, יומן)
- `src/pages/Decisions.tsx` — expand + messages display
- `src/pages/Learning.tsx` — principleRankings + weekly reviews
- `src/pages/Index.tsx` — כרטיס סקירה שבועית אחרונה
- `src/hooks/use-trading-data.ts` — 2 hooks חדשים

**מקורות נתונים:**
- `agent_memory` — state פרטני לכל סוכן
- `agent_feedback` — נתוני למידה + shadow trades
- `ai_insights` — ניתוחי AI + סקירות שבועיות
- `knowledge_learning` — דיוק עקרונות
- `trade_summaries` — סיכומים שבועיים/חודשיים
- `learning_snapshots` — snapshots חודשיים

