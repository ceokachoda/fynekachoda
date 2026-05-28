import "@testing-library/jest-dom/vitest";

// Public env vars required by `lib/env.ts` at module load. Tests don't hit a
// real Supabase, but the require chain throws if these are missing.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fake.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "fake-anon";

// JSDOM doesn't ship matchMedia; the AppShell + Tailwind responsive utilities
// don't call it directly (Tailwind 4 uses CSS-only breakpoints), but shadcn
// primitives sometimes do. Provide a no-op shim so tests stay quiet.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
