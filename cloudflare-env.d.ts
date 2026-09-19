declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    FUJI_PRIVATE_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
