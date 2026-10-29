import crypto from 'crypto';

// 6 digits: digits from 1 to 6
const CHARSET = '123456';

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
