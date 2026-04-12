

# תיקון חבילת Railway — מבנה תיקיות נכון

## הבעיה
ה-v12 ארז קבצים מתיקיית Lovable (`src/lib/optimizer/`) במקום מבנה שרת Railway (`railway-server/src/optimizer/`). ב-Railway ה-Dockerfile מחפש `src/server.ts` ולא מוצא.

## מה אעשה

1. **ייצור חבילה חדשה** `railway-server-v13-fixed.tar.gz` עם המבנה הנכון:

```text
railway-server/
├── src/
│   ├── server.ts          ← מה-full package (לא השתנה)
│   └── optimizer/
│       ├── portfolioOptimizer.ts  ← מעודכן (ללא cleanup)
│       ├── indicatorCache.ts      ← מעודכן (maxSize=500)
│       ├── smartOptimizer.ts
│       ├── strategies.ts
│       ├── indicators.ts
│       ├── types.ts
│       └── ... (שאר הקבצים)
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

2. **הקבצים המעודכנים** (portfolioOptimizer + indicatorCache) יילקחו מה-Lovable project
3. **שאר הקבצים** (server.ts, Dockerfile, package.json, tsconfig) מה-full package המקורי
4. גם אגדיל את `max-old-space-size` ב-Dockerfile מ-2048 ל-20480 (יש לך 24GB)

## שינוי בקובץ
אין שינוי בקוד — רק ייצור חבילת deploy נכונה.

