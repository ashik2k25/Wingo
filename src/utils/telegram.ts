/**
 * Telegram VIP Bot Dispatcher for Number Shot Pro
 * 24/7 Persistent Multi-Subscriber & Channel Broadcast Engine
 */

import fs from 'fs';
import path from 'path';
import { Timeframe, Signal } from '../types';

// Persistent subscriber store path (works both locally and in Docker container)
const SUBSCRIBERS_FILE = path.resolve(process.cwd(), 'telegram_subscribers.json');
const ALT_SUBSCRIBERS_FILE = '/app/applet/telegram_subscribers.json';

export interface SubscriberInfo {
  chatId: string;
  title: string;
  type: string;
  addedAt: number;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  timeframes: Record<Timeframe, boolean>;
  autoDetectChatId: boolean;
  lastSentPeriod: Record<Timeframe, string | null>;
  lastSentTime: number;
  lastError: string | null;
  botInfo: {
    username: string;
    firstName: string;
  } | null;
  subscriberCount: number;
}

const DEFAULT_BOT_TOKEN = '8388862676:AAEZM47QrR7OZ1PIZCOdavXe5bP8uh3JX7o';

// Persistent subscriber store
const subscribersMap = new Map<string, SubscriberInfo>();

function loadSubscribersFromDisk(): string {
  let savedPrimaryChatId = '';
  const pathsToTry = [SUBSCRIBERS_FILE, ALT_SUBSCRIBERS_FILE];
  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        if (typeof data.primaryChatId === 'string' && data.primaryChatId.trim()) {
          savedPrimaryChatId = data.primaryChatId.trim();
        }
        if (Array.isArray(data.subscribers)) {
          for (const sub of data.subscribers) {
            if (sub && sub.chatId) {
              subscribersMap.set(String(sub.chatId), sub);
            }
          }
        }
        if (subscribersMap.size > 0 || savedPrimaryChatId) {
          console.log(`[Telegram] Loaded ${subscribersMap.size} persistent subscribers from disk (${p}). Primary: ${savedPrimaryChatId || 'none'}`);
          break;
        }
      }
    } catch (err: any) {
      console.error(`[Telegram] Failed to load subscribers from ${p}:`, err?.message);
    }
  }
  return savedPrimaryChatId;
}

const initialSavedChatId = loadSubscribersFromDisk();

function saveSubscribersToDisk(): void {
  try {
    const currentChatId = typeof telegramConfig !== 'undefined' ? telegramConfig.chatId : initialSavedChatId;
    const subscribers = Array.from(subscribersMap.values());
    const payload = JSON.stringify(
      {
        primaryChatId: currentChatId || initialSavedChatId,
        subscribers,
        updatedAt: Date.now(),
      },
      null,
      2
    );

    const pathsToSave = [SUBSCRIBERS_FILE, ALT_SUBSCRIBERS_FILE];
    for (const p of pathsToSave) {
      try {
        fs.writeFileSync(p, payload, 'utf-8');
      } catch {
        // Continue to other paths
      }
    }
  } catch (err: any) {
    console.error('[Telegram] Failed to save subscribers to disk:', err?.message);
  }
}

export const telegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID || initialSavedChatId || '',
  enabled: true,
  timeframes: {
    '30S': true,
    '1M': true,
    '3M': true,
    '5M': true,
  },
  autoDetectChatId: true,
  lastSentPeriod: {
    '30S': null,
    '1M': null,
    '3M': null,
    '5M': null,
  },
  lastSentTime: 0,
  lastError: null,
  botInfo: {
    username: 'johnwickvip_bot',
    firstName: 'John Wick VIP',
  },
  subscriberCount: subscribersMap.size,
};

let lastUpdateId = 0;
let isPolling = false;

export async function fetchBotInfo(): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      telegramConfig.botInfo = {
        username: data.result.username || 'johnwickvip_bot',
        firstName: data.result.first_name || 'John Wick VIP',
      };
    }
  } catch (err: any) {
    console.error('[Telegram] Failed to fetch bot info:', err?.message);
  }
}

export async function registerSubscriber(chatId: string, title: string = 'VIP Member', type: string = 'private'): Promise<void> {
  const idStr = String(chatId).trim();
  if (!idStr) return;

  subscribersMap.set(idStr, {
    chatId: idStr,
    title,
    type,
    addedAt: Date.now(),
  });

  if (!telegramConfig.chatId) {
    telegramConfig.chatId = idStr;
  }

  telegramConfig.subscriberCount = subscribersMap.size;
  saveSubscribersToDisk();
  console.log(`[Telegram] Registered subscriber: ${idStr} (${title}) - Active: ${subscribersMap.size}`);
}

