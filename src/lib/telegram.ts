const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  if (!chatId || !BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    })
  } catch (err) {
    console.error('[Telegram] send failed:', err)
  }
}
