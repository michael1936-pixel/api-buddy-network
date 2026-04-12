

# תיקון V17 — כל שגיאות ה-Build ב-Railway

## הבעיה
ה-`tsconfig.json` בפרויקט Railway לא מוגדר ל-Node.js, וחסרים type definitions. זה גורם ל-**4 קטגוריות שגיאות**:

1. **`console`, `process`, `setTimeout`, `AbortSignal`, `AbortController`** — חסר `@types/node` ו-`lib` מתאים
2. **`express`, `cors`** — חסר `@types/express`, `@types/cors`
3. **`File`, `FileReader`** — Browser APIs שלא קיימים ב-Node
4. **`@/integrations/supabase/client`** — path alias שלא מוגדר ב-Railway

## התיקון

### 1. `tsconfig.json` — הגדרה נכונה ל-Node.js
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "types": ["node"],
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*"]
}
```

### 2. `package.json` — הוספת devDependencies
```
@types/node, @types/express, @types/cors
```

### 3. `csvParser.ts` — הסרת `readCSVFile` (משתמש ב-`File`/`FileReader`)
הפונקציה לא נדרשת בשרת. נחליף אותה בגרסת Node.js שמקבלת string.

### 4. `testThresholdAgent.ts` + `trainTestSplitAgent.ts` — החלפת import
מ-`@/integrations/supabase/client` ל-import ישיר של `createClient` מ-`@supabase/supabase-js`.

### 5. `portfolioSimulator.ts` — שורות 355-356
הוספת `: number` (כבר תוכנן ב-v16).

## מה ייווצר
חבילת `railway-server-v17.tar.gz` עם כל התיקונים למבנה הקיים.