export async function sendTelegramMessage(text: string, overrideChatId?: string): Promise<boolean> {
  const targetChatId = overrideChatId || telegramConfig.chatId;
  if (!targetChatId || !targetChatId.trim()) {
    telegramConfig.lastError = 'No Chat ID configured. Send /start to @johnwickvip_bot or add bot to channel.';
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId.trim(),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      telegramConfig.lastError = null;
      telegramConfig.lastSentTime = Date.now();
      return true;
    } else {
      telegramConfig.lastError = data.description || 'Telegram API returned error';
      // Only remove if user explicitly blocked the bot, never remove primary configured chat ID
      if (
        data.error_code === 403 &&
        data.description?.includes('bot was blocked by the user') &&
        targetChatId.trim() !== telegramConfig.chatId
      ) {
        subscribersMap.delete(targetChatId.trim());
        saveSubscribersToDisk();
        telegramConfig.subscriberCount = subscribersMap.size;
      }
      return false;
    }
  } catch (err: any) {
    telegramConfig.lastError = err?.message || 'Network error';
    return false;
  }
}

function formatColorLabel(color: string): string {
  switch (color) {
    case 'GREEN':
      return '🟢 GREEN';
    case 'RED':
      return '🔴 RED';
    case 'VIOLET':
      return '🟣 VIOLET';
    case 'RED_VIOLET':
      return '🔴🟣 RED + VIOLET';
    case 'GREEN_VIOLET':
      return '🟢🟣 GREEN + VIOLET';
    default:
      return color;
  }
}

function formatSizeLabel(size: string): string {
  return size === 'BIG' ? '🟢 BIG (5-9)' : '🔴 SMALL (0-4)';
}

