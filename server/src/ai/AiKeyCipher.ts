import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface ISealedKey {
  keyCiphertext: string
  keyIv: string
  keyTag: string
  keyVersion: number
}

/** AES-256-GCM for per-library AI keys. The 32-byte master key (AI_KEYS_KEY) never touches the database. */
export class AiKeyCipher {
  private readonly key: Buffer

  constructor(base64Key: string, private readonly version = 1) {
    this.key = Buffer.from(base64Key, 'base64')
    if (this.key.length !== 32) {
      throw new Error('AI_KEYS_KEY must decode to 32 bytes')
    }
  }

  seal(plain: string): ISealedKey {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return { keyCiphertext: ciphertext.toString('base64'), keyIv: iv.toString('base64'), keyTag: cipher.getAuthTag().toString('base64'), keyVersion: this.version }
  }

  open(sealed: Pick<ISealedKey, 'keyCiphertext' | 'keyIv' | 'keyTag'>): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(sealed.keyIv, 'base64'))
    decipher.setAuthTag(Buffer.from(sealed.keyTag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(sealed.keyCiphertext, 'base64')), decipher.final()]).toString('utf8')
  }
}
