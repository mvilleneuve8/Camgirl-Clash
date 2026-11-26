/**
 * Public assets live in the Vite publicDir (`assets/`).
 * Absolute "/foo.png" paths break under Electron's file:// protocol —
 * resolve against BASE_URL so packaged builds use "./foo.png".
 */
export function publicAsset(name: string): string {
  const clean = name.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}
