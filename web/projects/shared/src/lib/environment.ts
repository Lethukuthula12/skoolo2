/**
 * Public Supabase configuration. The anon key is safe to ship to browsers: every table is
 * protected by row-level security and the key grants nothing on its own.
 */
export const supabaseEnvironment = {
  url: 'https://chfebhulyqawuhjbmlhw.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZmViaHVseXFhd3VoamJtbGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDI3MDUsImV4cCI6MjEwODE3ODcwNX0.XZN1BYV--hwX2QNfarneoVcg4wPnjZK7L4GZeJKSi50',
} as const;
