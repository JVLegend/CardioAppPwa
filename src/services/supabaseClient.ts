import { createClient } from '@supabase/supabase-js'
import { AppEnvironment } from '../config/environment'

export const supabase = createClient(
  AppEnvironment.supabaseURL,
  AppEnvironment.supabaseAnonKey
)
