

## יצירת קבצי Patch להורדה

הקבצים הקודמים נמחקו (היו ב-`/tmp`). אצור אותם מחדש כקבצים להורדה ב-`/mnt/documents/`.

### מה ייווצר

קבצים שתוריד למחשב ותעתיק לתוך ה-repo של Railway:

1. **`/mnt/documents/railway-patch/serverLogger.ts`** — מודול שכותב לוגים לטבלת `optimization_run_logs` (heap, stage, combo)
2. **`/mnt/documents/railway-patch/memoryGuard.ts`** — מוניטור זיכרון שעוצר בצורה נשלטת לפני OOM
3. **`/mnt/documents/railway-patch/indicatorCache-fix.ts`** — תיקון cache key עם dataset identity
4. **`/mnt/documents/railway-patch/README.md`** — הוראות: איזה קובץ לשים איפה ב-repo

### תהליך העבודה שלך אחרי ההורדה

1. הורד את הקבצים מ-Lovable (יופיעו בתפריט Files)
2. פתח את תיקיית `algomaykl-optimizer` במחשב
3. העתק את הקבצים לפי ה-README
4. `git add . && git commit -m "patch" && git push`
5. Railway יעשה deploy אוטומטי

