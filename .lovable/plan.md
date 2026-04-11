

## תיקון תצוגת אופטימיזציה — 2 שינויים

### 1. ביטול הנעילה של המסך
כרגע ה-progress מוצג בתוך `Dialog` (מודל) שחוסם את כל המסך. נחליף את זה בקומפוננטה inline — כרטיס שמופיע בתוך הדף עצמו, בלי overlay, כך שאפשר להמשיך לגלול ולראות את הגריד.

### 2. העתקת התצוגה מהפרויקט השני (Real-Time Trading Insights)
נייבא את `SmartOptimizationProgress` מהפרויקט השני ונתאים אותו. התצוגה כוללת:
- 3 סיבובים (כל אחד עם 7 שלבים) עם צבעים שונים (כחול / כתום / ירוק)
- Checkbox לכל שלב — אפשר לבטל/להפעיל שלבים
- Progress bars כפולים — כללי + שלב נוכחי
- מהירות (קומבינציות/שניה) + זמן משוער
- תוצאות Train/Test בזמן אמת
- כפתור "עצור" + "דלג לשלב הבא"

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/components/backtest/OptimizationProgress.tsx` | **שכתוב מלא** — מ-Dialog לכרטיס inline עם כל הפיצ'רים מהפרויקט השני |
| `src/pages/Backtest.tsx` | עדכון ה-state וה-props כדי לתמוך בממשק החדש (enabledStages, stageProgress map, skip, speed) |
| `src/lib/optimizer/smartOptimizer.ts` | ייצוא `getOptimizationStages` + `StageStatus`/`StageResult` types (אם לא קיימים כבר) |

### פרטים טכניים
- הקומפוננטה החדשה תהיה `Card` רגיל (לא `Dialog`) — מוצגת מעל הגריד כשיש אופטימיזציה פעילה
- יתווסף timer (`setInterval`) ב-Backtest.tsx למדידת `elapsedTime`
- יתווסף חישוב `combinationsPerSecond` מתוך progress updates
- יתווסף state של `enabledStages: boolean[]` — ברירת מחדל הכל פעיל, אפשר לכבות שלבים pending
- כפתור "דלג" ישלח signal ל-optimizer לעבור לשלב הבא
- העיצוב: gradient כהה, border primary, RTL — בדיוק כמו בפרויקט השני

