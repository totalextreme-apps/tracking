# Tracking

A hybrid media manager bridging physical nostalgia (VHS/DVD) and digital convenience. Built with Expo Router, NativeWind, and Supabase.

## Tech Stack

- **Framework:** Expo Router (TypeScript)
- **Styling:** NativeWind (Tailwind CSS)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Data:** TMDB API
- **State:** React Query (TanStack Query)
- **Hardware:** expo-haptics, expo-file-system

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and add your keys:

```bash
cp .env.example .env
```

### 3. Supabase setup

Run `supabase/schema.sql` in your Supabase SQL editor to create the tables and RLS policies. If you already created the tables, run `supabase/rls-policies.sql` instead.

**Enable Anonymous Auth:** In Supabase Dashboard → Authentication → Providers → enable **Anonymous sign-ins**. (Required for add-to-collection without email sign-up.)

### 4. TMDB API key

Get a free API key at [themoviedb.org](https://www.themoviedb.org/settings/api) and add it to `.env` as `EXPO_PUBLIC_TMDB_API_KEY`.

### 5. Run the app

```bash
npm start
```

Then press `i` for iOS or `a` for Android.

## Project Structure

- `app/` - Expo Router screens
- `components/` - Reusable UI (OnDisplayCard, StackCard)
- `lib/` - Supabase client, dummy data, utilities
- `types/` - TypeScript database types
- `context/` - ThriftMode and other global state

## Features

- **On Display** - Hero section with 3D-tilt physical cards and glowing digital cinema cards
- **The Stacks** - Library grid with format-stacked cards
- **Thrift Mode** - Toggle to show wishlist items (coming soon)
- **Settings** - Print manifest CSV export (coming soon)
