import { createPublicKey, verify } from 'node:crypto'

/**
 * 卡密校验（主进程，离线版）
 *
 * 方案：Ed25519 非对称签名。私钥只留在卖家电脑上的发卡脚本
 *（scripts/gen-key.mjs + scripts/license-private.key），这里只放公钥。
 * 公钥只能验签、不能签发，就算被人从应用里抠出来，也做不出新卡密。
 *
 * 为什么不用 HMAC：HMAC 是对称算法，校验方必须持有同一把密钥，
 * 密钥一旦放进应用代码，任何人反编译都能拿它伪造卡密。
 * 这个公钥对应的私钥由发卡脚本生成；换私钥要同步换这里的公钥，
 * 换完之后旧卡密全部失效。
 */
export const BOBI_LICENSE_PUBLIC_KEY =
  'MCowBQYDK2VwAyEAQ008NAxMUfWb/Pwl9NUr0rEeWqZ4VqIKuqK6tvdz2d0='

function decodeB64url(str: string): Buffer {
  return Buffer.from(str, 'base64url')
}

/**
 * 校验一张卡密。卡密格式：BOBI1.<payload>.<signature>
 * payload 是 base64url 编码的 JSON：{"v":1,"exp":过期时间的 unix 秒,"id":"随机编号"}
 */
export function verifyLicenseKey(input: string): LicenseVerifyResult {
  const key = (input ?? '').trim()
  if (!key) {
    return { valid: false, reason: 'empty' }
  }

  const parts = key.split('.')
  if (parts.length !== 3 || parts[0] !== 'BOBI1') {
    return { valid: false, reason: 'malformed' }
  }
  const [, payloadB64, sigB64] = parts

  let payload: { v?: number; exp?: number; id?: string }
  try {
    payload = JSON.parse(decodeB64url(payloadB64).toString('utf8'))
  } catch {
    return { valid: false, reason: 'bad-payload' }
  }
  if (payload?.v !== 1 || typeof payload?.exp !== 'number' || !payload?.id) {
    return { valid: false, reason: 'bad-payload' }
  }

  let signatureOk = false
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(BOBI_LICENSE_PUBLIC_KEY, 'base64'),
      format: 'der',
      type: 'spki',
    })
    signatureOk = verify(
      null,
      Buffer.from(payloadB64, 'utf8'),
      publicKey,
      decodeB64url(sigB64),
    )
  } catch {
    signatureOk = false
  }
  if (!signatureOk) {
    return { valid: false, reason: 'bad-signature' }
  }

  const expiresAt = payload.exp * 1000
  if (expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired' }
  }

  const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000)
  return { valid: true, expiresAt, daysLeft }
}
