/**
 * Where to send someone after they sign in. Only a same-origin absolute path
 * is honoured; anything else (an external URL, a protocol-relative "//evil",
 * an empty value) falls back to /portal so the login page can never be used
 * as an open redirect. Shared by the password form and the OAuth callback.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    return raw;
  }
  return "/portal";
}
