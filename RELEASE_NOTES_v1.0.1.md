# 🚀 Tracking v1.0.1 – Release Notes

## "The Physical-Digital Hybrid"

Tracking v1.0.1 is here, refining the bridge between your physical nostalgia and digital library. This update focuses on visual fidelity, database reliability, and solving the "last-mile" friction of adding to your collection.

---

### ✨ What's New & Polished

#### 🎬 Visual Fidelity & Aspect Ratios
- **Crop-Free Library**: Standard posters (TMDB/IMDB) now preserve their original 2:3 aspect ratio across all views.
- **Smart Covers**: Automatic detection switches aspect ratios for custom scans (0.78 for Blu-ray, 0.71 for DVD) to ensure physical case wraps look authentic.
- **Perfect Scaling**: The "On Display" section has been re-engineered with dynamic padding to ensure hero items never clip out of bounds when scaled.

#### 🛠️ Reliable Data Engine
- **Fixed "Add Movie" Button**: Resolved a critical database foreign key constraint that previously stayed in a loading state.
- **Enhanced Search**: You can now search your library not just by title, but by **Cast Members**.
- **Metdata 2.0**: Enhanced the database schema to natively support genres and cast information for every movie in your library.

#### 🌊 UX & Haptics
- **Tactile Feedback**: Added refined haptic sequences for single taps and favorite toggles.
- **Improved Loading States**: Smoother transitions when interacting with deep movie details.

---

### 📦 Technical Distribution Notes

#### Database Migration
The `supabase/schema.sql` has been fully updated. For new environments, ensure you execute the latest script to enable:
- `genres` (JSONB)
- `movie_cast` (JSONB)
- Relaxed `user_id` constraints for seamless anonymous-to-linked transitions.

#### Environment Configuration
Ensure the following keys are set in your production host:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_TMDB_API_KEY`
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`

---

*“Own the Physical. Master the Digital.”*
