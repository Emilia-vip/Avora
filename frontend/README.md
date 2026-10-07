# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure Supabase

   Copy `.env.example` to `.env` and replace both placeholder values with the URL and publishable/anon key from your Supabase project's API settings. The variable names must remain:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```

# Avora

Avora är en mobilapp för att organisera garderoben och skapa outfitförslag från dina egna kläder. Appen är byggd med Expo och React Native, använder Expo Router för navigering och Supabase för autentisering, databas och bildlagring.

## Funktioner

- Skapa konto och logga in med e-post och lösenord.
- Fotografera plagg direkt med kameran.
- Spara plagg med namn, kategori, märke och färg.
- Visa, sök och filtrera garderoben.
- Markera favoritplagg.
- Se outfitförslag och be Mini AI Stylist om en look utifrån garderoben.
- Hålla varje användares plagg och bilder privata med Row Level Security.

## Teknik

- [Expo SDK 54](https://docs.expo.dev/)
- React Native 0.81 och React 19
- TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction)
- [Supabase](https://supabase.com/) Auth, Postgres och Storage
- `expo-image-picker` för kamerabilder

## Förutsättningar

Installera följande innan du börjar:

- Node.js LTS
- npm
- Ett Supabase-projekt
- Expo Go eller en iOS-/Android-simulator

## Installation

1. Installera projektets beroenden:

   ```bash
   npm install
   ```

2. Skapa en lokal miljövariabelfil:

   ```bash
   cp .env.example .env
   ```

3. Öppna `.env` och ange projektets URL och publika Supabase-nyckel:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=https://ditt-projekt.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=din-anon-eller-publishable-key
   ```

   Använd en anon/publishable key i appen. Lägg aldrig in en Supabase service role key i `.env` eller i klientkod.

## Konfigurera Supabase

1. Öppna Supabase Dashboard för projektet.
2. Gå till **SQL Editor**.
3. Kör innehållet i [`supabase/schema.sql`](supabase/schema.sql) en gång.

Skriptet skapar tabellen `clothing_items`, den privata Storage-bucketen `wardrobe-images` och RLS-policyer som begränsar åtkomst till den inloggade användarens egna data. Bilder sparas i en mapp med användarens UUID och visas via tidsbegränsade signed URLs.

## Starta appen

Starta Expo-utvecklingsservern:

```bash
npx expo start
```

Vanliga kommandon:

```bash
npm run ios       # iOS-simulator
npm run android   # Android-emulator
npm run web       # webbversion
npm run lint      # ESLint
```

Skanna QR-koden med Expo Go eller tryck `i` för iOS-simulator och `a` för Android-emulator.

## Projektstruktur

```text
src/
├── app/                 # Skärmar och Expo Router-routes
│   ├── (auth)/          # Login och registrering
│   └── (app)/           # Hem, garderob, outfits, profil och lägg till
├── components/          # Återanvändbara UI-komponenter
├── constants/           # Tema och spacing
├── contexts/            # Auth-state
├── hooks/               # Appens hooks
└── lib/                 # Supabase-klient
supabase/
└── schema.sql           # Databas-, Storage- och RLS-konfiguration
```

## Utveckling

Appens routes ligger i `src/app` och följer Expo Routers filbaserade routing. Efter ändringar kan Expo-cachen rensas med:

```bash
npx expo start -c
```

## Felsökning

- Kontrollera att filen `.env` finns i projektroten och att variabelnamnen är exakt rättstavade.
- Starta om Expo efter ändringar i `.env`.
- Om registrering eller inloggning ger `UNAUTHORIZED_INVALID_API_KEY`, kontrollera att Supabase-nyckeln hör till rätt projekt och inte är återkallad.
- Om bilder inte visas, kontrollera att `supabase/schema.sql` har körts och att Storage-bucketen heter `wardrobe-images`.

## Licens

Se [`LICENSE`](LICENSE) för projektets licens.
