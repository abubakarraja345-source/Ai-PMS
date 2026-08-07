import { supabase } from '../lib/supabase';

export const api = {
  get: async <T>(path: string) => {
    const { data, error } = await supabase.from(path).select('*');
    if (error) throw error;
    return data as T;
  },
};
