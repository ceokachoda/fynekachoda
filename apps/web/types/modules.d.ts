// Type stubs for non-JS imports webpack supports.
// (Kept minimal — react-pdf worker resolved via new URL(..., import.meta.url).)

declare module "*.mjs?url" {
  const src: string;
  export default src;
}