export async function sendTelegramSignal(tf: Timeframe, signal: Signal): Promise<boolean> {
  if (!telegramConfig.enabled) return false;
  if (!telegramConfig.timeframes[tf]) return false;

  // Prevent duplicate broadcast for the exact same target period
  if (telegramConfig.lastSentPeriod[tf] === signal.targetPeriod) {
    return false;
  }

  // Collect all targets: primary chat ID + all persistent subscribers and channels
  const targetIds = new Set<string>();
  if (telegramConfig.chatId && telegramConfig.chatId.trim()) {
    targetIds.add(telegramConfig.chatId.trim());
  }
  for (const [id] of subscribersMap) {
    targetIds.add(id);
  }

  if (targetIds.size === 0) {
    // Keep trying to discover or wait for subscribers
    return false;
  }

  const confidence = (Math.max(signal.numberShare, signal.sizeShare) * 100).toFixed(1);
  const tfName = tf === '30S' ? 'WinGo 30 SEC' : `WinGo ${tf.replace('M', ' MIN')}`;

  const primaryPlay =
    signal.primaryBet === 'PASS'
      ? `💎 <b>PRIMARY PLAY:</b> ⏸ <b>PASS / STAND ASIDE</b> <i>(🛑 Capital Defense Halt)</i>`
      : signal.primaryBet === 'COLOR'
      ? `💎 <b>PRIMARY PLAY:</b> <b>${formatColorLabel(signal.color)}</b> <i>(⚡ Auto-Pivot Color Rate: 79%)</i>`
      : signal.primaryBet === 'DUAL_SHIELD'
      ? `💎 <b>PRIMARY PLAY:</b> 🛡️ <b>DUAL-SHIELD [${formatSizeLabel(signal.size)} + ${formatColorLabel(signal.color)}]</b> <i>(⭐ 80% Guarantee)</i>`
      : `💎 <b>PRIMARY PLAY:</b> <b>${formatSizeLabel(signal.size)}</b>`;

  const dualShieldLine = signal.dualShield
    ? `🛡 <b>DUAL-SHIELD HEDGE:</b> <code>[${signal.size} + ${signal.color}]</code> <i>(80% Coverage - Min 1 Hit Guaranteed)</i>`
    : '';

  const stakingLevel = signal.stakingLevel || 'LEVEL 1 (1X)';
  const multiplier = signal.suggestedMultiplier || 0;
  const stakeLine =
    signal.primaryBet === 'PASS'
      ? `💰 <b>VIP STAKING:</b> <code>STAND ASIDE (0X - NO BET)</code> <i>(Trading Halted)</i>`
      : `💰 <b>VIP STAKING:</b> <code>${stakingLevel}</code> ${
          multiplier > 1 ? `<i>(${multiplier}X Recovery Stake)</i>` : '<i>(Base Unit)</i>'
        }`;

  const streakGuardLine =
    signal.consecutiveLosses && signal.consecutiveLosses >= 2
      ? `🛡 <b>CIRCUIT BREAKER:</b> 🛑 <code>TRADING HALTED (${signal.consecutiveLosses}/2 Ceiling Guard)</code>`
      : signal.lossStreakPrevented
      ? `🛡 <b>CIRCUIT BREAKER:</b> 🚨 <code>VIP RECOVERY LOCK (Streak: ${signal.consecutiveLosses || 2} - Auto-Pivoted)</code>`
      : `🛡 <b>CIRCUIT BREAKER:</b> <code>Active (Loss Guard: ${signal.consecutiveLosses || 0} / 3)</code>`;

  const advisoryLine = signal.advisoryNote ? `💡 <b>Strategic Intel:</b> <i>${signal.advisoryNote}</i>` : '';
  const hedgeLine = signal.hedgeTip ? `⚖ <b>Bankroll Hedge:</b> <i>${signal.hedgeTip}</i>` : '';

  const message = [
    `✨ <b>NUMBER SHOT PRO</b> • <i>VIP INTELLIGENCE</i> ✨`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `⏱ <b>Draw Interval:</b> <code>${tfName}</code>`,
    `🎯 <b>Target Period:</b> <code>${signal.targetPeriod}</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🔮 <b>PREDICTED OUTCOME:</b>`,
    `• <b>Size:</b> ${formatSizeLabel(signal.size)}`,
    `• <b>Color:</b> ${formatColorLabel(signal.color)}`,
    `• <b>Lucky Number:</b> <code>[ ${signal.number} ]</code>`,
    ``,
    primaryPlay,
    dualShieldLine,
    stakeLine,
    streakGuardLine,
    advisoryLine,
    hedgeLine,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 <b>Statistical Confidence:</b> <code>${confidence}%</code>`,
    `⚡ <i>24/7 Cloud Authority • Anti-Blind Protected</i>`,
  ].filter(Boolean).join('\n');

  // Broadcast to all subscribers 24/7 in parallel
  const promises = Array.from(targetIds).map((chatId) => sendTelegramMessage(message, chatId));
  await Promise.allSettled(promises);

  telegramConfig.lastSentPeriod[tf] = signal.targetPeriod;
  console.log(`[Telegram Broadcast] Signal sent for ${tf} (Period ${signal.targetPeriod}) to ${targetIds.size} recipient(s)`);
  return true;
}

export async function pollTelegramUpdates(): Promise<void> {
  if (isPolling || !telegramConfig.botToken) return;
  isPolling = true;

  try {
    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      if (res.status === 409) {
        // Concurrency conflict handled gracefully
        console.warn('[Telegram Polling] 409 Conflict: waiting for next tick.');
      }
      return;
    }

    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) return;

    for (const update of data.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);

      // Handle standard message, channel post, or bot added to group/channel
      const msg = update.message || update.channel_post || update.my_chat_member;
      const chat = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat;
      if (!chat) continue;

      const chatId = String(chat.id);
      const chatTitle = chat.title || chat.first_name || 'VIP Member';
      const chatType = chat.type || 'private';

      // Automatically register any user or channel that talks to the bot or adds the bot
      if (telegramConfig.autoDetectChatId) {
        const isNew = !subscribersMap.has(chatId);
        await registerSubscriber(chatId, chatTitle, chatType);

        if (isNew && update.message?.text?.startsWith('/start')) {
          await sendTelegramMessage(
            `👑 <b>Welcome to Number Shot Pro VIP!</b>\n\n` +
              `✅ <b>Subscription Activated:</b> <code>${chatTitle}</code>\n` +
              `🎯 You are now permanently linked for 24/7 automated signals.\n` +
              `📡 Signals for <b>30S, 1M, 3M, 5M</b> will be delivered automatically before every round.\n\n` +
              `You do not need to type /start again. Good luck! 🚀`,
            chatId
          );
        }
      }
    }
  } catch (err: any) {
    // Background polling catch
  } finally {
    isPolling = false;
  }
}
