// Escape % and _ so user input is matched literally inside LIKE patterns.
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}
