

# עדכון שרת Railway דרך GitHub

## הגישה הנכונה

כן, זו בדיוק הדרך הנכונה. הנה הצעדים:

## שלב 1 — Clone של הריפו

```bash
git clone https://github.com/<your-username>/<railway-repo-name>.git
cd <railway-repo-name>
```

## שלב 2 — יצירת קובץ Worker חדש

```bash
mkdir -p workers
```
ליצור את הקובץ `workers/optimizer-worker.ts` עם הקוד שנתתי לך.

## שלב 3 — עדכון server.ts

להחליף את הקוד של `processSymbol` ב-`server.ts` בגרסה עם `child_process.fork()`.

## שלב 4 — עדכון smartOptimizer.ts

להוסיף ניקוי cache + GC בסוף כל שלב.

## שלב 5 — Push ל-GitHub

```bash
git add .
git commit -m "Add worker isolation, heartbeat, memory cleanup"
git push
```

Railway יעשה deploy אוטומטי מה-push.

## מה אעשה

אייצר לך 3 קבצים מוכנים להעתקה — אחד אחד, בסדר:
1. `workers/optimizer-worker.ts` (חדש)
2. `server.ts` (מעודכן)
3. שינויים ל-`optimizer/smartOptimizer.ts`

כל קובץ יהיה מלא ומוכן — פשוט להחליף/ליצור.

