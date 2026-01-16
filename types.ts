export interface Message {
  id: string;
  content: string;
  sender: 'me' | 'peer';
  timestamp: number;
}

export interface EncryptedPacket {
  ciphertext: string;
  iv: string;
}

export interface KeyPairState {
  publicKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  publicKeyBase64: string;
}
