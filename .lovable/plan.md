

# שליפת נתונים בזמן אמת — Edge Functions + Frontend Polling

## הגישה
במקום cron כל 15 דקות, נבנה **edge functions שהפרונטאנד קורא להן ישירות** עם רענון כל 30 שניות. זה נותן נתונים כמעט בזמן אמת.

## מה נבנה

### 1. Edge Function: `fetch-market-data`
- קורא ל-**Twelve Data API** (`/time_series?symbol=SPY,VIX&interval=1min&outputsize=1`)
- מחזיר מחירים עדכניים ישירות לפרונטאנד
- גם כותב ל-`market_data` לשמירת היסטוריה

### 2. Edge Function: `fetch-news`
- קורא ל-**Finnhub API** (`/api/v1/news?category=general`)
- מחזיר חדשות ישירות לפרונטאנד
- כותב ל-`news_events` (מסנן כפילויות לפי `event_id`)

### 3. עדכון Frontend
- `useMarketData` → קורא ל-edge function כל **30 שניות** במקום ישירות מהטבלה
- `useNewsEvents` → קורא ל-edge function כל **60 שניות**
- Fallback: אם ה-edge function נכשל, שולף מהטבלה

## דרישות מוקדמות — API Keys
צריך לשמור 2 secrets:
1. **TWELVE_DATA_API_KEY** — מ-Twelve Data
2. **FINNHUB_API_KEY** — מ-Finnhub

## קבצים

| קובץ | פעולה |
|-------|--------|
| `supabase/functions/fetch-market-data/index.ts` | חדש |
| `supabase/functions/fetch-news/index.ts` | חדש |
| `src/hooks/use-trading-data.ts` | עדכון — hooks חדשים שקוראים ל-edge functions |
| `src/pages/News.tsx` | עדכון — שימוש ב-hooks החדשים |

## תוצאה
SPY, VIX וחדשות יתעדכנו כל 30-60 שניות בזמן אמת, ישירות מ-Twelve Data ו-Finnhub.

