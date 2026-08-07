import { env } from './env';

export const supabaseConfig = {
  url: env.supabaseUrl,
  serviceRoleKey: env.supabaseServiceRoleKey,
};
