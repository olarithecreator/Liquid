import { supabase } from './supabase'

export async function sendEmail(type: string, to: string, data: object) {
  // Edge Function: supabase/functions/send-email
  await supabase.functions.invoke('send-email', { body: { type, to, data } })
}

export async function sendTelegram(message: string) {
  // Edge Function: supabase/functions/send-telegram
  await supabase.functions.invoke('send-telegram', { body: { message } })
}
