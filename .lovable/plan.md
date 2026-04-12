

# הוספת Heartbeat ו-Child Process Wrapper לשרת Railway

## איך מגיעים לקוד בשרת Railway

1. **Railway Dashboard** → https://railway.app/dashboard
2. לחץ על הפרויקט שלך (AlgoMaykl / optimizer)
3. לחץ על ה-Service → **Settings** → תחת **Source** תראה קישור ל-GitHub repo
4. לחלופין: פתח ישירות את ה-GitHub repo של השרת, שם יש לך כנראה מבנה כזה:

```text
railway-server/
├── src/
│   ├── server.ts (או index.ts)       ← נקודת כניסה
│   ├── routes/
│   │   └── optimize.ts               ← הנתיב /api/optimize
│   ├── lib/optimizer/
│   │   ├── smartOptimizer.ts          ← מנוע 30 השלבים
│   │   ├── portfolioOptimizer.ts
│   │   ├── indicatorCache.ts
│   │   └── ...
│   └── ...
├── package.json
└── ...
```

**הקובץ העיקרי שצריך לשנות הוא הקובץ שמטפל ב-`/api/optimize`** — כנראה `routes/optimize.ts` או ישירות ב-`server.ts`.

## מה לשנות — 3 דברים

### 1. עטיפת הריצה ב-Child Process (בקובץ route של optimize)

במקום להריץ את `smartOptimize()` ישירות ב-process הראשי, להפריד ל-worker:

```typescript
// routes/optimize.ts — שינוי עיקרי
import { fork } from 'child_process';
import path from 'path';

router.post('/api/optimize', async (req, res) => {
  const { symbols, run_ids, enabled_stages } = req.body;
  res.json({ status: 'started', run_ids });

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const runId = run_ids[i];

    // Fork worker process
    const worker = fork(path.join(__dirname, '../workers/optimizer-worker.js'), [], {
      execArgv: ['--max-old-space-size=3584'], // הגבלת heap
      env: { ...process.env },
    });

    worker.send({ symbol, runId, enabled_stages });

    worker.on('exit', async (code) => {
      if (code !== 0) {
        console.error(`Worker for ${symbol} exited with code ${code}`);
        await supabase.from('optimization_runs').update({
          status: 'failed',
          error_message: `Process crashed (exit code ${code}) — likely OOM`,
        }).eq('id', runId);
      }
    });

    worker.on('error', async (err) => {
      console.error(`Worker error for ${symbol}:`, err.message);
      await supabase.from('optimization_runs').update({
        status: 'failed',
        error_message: `Worker error: ${err.message}`,
      }).eq('id', runId);
    });
  }
});
```

### 2. ליצור קובץ Worker חדש — `workers/optimizer-worker.js`

```typescript
// workers/optimizer-worker.ts
import { createClient } from '@supabase/supabase-js';
import { smartOptimize } from '../lib/optimizer/smartOptimizer';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

process.on('message', async (msg: any) => {
  const { symbol, runId, enabled_stages } = msg;

  // === HEARTBEAT: עדכון כל 15 שניות ===
  const heartbeat = setInterval(async () => {
    try {
      const mem = process.memoryUsage();
      console.log(`💓 Heartbeat run=${runId} | heap=${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(0)}MB`);
      await supabase.from('optimization_runs').update({
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
    } catch (e) {
      console.warn('Heartbeat update failed:', e);
    }
  }, 15_000);

  try {
    await supabase.from('optimization_runs').update({
      status: 'running',
      updated_at: new Date().toISOString(),
    }).eq('id', runId);

    // הריצה עצמה — עם progress callback שגם מעדכן DB
    const result = await smartOptimize(symbol, {
      runId,
      enabled_stages,
      onProgress: async (info) => {
        await supabase.from('optimization_runs').update({
          current_stage: info.currentStage,
          total_stages: info.totalStages,
          current_combo: info.current,
          total_combos: info.total,
          best_train_return: info.bestReturn,
          best_test_return: info.bestTestReturn,
          stage_name: info.stageName,
          updated_at: new Date().toISOString(),
        }).eq('id', runId);
      },
      onStageComplete: (stageNum: number) => {
        // ניקוי זיכרון אגרסיבי אחרי כל שלב
        if (global.gc) global.gc();
        const mem = process.memoryUsage();
        console.log(`🧹 Stage ${stageNum} done | heap=${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB`);
      },
    });

    await supabase.from('optimization_runs').update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    }).eq('id', runId);

  } catch (error: any) {
    console.error(`❌ Optimization failed for ${symbol}:`, error.message);
    await supabase.from('optimization_runs').update({
      status: 'failed',
      error_message: error.message?.substring(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
  } finally {
    clearInterval(heartbeat);
    process.exit(0);
  }
});
```

### 3. ניקוי זיכרון ב-smartOptimizer — בסוף כל שלב

בקובץ `lib/optimizer/smartOptimizer.ts` בשרת, **בסוף הלולאה של כל שלב** (אחרי `stageResults.push(...)`) להוסיף:

```typescript
// אחרי כל שלב — ניקוי cache
indicatorCache.clear();

// קיצוץ CombinationCache — שומר רק 500 הטובים
if (cache.size > 500) {
  const entries = [...cache.entries()]
    .sort((a, b) => b[1].trainReturn - a[1].trainReturn)
    .slice(0, 500);
  cache.clear();
  for (const [k, v] of entries) cache.set(k, v);
}

// GC ידני אם זמין
if (typeof global !== 'undefined' && (global as any).gc) {
  (global as any).gc();
}
```

## סיכום — 3 קבצים לגעת בהם בשרת Railway

| קובץ | שינוי |
|-------|-------|
| `routes/optimize.ts` (או `server.ts`) | עטיפה ב-`child_process.fork()` עם error handler |
| `workers/optimizer-worker.ts` **(חדש)** | heartbeat כל 15s + progress updates + error handling |
| `lib/optimizer/smartOptimizer.ts` | ניקוי cache + GC אחרי כל שלב |

## הגדרות Railway

ב-**Railway Service Settings** → **Variables**, ודא שקיימים:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

ב-**Start Command** או `package.json`, הוסף `--expose-gc` כדי שה-GC הידני יעבוד:
```
node --expose-gc --max-old-space-size=3584 dist/server.js
```

