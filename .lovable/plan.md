

# העתקת הלוגיקה המקומית לשרת — ZIP מלא ונקי

## הבעיה
הקוד ב-Lovable (שמריץ את האופטימיזציה המקומית) כבר מתוקן ועובד מהר. אבל ב-Railway כנראה רץ עדיין קוד ישן עם `indicatorCache.clear()` או eviction. צריך להבטיח שהקוד ב-Railway **זהה לחלוטין** לקוד המקומי.

## הפתרון
1. ייצור ZIP חדש (`optimizer-bundle-v16.zip`) שמכיל את **כל** קבצי `src/lib/optimizer/` כפי שהם כרגע ב-Lovable — **חוץ מ-3 קבצים** שמכילים קוד browser-only ולא עוברים build ב-Railway:
   - `csvParser.ts` (FileReader)
   - `testThresholdAgent.ts` (Supabase import)
   - `trainTestSplitAgent.ts` (Supabase import)

2. עדכון `OPTIMIZER_BUILD` ל-`v16-2026-04-12-full-sync` כדי לוודא שהקוד הנכון רץ.

3. הקבצים שייכללו (13 קבצים):
   - `debugConfig.ts`, `indicatorCache.ts`, `indicators.ts`, `memoryAwareOptimizer.ts`
   - `multiObjectiveMetrics.ts`, `parameterValidation.ts`, `portfolioOptimizer.ts`
   - `portfolioSimulator.ts`, `presetConfigs.ts`, `s2GroundTruth.ts`
   - `smartOptimizer.ts`, `strategies.ts`, `types.ts`

## מה ישתנה
- שינוי שורה אחת: `OPTIMIZER_BUILD` ב-`smartOptimizer.ts`
- ה-ZIP ייצור עם כל הקבצים הנקיים — ללא cache clearing, ללא eviction, ללא setMaxSize calls
- פקודת deploy פשוטה שמעתיקה את כל 13 הקבצים ל-Railway בבת אחת

## פקודות deploy (אחרי ההורדה)
```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\optimizer-bundle-v16.zip" -DestinationPath "$env:USERPROFILE\Downloads\bundle-v16" -Force
Copy-Item "$env:USERPROFILE\Downloads\bundle-v16\src\lib\optimizer\*" ".\src\lib\optimizer\" -Force
git add -A; git commit -m "v16: full sync with local optimizer — no cache eviction"; git push
```

