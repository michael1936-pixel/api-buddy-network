

# עדכון שרת Railway — סקריפט מוכן לטרמינל

## הריפו
`https://github.com/michael1936-pixel/algomaykl-optimizer`

## מה אעשה
אייצר לך סקריפט שלם עם 3 קבצים — תעתיק לטרמינל ותריץ. הכל אוטומטי:

1. `git clone` של הריפו
2. יצירת `workers/optimizer-worker.ts` (heartbeat + isolation)
3. החלפת `server.ts` (fork לכל סימבול)
4. הוספת ניקוי זיכרון ל-`optimizer/smartOptimizer.ts`
5. עדכון `package.json` עם `--expose-gc`
6. `git push` — Railway עושה deploy אוטומטי

## הערה טכנית
הסקריפט משתמש ב-`cat > file << 'EOF'` כדי ליצור/להחליף קבצים ישירות מהטרמינל בלי צורך לפתוח עורך.

