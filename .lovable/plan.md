

# ייצור ZIP מעודכן + הוראות

## מצב נוכחי
הקבצים כבר מעודכנים בפרויקט:
- `presetConfigs.ts` — S1 עם טווחים (כמו שביקשת להשאיר)
- `smartOptimizer.ts` — combo guard שמקטין `tuneRange` דינמית אם >5000 combos
- `portfolioOptimizer.ts` — ניקוי זיכרון תוך-שלבי כל 200 combos
- `indicatorCache.ts` — EMA params מחווטים + `setMaxSize`

## מה אעשה
אייצר ZIP של כל הקבצים הרלוונטיים ב-`/mnt/documents/optimizer-updated.zip`:
- `src/lib/optimizer/` (כל 16 הקבצים)
- `src/workers/optimizer.worker.ts`

## הוראות טרמינל אחרי הורדה
```bash
cd ~/your-github-repo
unzip -o optimizer-updated.zip
git add .
git commit -m "fix: combo guard + intra-stage cleanup + EMA wiring"
git push
```

