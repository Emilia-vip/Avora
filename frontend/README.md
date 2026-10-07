# Avora

Avora is a mobile app for organising your wardrobe and getting outfit ideas from your own clothes. It is built with Expo and React Native, uses Expo Router for navigation and Supabase for auth, database and image storage.

## Features

- Sign up and sign in with email and password, including password reset.
- Add clothes by taking a photo or picking one from the photo library. The AI cuts the garment out and fills in category, colour, pattern, material, style and season.
- Browse, search and filter the wardrobe; mark favourites.
- Open a garment to correct its details or delete it.
- Get a look for any occasion from the AI stylist, matched to the local weather.
- Delete the account together with all clothes and photos.
- Every user's clothes and photos are private through Row Level Security.

## Tech

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), React Native and React 19
- TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction)
- [Supabase](https://supabase.com/) Auth, Postgres, Storage and Edge Functions (see [`../backend`](../backend/README.md))
- `expo-image` for cached garment photos, `expo-image-picker` for camera and library

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local env file and add the project URL and the publishable/anon key from Supabase → Project Settings → API:

   ```bash
   cp .env.example .env
   ```

   ```text
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

   Only ever use the anon/publishable key in the app. Never put the service role key in `.env` or client code.

3. Set up the database and deploy the edge functions as described in [`backend/README.md`](../backend/README.md).

## Run

```bash
npx expo start
```

```bash
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run lint      # ESLint
```

Clear the Expo cache with `npx expo start -c`.

## Project structure

```text
src/
├── app/                 # Screens (Expo Router)
│   ├── (auth)/          # Sign in and sign up
│   ├── (app)/           # Tabs: home, wardrobe, add, looks, profile
│   └── item/[id].tsx    # One garment: edit, favourite, delete
├── components/          # Reusable UI
├── constants/           # Theme and spacing
├── contexts/            # Auth state
├── hooks/               # Wardrobe, weather and theme hooks
└── lib/                 # Supabase client, storage, outfit matching, settings
```

## Troubleshooting

- Make sure `.env` exists in this folder and the variable names are spelled exactly as above. Restart Expo after changing it.
- `UNAUTHORIZED_INVALID_API_KEY` on sign in: the key belongs to another project or has been revoked.
- Photos don't show: check that `backend/supabase/schema.sql` has been run and the storage bucket is called `wardrobe-images`.
- AI features fail: check that the edge functions are deployed and `GEMINI_API_KEY` is set as a secret.
