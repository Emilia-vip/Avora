# Avora backend (Supabase)

- `supabase/schema.sql`: the whole database: `clothing_items`, RLS policies, the `wardrobe-images` bucket and the daily AI quota (`ai_usage`). Safe to run again.
- `supabase/functions/`: edge functions (`analyze-clothing`, `cutout-clothing`, `suggest-outfit`, `delete-account`). `_shared/` holds the code they share (CORS, login check, Gemini calls, quota).

## Set up / update the database

Paste `supabase/schema.sql` into Supabase Dashboard → SQL Editor and run it.

## Deploy the functions

```bash
cd backend
npx supabase login
npx supabase link --project-ref rdiaqomrlueaxnvjycqi
npx supabase functions deploy analyze-clothing
npx supabase functions deploy cutout-clothing
npx supabase functions deploy suggest-outfit
npx supabase functions deploy delete-account
```

Secrets (Dashboard → Edge Functions → Secrets): `GEMINI_API_KEY`, optionally `REMOVE_BG_API_KEY`,
`GEMINI_MODEL`, `GEMINI_SEGMENT_MODEL` and daily limits such as `AI_DAILY_LIMIT_SUGGEST_OUTFIT=200`
(defaults: 60 analyses, 60 cut-outs, 100 outfit suggestions per user and day).
