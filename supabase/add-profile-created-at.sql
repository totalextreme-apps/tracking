-- Migration: Add created_at column to profiles
alter table public.profiles 
  add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;
