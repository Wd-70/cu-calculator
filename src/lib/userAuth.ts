/**
 * 사용자 인증 시스템
 * Web Crypto API를 사용한 키페어 생성 및 관리
 */

const APP_SECRET = 'cu-discount-calculator-v1-secret-key';
const STORAGE_KEY_ENCRYPTED = 'user_encrypted_key';
const STORAGE_KEY_SALT = 'user_salt';
const STORAGE_KEY_PUBLIC = 'user_public_address';

/**
 * 랜덤 salt 생성 (16바이트)
 */
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 랜덤 비밀키 생성 (32바이트 = 64자, 이더리움과 동일)
 */
function generatePrivateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 암호화 키 생성 (APP_SECRET + salt)
 */
async function deriveEncryptionKey(salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_SECRET + salt),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 데이터 암호화
 */
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  // IV + 암호화된 데이터를 합쳐서 반환
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Array.from(combined, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 데이터 복호화
 */
async function decryptData(encryptedHex: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(
    encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * 비밀키에서 주소 생성 (이더리움 스타일: 0x + 20바이트)
 */
function privateKeyToAddress(privateKeyHex: string): string {
  // 비밀키를 해시해서 앞 20바이트 사용
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKeyHex);

  // 동기적으로 처리하기 위해 간단한 해시 사용
  let hash = 0;
  const address: number[] = [];

  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }

  // 비밀키를 바이트 배열로 변환
  const privateKeyBytes = privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16));

  // 간단한 해시로 20바이트 주소 생성
  for (let i = 0; i < 20; i++) {
    const val = (privateKeyBytes[i] ^ privateKeyBytes[(i + 12) % 32]) & 0xff;
    address.push(val);
  }

  return '0x' + address.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 새 계정 생성
 */
export async function createAccount(): Promise<{ address: string; privateKey: string }> {
  try {
    // 1. 비밀키 생성 (32바이트 = 64자)
    const privateKeyHex = generatePrivateKey();

    // 2. 비밀키에서 주소 생성
    const address = privateKeyToAddress(privateKeyHex);

    // 3. Salt 생성
    const salt = generateSalt();

    // 4. 암호화 키 생성
    const encryptionKey = await deriveEncryptionKey(salt);

    // 5. 비밀키 암호화
    const encryptedPrivateKey = await encryptData(privateKeyHex, encryptionKey);

    // 6. localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ENCRYPTED, encryptedPrivateKey);
      localStorage.setItem(STORAGE_KEY_SALT, salt);
      localStorage.setItem(STORAGE_KEY_PUBLIC, address);
    }

    return { address, privateKey: privateKeyHex };
  } catch (error) {
    console.error('Failed to create account:', error);
    throw new Error('계정 생성에 실패했습니다.');
  }
}

/**
 * 저장된 계정 불러오기
 */
export async function loadAccount(): Promise<{ address: string } | null> {
  try {
    if (typeof window === 'undefined') return null;

    const encryptedKey = localStorage.getItem(STORAGE_KEY_ENCRYPTED);
    const salt = localStorage.getItem(STORAGE_KEY_SALT);
    const address = localStorage.getItem(STORAGE_KEY_PUBLIC);

    if (!encryptedKey || !salt || !address) {
      return null;
    }

    // 복호화 시도 (검증용)
    try {
      const encryptionKey = await deriveEncryptionKey(salt);
      await decryptData(encryptedKey, encryptionKey);
    } catch (error) {
      console.error('Failed to decrypt private key:', error);
      return null;
    }

    return { address };
  } catch (error) {
    console.error('Failed to load account:', error);
    return null;
  }
}

/**
 * 비밀키 확인 (백업용)
 */
export async function getPrivateKey(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;

    const encryptedKey = localStorage.getItem(STORAGE_KEY_ENCRYPTED);
    const salt = localStorage.getItem(STORAGE_KEY_SALT);

    if (!encryptedKey || !salt) {
      return null;
    }

    const encryptionKey = await deriveEncryptionKey(salt);
    const privateKeyHex = await decryptData(encryptedKey, encryptionKey);

    return privateKeyHex;
  } catch (error) {
    console.error('Failed to get private key:', error);
    return null;
  }
}

/**
 * 비밀키로 계정 복구
 */
export async function restoreAccount(privateKeyHex: string): Promise<{ address: string }> {
  try {
    // 1. 비밀키 형식 검증 (64자 hex)
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
      throw new Error('비밀키는 64자의 16진수여야 합니다.');
    }

    // 2. 비밀키에서 주소 생성
    const address = privateKeyToAddress(privateKeyHex);

    // 3. Salt 생성
    const salt = generateSalt();

    // 4. 암호화 키 생성
    const encryptionKey = await deriveEncryptionKey(salt);

    // 5. 비밀키 암호화
    const encryptedPrivateKey = await encryptData(privateKeyHex, encryptionKey);

    // 6. localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ENCRYPTED, encryptedPrivateKey);
      localStorage.setItem(STORAGE_KEY_SALT, salt);
      localStorage.setItem(STORAGE_KEY_PUBLIC, address);
    }

    return { address };
  } catch (error) {
    console.error('Failed to restore account:', error);
    throw new Error('계정 복구에 실패했습니다. 올바른 비밀키인지 확인해주세요.');
  }
}

/**
 * 현재 사용자 주소 가져오기
 */
export function getCurrentUserAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_PUBLIC);
}

/**
 * 계정 삭제
 */
export function deleteAccount(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_ENCRYPTED);
  localStorage.removeItem(STORAGE_KEY_SALT);
  localStorage.removeItem(STORAGE_KEY_PUBLIC);
}

/**
 * 계정 존재 여부 확인
 */
export function hasAccount(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(STORAGE_KEY_PUBLIC);
}
