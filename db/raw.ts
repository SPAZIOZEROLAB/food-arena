import {env} from 'cloudflare:workers';
export function db():D1Database { if(!env.DB) throw new Error('Archivio temporaneamente non disponibile. Riprova tra poco.'); return env.DB; }
