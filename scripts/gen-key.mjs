#!/usr/bin/env node
/**
 * 中控啵比直播助手 · 卡密发卡脚本（卖家专用）
 *
 * 只在卖家自己的电脑上用。私钥只存在 scripts/license-private.key 这一个文件里，
 * 永远不要把它发给别人、不要提交到 git、不要放进应用代码。
 *
 * 签名方案说明（为什么不用 HMAC）：
 * 卡密要在买家电脑上离线校验。HMAC 是对称算法，校验方必须持有同一把密钥，
 * 密钥一旦放进应用代码，任何人反编译就能拿它伪造卡密。所以这里用 Ed25519
 * 非对称签名：私钥只留在本脚本，应用里只放公钥。公钥只能验签、不能签发，
 * 就算被人从应用里抠出来，也做不出新的卡密。
 *
 * 用法：
 *   node scripts/gen-key.mjs --init                生成一对新密钥（已有私钥时会拒绝覆盖，除非加 --force）
 *   node scripts/gen-key.mjs --pubkey              打印公钥（base64），贴到 electron/main/utils/license.ts 里
 *   node scripts/gen-key.mjs --days 365            生成一张 365 天有效的卡密
 *   node scripts/gen-key.mjs --days 30 --note 张三  生成一张 30 天的卡密，备注只打印出来，不进卡密
 *   node scripts/gen-key.mjs --verify <卡密>       校验一张卡密（用私钥推导出的公钥验）
 *
 * 卡密格式：BOBI1.<payload>.<signature>
 *   payload 是 base64url 编码的 JSON：{"v":1,"exp":过期时间的 unix 秒,"id":"随机编号"}
 *   signature 是对 payload 部分的 Ed25519 签名（base64url）
 */

import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRIVATE_KEY_PATH = join(dirname(fileURLToPath(import.meta.url)), 'license-private.key')

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url')
}

function b64urlDecode(str) {
  return Buffer.from(str, 'base64url')
}

function loadPrivateKey() {
  if (!existsSync(PRIVATE_KEY_PATH)) {
    console.error('找不到私钥文件：' + PRIVATE_KEY_PATH)
    console.error('先跑一遍：node scripts/gen-key.mjs --init')
    process.exit(1)
  }
  return createPrivateKey(readFileSync(PRIVATE_KEY_PATH, 'utf8'))
}

function loadPublicKey() {
  return createPublicKey(loadPrivateKey())
}

function cmdInit(force) {
  if (existsSync(PRIVATE_KEY_PATH) && !force) {
    console.error('私钥已存在：' + PRIVATE_KEY_PATH)
    console.error('重新生成会让之前发过的所有卡密失效。确定要换，跑：node scripts/gen-key.mjs --init --force')
    process.exit(1)
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 })
  try {
    chmodSync(PRIVATE_KEY_PATH, 0o600)
  } catch {
    // Windows 上 chmod 可能不生效，忽略
  }
  const publicB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  console.log('私钥已生成：' + PRIVATE_KEY_PATH)
  console.log('！！！私钥只放这一个文件，不要发给任何人，不要提交到 git！！！')
  console.log('')
  console.log('公钥（base64，贴到 electron/main/utils/license.ts 的 BOBI_LICENSE_PUBLIC_KEY）：')
  console.log(publicB64)
}

function cmdPubkey() {
  const publicB64 = loadPublicKey().export({ type: 'spki', format: 'der' }).toString('base64')
  console.log(publicB64)
}

function cmdGen(days, note) {
  const privateKey = loadPrivateKey()
  const nowSec = Math.floor(Date.now() / 1000)
  const payload = {
    v: 1,
    exp: nowSec + days * 86400,
    id: randomBytes(4).toString('hex'),
  }
  const payloadB64 = b64urlEncode(JSON.stringify(payload))
  const sig = sign(null, Buffer.from(payloadB64, 'utf8'), privateKey)
  const key = `BOBI1.${payloadB64}.${b64urlEncode(sig)}`
  const expDate = new Date(payload.exp * 1000)
  console.log(key)
  console.log('')
  console.log(`有效期：${days} 天，到 ${expDate.toLocaleDateString('zh-CN')}（${expDate.toISOString().slice(0, 10)}）`)
  if (note) console.log(`备注：${note}`)
}

function cmdVerify(key) {
  const publicKey = loadPublicKey()
  const parts = key.trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'BOBI1') {
    console.error('格式不对：卡密应该是 BOBI1.xxx.yyy 三段')
    process.exit(1)
  }
  const [, payloadB64, sigB64] = parts
  let payload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'))
  } catch {
    console.error('payload 解不开，卡密是坏的')
    process.exit(1)
  }
  const ok = verify(null, Buffer.from(payloadB64, 'utf8'), publicKey, b64urlDecode(sigB64))
  if (!ok) {
    console.error('签名不对：这张卡密不是这把私钥签的')
    process.exit(1)
  }
  const nowSec = Math.floor(Date.now() / 1000)
  if (payload.exp <= nowSec) {
    console.error(`签名是对的，但已过期（到期 ${new Date(payload.exp * 1000).toISOString().slice(0, 10)}）`)
    process.exit(1)
  }
  console.log(`有效，到期 ${new Date(payload.exp * 1000).toISOString().slice(0, 10)}，还剩 ${Math.ceil((payload.exp - nowSec) / 86400)} 天`)
}

const args = process.argv.slice(2)
if (args.includes('--init')) {
  cmdInit(args.includes('--force'))
} else if (args.includes('--pubkey')) {
  cmdPubkey()
} else if (args.includes('--verify')) {
  const key = args[args.indexOf('--verify') + 1]
  if (!key) {
    console.error('用法：node scripts/gen-key.mjs --verify <卡密>')
    process.exit(1)
  }
  cmdVerify(key)
} else if (args.includes('--days')) {
  const days = Number(args[args.indexOf('--days') + 1])
  if (!days || days <= 0 || !Number.isInteger(days)) {
    console.error('用法：node scripts/gen-key.mjs --days <天数>，天数是正整数')
    process.exit(1)
  }
  const noteIdx = args.indexOf('--note')
  const note = noteIdx >= 0 ? args[noteIdx + 1] : ''
  cmdGen(days, note)
} else {
  console.error('用法：')
  console.error('  node scripts/gen-key.mjs --init                 生成一对新密钥')
  console.error('  node scripts/gen-key.mjs --pubkey               打印公钥')
  console.error('  node scripts/gen-key.mjs --days 365             生成一张 365 天的卡密')
  console.error('  node scripts/gen-key.mjs --verify <卡密>        校验一张卡密')
  process.exit(1)
}
