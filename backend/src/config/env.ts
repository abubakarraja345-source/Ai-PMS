import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 5000),

  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  geminiApiKey: process.env.GEMINI_API_KEY,

  resendApiKey: process.env.RESEND_API_KEY,

  redisUrl: process.env.REDIS_URL,

  jwtSecret: process.env.JWT_SECRET,

  frontendUrl: process.env.FRONTEND_URL,

  nodeEnv: process.env.NODE_ENV || "development",
};