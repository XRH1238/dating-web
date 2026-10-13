import { createClient } from "npm:@supabase/supabase-js@2";
import { handleStorageGateway } from "./core.ts";

interface StorageBackendConfig {
  url: string;
  secretKey: string;
  bucket: string;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseStorageBackend(): StorageBackendConfig {
  const raw = requiredEnv("STORAGE_BACKENDS_JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error("STORAGE_BACKENDS_JSON must contain valid JSON");
  }
  const candidate = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>).secondary
    : null;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("STORAGE_BACKENDS_JSON must configure the secondary backend");
  }
  const backend = candidate as Record<string, unknown>;
  if (
    typeof backend.url !== "string" ||
    typeof backend.secretKey !== "string" ||
    !backend.secretKey.startsWith("sb_secret_") ||
    backend.bucket !== "love-photos"
  ) {
    throw new Error("The secondary Storage backend configuration is invalid");
  }
  let url: URL;
  try {
    url = new URL(backend.url);
  } catch (_) {
    throw new Error("The secondary Storage backend URL is invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("The secondary Storage backend URL is invalid");
  }
  return { url: url.origin, secretKey: backend.secretKey, bucket: "love-photos" };
}

const mainUrl = requiredEnv("SUPABASE_URL");
const mainPublishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || requiredEnv("SUPABASE_ANON_KEY");
const mainServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const storageBackend = parseStorageBackend();

const mainClient = createClient(mainUrl, mainPublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const storageClients = {
  primary: createClient(mainUrl, mainServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }),
  secondary: createClient(storageBackend.url, storageBackend.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }),
};

async function verifiedMember(token: string): Promise<boolean> {
  const { data, error } = await mainClient.auth.getUser(token);
  if (error || !data.user) return false;
  const membership = await storageClients.primary.from('love_members').select('user_id')
    .eq('user_id', data.user.id).maybeSingle();
  return !membership.error && !!membership.data;
}

function publicMediaPaths(value: unknown, backend: 'primary' | 'secondary'): string[] {
  const media = Array.isArray(value) ? value : [];
  const expectedOrigin = new URL(backend === 'primary' ? mainUrl : storageBackend.url).origin;
  const prefix = '/storage/v1/object/public/love-photos/';
  return media.flatMap((item) => ['url', 'motion_url', 'poster_url', 'cover_url'].map((field) => {
    try {
      const parsed = new URL(String(item?.[field] || ''));
      if (parsed.origin !== expectedOrigin || !parsed.pathname.startsWith(prefix)) return '';
      return parsed.pathname.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
    } catch (_) { return ''; }
  }).filter(Boolean));
}

Deno.serve((request: Request) => handleStorageGateway(request, {
  backends: {
    primary: { bucket: "love-photos" },
    secondary: { bucket: storageBackend.bucket },
  },
  async verifyUser(token: string) {
    const { data, error } = await mainClient.auth.getUser(token);
    if (error || !data.user) return null;
    if (!await verifiedMember(token)) return null;
    return { id: data.user.id };
  },
  async canReadObjects(token, backend, paths) {
    if (token && await verifiedMember(token)) return true;
    // Never sign a private path merely because someone knows its old public URL.
    const [photos, records, todos] = await Promise.all([
      storageClients.primary.from('love_photos').select('url,motion_url').eq('is_public', true),
      storageClients.primary.from('love_records').select('photos').eq('is_public', true),
      storageClients.primary.from('love_todos').select('completion_photos').eq('is_public', true),
    ]);
    if (photos.error || records.error || todos.error) return false;
    const allowed = new Set(publicMediaPaths(photos.data, backend));
    (records.data || []).forEach((row) => publicMediaPaths(row.photos, backend).forEach((path) => allowed.add(path)));
    (todos.data || []).forEach((row) => publicMediaPaths(row.completion_photos, backend).forEach((path) => allowed.add(path)));
    return paths.every((path) => allowed.has(path));
  },
  async createSignedRead(backend, bucket, path) {
    const { data, error } = await storageClients[backend].storage.from(bucket).createSignedUrl(path, 900);
    if (error || !data?.signedUrl) throw new Error('Unable to sign media');
    return data.signedUrl;
  },
  async createSignedUpload(backend: "primary" | "secondary", bucket: string, path: string) {
    const { data, error } = await storageClients[backend].storage.from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.signedUrl) throw new Error("Unable to create signed upload URL");
    return data.signedUrl;
  },
  async removeObjects(backend: "primary" | "secondary", bucket: string, paths: string[]) {
    const { error } = await storageClients[backend].storage.from(bucket).remove(paths);
    if (error) throw new Error("Unable to remove Storage objects");
  },
}));
