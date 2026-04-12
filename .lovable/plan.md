

# חבילת Railway מלאה — V14 (ZIP)

## מה נכלל

חבילת שרת Node.js/Express מוכנה ל-deploy, בפורמט ZIP (עובד טוב ב-Windows).

### מבנה:
```text
railway-server/
├── src/
│   ├── server.ts              ← Express + /api/optimize endpoint
│   └── optimizer/
│       ├── types.ts
│       ├── indicators.ts
│       ├── indicatorCache.ts   ← maxSize=500
│       ├── strategies.ts
│       ├── portfolioSimulator.ts
│       ├── portfolioOptimizer.ts  ← ללא cleanup
│       ├── smartOptimizer.ts      ← ללא cleanup בין שלבים
│       ├── multiObjectiveMetrics.ts
│       ├── parameterValidation.ts
│       ├── presetConfigs.ts
│       ├── debugConfig.ts
│       ├── csvParser.ts
│       └── s2GroundTruth.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## תיקוני ביצועים בחבילה

### 1. `portfolioOptimizer.ts` — כבר תוקן (אין cleanup)

### 2. `smartOptimizer.ts` — 3 בעיות שעדיין קיימות:

**שורות 398-404**: מחיקת כל ה-cache entries שלא protected בין rounds
→ **הסרה מלאה** — ה-cache שימושי בין rounds

**שורות 416-428**: מחיקת cache + indicator cache + GC בין **כל שלב**
→ **הסרה מלאה** — זה ההרס הגדול ביותר, מאלץ חישוב מחדש של אינדיקטורים

**שורות 430-435**: `indicatorCache.setMaxSize(5)` ב-Round 2/3
→ **שינוי ל-500** — יש 24GB, אין סיבה להגביל ל-5

### 3. `indicatorCache.ts` — כבר מוגדר maxSize=500

### 4. `Dockerfile` — `--max-old-space-size=20480` (20GB מתוך 24GB)

### 5. `server.ts` — Express server עם:
- `POST /api/optimize` — מקבל symbols + run_ids, מריץ ברקע
- מוריד data מ-market_data table
- מעדכן progress ל-optimization_runs כל 3 שניות
- שומר תוצאות ל-optimization_results

## פורמט
ZIP במקום tar.gz — נפתח בקלות ב-Windows.

## Deploy
```powershell
Expand-Archive railway-server-v14.zip -DestinationPath .
cd railway-server
git init
git add .
git commit -m "v14 no cleanup"
git remote add origin https://github.com/michael1936-pixel/algomaykl-optimizer.git
git push -u origin main --force
```

## צפי ביצועים
- **לפני**: ~172 combos/sec (cache נמחק כל 200 combos + בין כל שלב)
- **אחרי**: 5,000-10,000+ combos/sec (cache נשמר, אינדיקטורים מחושבים פעם אחת)

