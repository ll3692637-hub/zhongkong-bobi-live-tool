declare type Account = {
  readonly id: string
  name: string
}

/** 卡密校验结果（主进程验签后返回给界面） */
declare type LicenseVerifyResult = {
  valid: boolean
  reason?: 'empty' | 'malformed' | 'bad-payload' | 'bad-signature' | 'expired'
  /** 过期时间（unix 毫秒），仅校验通过时有值 */
  expiresAt?: number
  /** 剩余整天数，仅校验通过时有值 */
  daysLeft?: number
}

declare interface ProviderInfo {
  name: string
  baseURL: string
  apiUrl: string
  models: string[]
}

declare type LiveControlPlatform =
  | 'douyin'
  | 'buyin'
  | 'eos'
  | 'xiaohongshu'
  | 'pgy'
  | 'wxchannel'
  | 'kuaishou'
  | 'taobao'
  | 'dev'

declare type GoodsItem = {
  id: number
  /** 单品循环弹窗次数，默认 1 */
  repeatCount?: number
  /** 单品弹窗间隔 [min, max] 毫秒，不设则用全局间隔 */
  itemInterval?: [number, number]
}

declare type AutoPopupConfig = {
  scheduler: {
    interval: [number, number]
  }
  goodsIds: number[]
  goodsItems?: GoodsItem[]
  random?: boolean
}

declare type AutoPopupTask = {
  type: 'auto-popup'
  config: AutoPopupConfig
}

declare type AutoCommentConfig = {
  scheduler: {
    interval: [number, number]
  }
  messages: {
    content: string
    pinTop: boolean
  }[]
  random?: boolean
  extraSpaces?: boolean
  unlimitedLength?: boolean
}

declare type AutoCommentTask = {
  type: 'auto-comment'
  config: AutoCommentConfig
}

declare type SendBatchMessagesConfig = {
  messages: string[]
  count: number
  noSpace?: boolean
}

declare type SendBatchMessagesTask = {
  type: 'send-batch-messages'
  config: SendBatchMessagesConfig
}

declare interface CommentListenerConfig {
  source: 'compass' | 'control' | 'wechat-channel' | 'xiaohongshu' | 'taobao' | 'kuaishou'
  ws?: {
    port: number
  }
}

declare type CommentListenerTask = {
  type: 'comment-listener'
  config: CommentListenerConfig
}

declare type PinCommentTask = {
  type: 'pin-comment'
  config: {
    comment: string
  }
}

declare type LiveControlTask =
  | AutoPopupTask
  | AutoCommentTask
  | SendBatchMessagesTask
  | CommentListenerTask
  | PinCommentTask

declare type DouyinLiveMessage = {
  time: number
} & (
  | CommentMessage
  | RoomEnterMessage
  | RoomLikeMessage
  | LiveOrderMessage
  | SubscribeMerchantBrandVipMessage
  | RoomFollowMessage
  | EcomFansclubParticipateMessage
)

interface CommentMessage {
  msg_type: 'comment'
  msg_id: string
  nick_name: string
  content: string
}

interface RoomEnterMessage {
  msg_type: 'room_enter'
  msg_id: string
  nick_name: string
  user_id: string
}

interface RoomLikeMessage {
  msg_type: 'room_like'
  msg_id: string
  nick_name: string
  user_id: string
}

interface SubscribeMerchantBrandVipMessage {
  msg_type: 'subscribe_merchant_brand_vip'
  msg_id: string
  nick_name: string
  user_id: string
  content: string
}

interface RoomFollowMessage {
  msg_type: 'room_follow'
  msg_id: string
  nick_name: string
  user_id: string
}

interface EcomFansclubParticipateMessage {
  msg_type: 'ecom_fansclub_participate'
  msg_id: string
  nick_name: string
  user_id: string
  content: string
}

interface LiveOrderMessage {
  msg_type: 'live_order'
  nick_name: string
  msg_id: string
  order_status: '已下单' | '已付款' | '未知状态'
  order_ts: number
  product_id: string
  product_title: string
}

declare type WechatChannelLiveMessage = {
  msg_type: 'wechat_channel_live_msg'
  msg_id: string
  nick_name: string
  user_id: string
  content: string
  time: number
}

declare type XiaohongshuCommentLiveMessage = {
  msg_type: 'xiaohongshu_comment'
  msg_id: string
  nick_name: string
  user_id: string
  content: string
  time: number
}

declare type TaobaoCommentLiveMessage = {
  msg_type: 'taobao_comment'
  msg_id: string
  nick_name: string
  user_id: string
  content: string
  time: number
}

declare type LiveMessage =
  | WechatChannelLiveMessage
  | DouyinLiveMessage
  | XiaohongshuCommentLiveMessage
  | TaobaoCommentLiveMessage

/**
 * 渲染进程同步给主进程的授权状态（用于主进程授权复核）。
 * 主进程只接受：验签通过的新卡密（失败的忽略，保护已存有效卡密）、
 * 空串（清除卡密）、先到先得的试用开始时间、只增不减的最大时间。
 */
declare type LicenseSyncPatch = {
  key?: string | null
  trialStartedAt?: number | null
  trialMaxSeenAt?: number | null
  everActivated?: boolean
}

/** 批量弹幕：账号状态 */
declare type DanmuAccountStatus =
  | 'logged-out' // 未登录
  | 'logging-in' // 登录中（等扫码）
  | 'need-sms' // 等短信验证码
  | 'logged-in' // 已登录
  | 'expired' // 票据过期
  | 'risk-disabled' // 风控停用

declare interface DanmuAccountState {
  id: string
  status: DanmuAccountStatus
  userName: string
  qrReady: boolean
  failCount: number
}

declare interface DanmuProgress {
  sent: number
  total: number
  groupIndex: number
  groupCount: number
}

declare interface DanmuSnapshot {
  accounts: DanmuAccountState[]
  sending: boolean
  paused: boolean
  progress: DanmuProgress
  loginBusy: boolean
}

/** 批量弹幕：开始发送的配置（文案全文随启动调用一起传给主进程）。 */
declare interface DanmuSendConfig {
  roomId: string
  intervalMin: number
  intervalMax: number
  messagesText: string
}
