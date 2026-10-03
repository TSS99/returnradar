declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    RETURNRADAR_OWNER_EMAIL?: string;
    OPENAI_APPS_CHALLENGE?: string;
    BUCKET?: R2Bucket;
  }
}
