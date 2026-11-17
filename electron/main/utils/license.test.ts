import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyLicenseKey } from './license'

const DAY = 86400
const HOUR = 3600

/**
 * 用临时密钥对签一张卡密（不碰真实发卡私钥），供测试验签逻辑。
 * 格式与 scripts/gen-key.mjs 一致：BOBI1.<payload base64url>.<signature base64url>，
 * payload 是 {"v":1,"exp":过期时间的 unix 秒,"id":"..."}，签名对象是 payloadB64 的 utf8 字节。
 */
function signTestKey(expSeconds: number, keyPair = generateKeyPairSync('ed25519')) {
  const payloadB64 = Buffer.from(JSON.stringify({ v: 1, exp: expSeconds, id: 'test-1' })).toString(
    'base64url',
  )
  const signature = sign(null, Buffer.from(payloadB64, 'utf8'), keyPair.privateKey).toString(
    'base64url',
  )
  const publicKey = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  return { key: `BOBI1.${payloadB64}.${signature}`, publicKey }
}

describe('卡密校验 verifyLicenseKey', () => {
  it('有效卡密通过，返回过期时间（毫秒）和剩余天数', () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 30 * DAY
    const { key, publicKey } = signTestKey(expSeconds)
    const r = verifyLicenseKey(key, publicKey)
    expect(r.valid).toBe(true)
    expect(r.expiresAt).toBe(expSeconds * 1000)
    expect(r.daysLeft).toBe(30)
  })

  it('空卡密返回 empty', () => {
    expect(verifyLicenseKey('')).toEqual({ valid: false, reason: 'empty' })
    expect(verifyLicenseKey('   ')).toEqual({ valid: false, reason: 'empty' })
  })

  it('格式不对返回 malformed', () => {
    expect(verifyLicenseKey('hello')).toEqual({ valid: false, reason: 'malformed' })
    expect(verifyLicenseKey('BOBI1.abc')).toEqual({ valid: false, reason: 'malformed' })
  })

  it('payload 不是合法 JSON 返回 bad-payload', () => {
    const bad = `BOBI1.${Buffer.from('not-json').toString('base64url')}.AAAA`
    expect(verifyLicenseKey(bad)).toEqual({ valid: false, reason: 'bad-payload' })
  })

  it('签名被篡改返回 bad-signature', () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 30 * DAY
    const { key, publicKey } = signTestKey(expSeconds)
    const parts = key.split('.')
    const tampered = `BOBI1.${parts[1]}.${Buffer.from('tampered').toString('base64url')}`
    expect(verifyLicenseKey(tampered, publicKey)).toEqual({
      valid: false,
      reason: 'bad-signature',
    })
  })

  it('换一把公钥验同一张卡密失败', () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 30 * DAY
    const { key } = signTestKey(expSeconds)
    const other = generateKeyPairSync('ed25519')
    const otherPublic = other.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
    expect(verifyLicenseKey(key, otherPublic)).toEqual({ valid: false, reason: 'bad-signature' })
  })

  it('过期卡密返回 expired（不把过期判成签名错误）', () => {
    const expSeconds = Math.floor(Date.now() / 1000) - HOUR
    const { key, publicKey } = signTestKey(expSeconds)
    expect(verifyLicenseKey(key, publicKey)).toEqual({ valid: false, reason: 'expired' })
  })
})
