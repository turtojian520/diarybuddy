import crypto from 'node:crypto'

function getKey(): Buffer {
  const raw = process.env.NOTION_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('NOTION_TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('NOTION_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64)')
  }
  return key
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${enc.toString('base64')}.${tag.toString('base64')}`
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey()
  const [ivB64, encB64, tagB64] = ciphertext.split('.')
  if (!ivB64 || !encB64 || !tagB64) throw new Error('Malformed ciphertext')
  const iv = Buffer.from(ivB64, 'base64')
  const enc = Buffer.from(encB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signState(payload: object): string {
  const key = getKey()
  const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const mac = base64url(crypto.createHmac('sha256', key).update(body).digest())
  return `${body}.${mac}`
}

export function verifyState<T = Record<string, unknown>>(state: string, maxAgeMs = 10 * 60 * 1000): T | null {
  const key = getKey()
  const [body, mac] = state.split('.')
  if (!body || !mac) return null
  const expected = base64url(crypto.createHmac('sha256', key).update(body).digest())
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  const parsed = JSON.parse(fromBase64url(body).toString('utf8')) as { iat?: number } & T
  if (!parsed.iat || Date.now() - parsed.iat > maxAgeMs) return null
  return parsed
}
