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

Deno.serve((request: Request) => handleStorageGateway(request, {
  backends: {
    primary: { bucket: "love-photos" },
    secondary: { bucket: storageBackend.bucket },
  },
  async verifyUser(token: string) {
    const { data, error } = await mainClient.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
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
