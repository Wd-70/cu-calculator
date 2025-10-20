/**
 * 사용자 인증 시스템 (이더리움 기반)
 * ethers.js를 사용한 실제 암호화폐 방식
 *
 * 핵심: 서명에서 주소를 복구하므로 공개키 저장 불필요!
 */

import { ethers } from 'ethers';

const STORAGE_KEY_PRIVATE = 'user_private_key';
const STORAGE_KEY_ADDRESS = 'user_address';

/**
 * 새 계정 생성
 */
export async function createAccount(): Promise<{ address: string; privateKey: string }> {
  try {
    // 이더리움 지갑 생성
    const wallet = ethers.Wallet.createRandom();

    const privateKey = wallet.privateKey; // 0x... 형태
    const address = wallet.address;       // 0x... 형태 (체크섬 포함)

    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PRIVATE, privateKey);
      localStorage.setItem(STORAGE_KEY_ADDRESS, address);
    }

    console.log('✅ Account created:', address);
    return { address, privateKey };
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

    const privateKey = localStorage.getItem(STORAGE_KEY_PRIVATE);
    const address = localStorage.getItem(STORAGE_KEY_ADDRESS);

    if (!privateKey || !address) {
      return null;
    }

    // 비밀키 유효성 검증
    try {
      const wallet = new ethers.Wallet(privateKey);
      // 저장된 주소와 비밀키로부터 생성한 주소가 일치하는지 확인
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        console.error('Address mismatch');
        return null;
      }
    } catch (error) {
      console.error('Invalid private key:', error);
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
    return localStorage.getItem(STORAGE_KEY_PRIVATE);
  } catch (error) {
    console.error('Failed to get private key:', error);
    return null;
  }
}

/**
 * 비밀키로 계정 복구
 */
export async function restoreAccount(privateKey: string): Promise<{ address: string }> {
  try {
    // 비밀키 형식 검증 (0x 접두사 추가)
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }

    // 비밀키로 지갑 생성
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;

    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PRIVATE, wallet.privateKey);
      localStorage.setItem(STORAGE_KEY_ADDRESS, address);
    }

    console.log('✅ Account restored:', address);
    return { address };
  } catch (error) {
    console.error('Failed to restore account:', error);
    throw new Error('계정 복구에 실패했습니다. 올바른 비밀키인지 확인해주세요.');
  }
}

/**
 * 메시지 서명 (클라이언트용)
 * EIP-191 표준 서명 방식 사용
 */
export async function signMessage(message: string): Promise<string> {
  try {
    if (typeof window === 'undefined') {
      throw new Error('Client-side only');
    }

    const privateKey = localStorage.getItem(STORAGE_KEY_PRIVATE);
    if (!privateKey) {
      throw new Error('계정이 없습니다.');
    }

    // 지갑 생성
    const wallet = new ethers.Wallet(privateKey);

    // 서명 생성 (EIP-191 방식)
    const signature = await wallet.signMessage(message);

    return signature;
  } catch (error) {
    console.error('Failed to sign message:', error);
    throw new Error('서명 생성에 실패했습니다.');
  }
}

/**
 * 서명 검증 및 서명자 주소 복구
 *
 * @returns 서명자의 주소 (복구 실패 시 null)
 */
export function recoverAddress(message: string, signature: string): string | null {
  try {
    // 서명에서 주소 복구
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress;
  } catch (error) {
    console.error('Failed to recover address:', error);
    return null;
  }
}

/**
 * 서명 검증 (특정 주소가 서명했는지 확인)
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = recoverAddress(message, signature);
    if (!recoveredAddress) return false;

    // 대소문자 구분 없이 비교
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Failed to verify signature:', error);
    return false;
  }
}

/**
 * 현재 사용자 주소 가져오기
 */
export function getCurrentUserAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_ADDRESS);
}

/**
 * 계정 삭제
 */
export function deleteAccount(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_PRIVATE);
  localStorage.removeItem(STORAGE_KEY_ADDRESS);
}

/**
 * 계정 존재 여부 확인
 */
export function hasAccount(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(STORAGE_KEY_ADDRESS);
}

/**
 * 타임스탬프 포함 메시지 서명 (재사용 공격 방지)
 * 클라이언트에서 사용
 */
export async function signWithTimestamp(data: any): Promise<{
  signature: string;
  timestamp: number;
  address: string;
}> {
  const timestamp = Date.now();
  const address = getCurrentUserAddress();

  if (!address) {
    throw new Error('계정이 없습니다.');
  }

  // 데이터 + 타임스탬프를 함께 서명
  const message = JSON.stringify({ ...data, timestamp, address });
  const signature = await signMessage(message);

  return { signature, timestamp, address };
}

/**
 * 타임스탬프 포함 서명 검증
 * 서버/클라이언트 모두 사용 가능
 *
 * @param data - 원본 데이터
 * @param signature - 서명
 * @param timestamp - 타임스탬프
 * @param claimedAddress - 주장하는 주소
 * @param maxAgeMs - 최대 유효 시간 (기본 5분)
 * @returns 검증 성공 여부
 */
export function verifyWithTimestamp(
  data: any,
  signature: string,
  timestamp: number,
  claimedAddress: string,
  maxAgeMs: number = 5 * 60 * 1000 // 기본 5분
): boolean {
  try {
    // 1. 타임스탬프 검증 (재사용 공격 방지)
    const now = Date.now();
    if (now - timestamp > maxAgeMs) {
      console.error('Signature expired');
      return false;
    }

    // 타임스탬프가 미래인 경우도 거부
    if (timestamp > now + 60000) { // 1분 이상 미래
      console.error('Timestamp is in the future');
      return false;
    }

    // 2. 메시지 재구성
    const message = JSON.stringify({ ...data, timestamp, address: claimedAddress });

    // 3. 서명에서 주소 복구
    const recoveredAddress = recoverAddress(message, signature);
    if (!recoveredAddress) {
      console.error('Failed to recover address from signature');
      return false;
    }

    // 4. 복구된 주소와 주장하는 주소 비교
    if (recoveredAddress.toLowerCase() !== claimedAddress.toLowerCase()) {
      console.error('Address mismatch:', {
        recovered: recoveredAddress,
        claimed: claimedAddress
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to verify signature with timestamp:', error);
    return false;
  }
}

/**
 * 액션 타입을 포함한 서명 생성 (더 안전한 방식)
 * 다른 컨텍스트에서 서명 재사용 방지
 */
export async function signAction(
  action: string,
  data: any
): Promise<{
  signature: string;
  timestamp: number;
  address: string;
  action: string;
}> {
  const timestamp = Date.now();
  const address = getCurrentUserAddress();

  if (!address) {
    throw new Error('계정이 없습니다.');
  }

  // 액션 + 데이터 + 타임스탬프를 함께 서명
  const message = JSON.stringify({ action, ...data, timestamp, address });
  const signature = await signMessage(message);

  return { signature, timestamp, address, action };
}

/**
 * 액션 타입을 포함한 서명 검증
 */
export function verifyAction(
  action: string,
  data: any,
  signature: string,
  timestamp: number,
  claimedAddress: string,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  try {
    // 1. 타임스탬프 검증
    const now = Date.now();
    if (now - timestamp > maxAgeMs || timestamp > now + 60000) {
      console.error('Invalid timestamp');
      return false;
    }

    // 2. 메시지 재구성 (액션 포함)
    const message = JSON.stringify({ action, ...data, timestamp, address: claimedAddress });

    // 3. 서명 검증
    return verifySignature(message, signature, claimedAddress);
  } catch (error) {
    console.error('Failed to verify action signature:', error);
    return false;
  }
}
