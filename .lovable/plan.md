

# הסרת ניקוי cache + חבילת פרויקט מלאה

## שינוי בקובץ אחד

### `src/lib/optimizer/portfolioOptimizer.ts` — שורות 229-242
מחיקה מלאה של בלוק ה-cleanup. עם 24GB RAM אין סיבה לנקות שום דבר באמצע ריצה.

## חבילת Railway
אייצר `/mnt/documents/railway-server-v12-no-cleanup.tar.gz` עם כל קבצי הפרויקט המעודכנים (כולל S1 קבוע + cache 500 + ללא ניקוי).

