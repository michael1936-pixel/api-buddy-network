

# תיקון V16 — שגיאות TS7022 ב-portfolioSimulator.ts

## הבעיה
שורות 355-356: `pf` ו-`fs` מקבלים `any` כי TypeScript לא מצליח להסיק טיפוס מביטויי `??` מקוננים.

## התיקון
שינוי שתי שורות בלבד:
```typescript
// שורה 355 — מ:
let pf = trailStop ?? stopAtBarOpen ?? (baseSL ?? entryPrice * 0.98);
// ל:
let pf: number = trailStop ?? stopAtBarOpen ?? (baseSL ?? entryPrice * 0.98);

// שורה 356 — מ:
let fs = pf;
// ל:
let fs: number = pf;
```

## מה ייווצר
חבילת `railway-server-v16.zip` עם התיקון הזה בלבד (שאר הקבצים זהים ל-v15).

