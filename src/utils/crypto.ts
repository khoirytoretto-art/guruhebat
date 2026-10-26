/**
 * Security and Cryptographic Utilities
 * Provides AES-GCM (256-bit) encryption, PBKDF2-SHA256 salted password hashing,
 * SHA-256 data integrity checksums, and string sanitization.
 */

// Generate cryptographically random hex salt
export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Convert string to ArrayBuffer
function str2ab(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to Hex string
function ab2hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex string to ArrayBuffer
function hex2ab(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Hash a password using PBKDF2 with SHA-256 and 100,000 iterations
 */
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const finalSalt = salt || generateSalt(16);
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: enc.encode(finalSalt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      
      return {
        hash: ab2hex(derivedBits),
        salt: finalSalt,
      };
    } catch (e) {
      console.warn('SubtleCrypto PBKDF2 failed, using fallback hash:', e);
    }
  }

  // Fast fallback hash if subtle crypto is unavailable
  let hashVal = 0;
  const combo = `${password}_${finalSalt}_asistenguru_v2`;
  for (let i = 0; i < combo.length; i++) {
    const char = combo.charCodeAt(i);
    hashVal = (hashVal << 5) - hashVal + char;
    hashVal |= 0;
  }
  return {
    hash: `fallback_${Math.abs(hashVal).toString(16)}`,
    salt: finalSalt,
  };
}

/**
 * Verifies a password against either a PBKDF2 salted hash or legacy plain-text password.
 */
export async function verifyPassword(
  attempt: string,
  storedPassword?: string,
  storedHash?: string,
  storedSalt?: string
): Promise<boolean> {
  // If storedHash and storedSalt are present, use strong cryptographic check
  if (storedHash && storedSalt) {
    const { hash } = await hashPassword(attempt, storedSalt);
    if (hash === storedHash) return true;
  }

  // Backward compatibility: if plain-text password is stored (e.g. initial '123')
  if (storedPassword && storedPassword === attempt) {
    return true;
  }

  return false;
}

/**
 * Compute SHA-256 checksum of an object or string for tamper detection
 */
export async function computeChecksum(data: any): Promise<string> {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      return ab2hex(hashBuffer);
    } catch {
      // Fallback below
    }
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `chk_${Math.abs(hash).toString(16)}`;
}

/**
 * AES-256-GCM encryption for payload/backups
 */
export async function encryptData(data: any, passphrase = 'ASISTENGURU_YAYASAN_KEY_2026'): Promise<string> {
  const jsonStr = JSON.stringify(data);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 10000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(jsonStr)
      );

      const envelope = {
        enc: 'AES-256-GCM',
        salt: ab2hex(salt.buffer),
        iv: ab2hex(iv.buffer),
        data: ab2hex(encrypted),
        timestamp: new Date().toISOString(),
      };

      return btoa(JSON.stringify(envelope));
    } catch (e) {
      console.warn('AES-GCM encryption failed, using encoded string:', e);
    }
  }

  // Fallback base64
  return btoa(encodeURIComponent(jsonStr));
}

/**
 * Decrypt AES-256-GCM payload/backup
 */
export async function decryptData(cipherText: string, passphrase = 'ASISTENGURU_YAYASAN_KEY_2026'): Promise<any> {
  try {
    const raw = atob(cipherText);
    let envelope: any;
    try {
      envelope = JSON.parse(raw);
    } catch {
      // Legacy fallback
      return JSON.parse(decodeURIComponent(raw));
    }

    if (envelope && envelope.enc === 'AES-256-GCM' && envelope.salt && envelope.iv && envelope.data) {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const enc = new TextEncoder();
        const salt = hex2ab(envelope.salt);
        const iv = hex2ab(envelope.iv);
        const cipherData = hex2ab(envelope.data);

        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          enc.encode(passphrase),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        const key = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt as any,
            iterations: 10000,
            hash: 'SHA-256',
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as any },
          key,
          cipherData as any
        );

        const decodedStr = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decodedStr);
      }
    }

    // In case envelope wasn't AES
    return envelope;
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Gagal mendekripsi data: sandi kunci atau format tidak valid.');
  }
}

/**
 * Sanitize strings against HTML/script injection
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
