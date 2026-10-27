import crypto from 'crypto';

// 32 characters: uppercase alphanumeric excluding ambiguous chars (0, O, 1, I)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length: number = 6): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    const index = bytes[i] % CHARSET.length;
    code += CHARSET[index];
  }
  return code;
}

export function sanitizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
