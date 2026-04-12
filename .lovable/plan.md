

# תוכנית: בניית פרויקט Railway מלא ומוכן להורדה

## מה אעשה

אבנה את **כל** הפרויקט `algomaykl-optimizer` מחדש כתיקייה מלאה להורדה, עם כל התיקונים משולבים בפנים. אתה פשוט:
1. מוחק את התיקייה הישנה `algomaykl-optimizer`
2. מחליף בתיקייה החדשה
3. `git push`

## מה ישתנה לעומת הגרסה הנוכחית

### 1. קובץ חדש: `optimizer/serverLogger.ts`
כותב לוגים לטבלת `optimization_run_logs` — heap usage, stage, combo count

### 2. קובץ חדש: `optimizer/memoryGuard.ts`  
מוניטור זיכרון שעוצר בצורה נשלטת לפני OOM (Out of Memory)

### 3. תיקון: `optimizer/indicatorCache.ts`
תיקון cache key עם dataset identity — מונע cache collisions בין סימבולים שונים

### 4. עדכון: `workers/optimizer-worker.ts`
- שילוב MemoryGuard — מפעיל אותו בתחילת כל optimization run
- שילוב ServerLogger — כותב לוגים לDB כל 3 שניות
- ניקוי זיכרון אוטומטי (GC) כל 300 קומבינציות

### 5. עדכון: `server.ts`
- Import של הכלים החדשים (אין שינוי בלוגיקה)

## קבצים שנוצרים (להורדה)

```text
/mnt/documents/algomaykl-optimizer/
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── package.json
├── package-lock.json          ← לא נגע, ישאר כמו שהוא
├── server.ts
├── tsconfig.json
├── optimizer/
│   ├── csvParser.ts           ← ללא שינוי
│   ├── debugConfig.ts         ← ללא שינוי
│   ├── indicatorCache.ts      ← מתוקן (dataset identity)
│   ├── indicators.ts          ← ללא שינוי
│   ├── memoryAwareOptimizer.ts← ללא שינוי
│   ├── memoryGuard.ts         ← חדש
│   ├── multiObjectiveMetrics.ts← ללא שינוי
│   ├── parameterValidation.ts ← ללא שינוי
│   ├── portfolioOptimizer.ts  ← ללא שינוי
│   ├── portfolioSimulator.ts  ← ללא שינוי
│   ├── presetConfigs.ts       ← ללא שינוי
│   ├── s2GroundTruth.ts       ← ללא שינוי
│   ├── serverLogger.ts        ← חדש
│   ├── smartOptimizer.ts      ← ללא שינוי
│   ├── strategies.ts          ← ללא שינוי
│   └── types.ts               ← ללא שינוי
├── workers/
│   ├── fork-optimizer.ts      ← ללא שינוי
│   └── optimizer-worker.ts    ← מעודכן (logger + guard)
└── src/lib/optimizer/         ← ללא שינוי (duplicate from Lovable)
```

## הוראות אחרי הורדה

```text
1. מחק את תיקיית algomaykl-optimizer הישנה
2. שים את התיקייה החדשה במקום
3. פתח Terminal בתיקייה:
   cd algomaykl-optimizer
   git add .
   git commit -m "Full rebuild with memory guard + logging"
   git push
4. Railway עושה deploy אוטומטי
```

## פרטים טכניים

- **MemoryGuard**: בודק heap כל 5 שניות, אם heap > 3.5GB → זורק שגיאה נשלטת שנתפסת ומעדכנת status=failed בDB
- **ServerLogger**: כותב ל-`optimization_run_logs` מידע על כל stage — heap, combos, cache size
- **indicatorCache fix**: מוסיף `datasetId` (symbol + date range + candle count) ל-cache key, מונע שימוש שגוי בנתונים מסימבול אחר
- הקבצים הללו מתחברים בתוך `optimizer-worker.ts` בלבד — אין שינוי ל-`smartOptimizer.ts` או ל-`portfolioOptimizer.ts`

