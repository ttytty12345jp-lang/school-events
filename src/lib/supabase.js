import { createClient } from '@supabase/supabase-js'

// アプリ全体で1つだけ Supabase クライアントを共有する。
// 各ファイルで個別に createClient すると
// 「Multiple GoTrueClient instances」警告が出るため、ここに集約。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
export const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
