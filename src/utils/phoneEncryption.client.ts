// Client-side phone encryption (Web Crypto API) for profile edit/display.
// Key must be set in NEXT_PUBLIC_PHONE_ENCRYPTION_KEY as a base64-encoded 32-byte value.

async function getKey(): Promise<CryptoKey> {
  const keyBase64 = process.env.NEXT_PUBLIC_PHONE_ENCRYPTION_KEY ?? "";
  if (!keyBase64) {
    throw new Error("NEXT_PUBLIC_PHONE_ENCRYPTION_KEY is not set");
  }
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptPhoneClient(phone: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(phone);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptPhoneClient(encrypted: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
