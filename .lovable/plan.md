

# עדכון שרת Railway — צעדים בטרמינל

## שלב 1 — Clone והכנה

```bash
git clone https://github.com/<YOUR-USERNAME>/<RAILWAY-REPO-NAME>.git
cd <RAILWAY-REPO-NAME>
mkdir -p workers
```

## שלב 2 — יצירת קובץ Worker

```bash
cat > workers/optimizer-worker.ts << 'EOF'
<כאן אשים את הקוד המלא של optimizer-worker.ts>
EOF
```

## שלב 3 — החלפת server.ts

```bash
cat > server.ts << 'EOF'
<כאן אשים את הקוד המעודכן של server.ts>
EOF
```

## שלב 4 — עדכון smartOptimizer.ts

פה רק מוסיפים 10 שורות בסוף כל שלב — אראה בדיוק איפה.

## שלב 5 — עדכון package.json ו-Push

```bash
# עדכון start command
npm pkg set scripts.start="node --expose-gc --max-old-space-size=3584 --loader ts-node/esm server.ts"

git add .
git commit -m "Add worker isolation, heartbeat, memory cleanup"
git push
```

Railway יעשה deploy אוטומטי.

## מה אצטרך ממך

תגיד לי מה שם הריפו שלך ב-GitHub (או תשלח לי את הלינק) — ואני אכתוב לך את כל הפקודות מוכנות להעתקה לטרמינל, כולל כל הקוד בתוכן.

