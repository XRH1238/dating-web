export interface GatewayBackend {
  bucket: string;
}

export interface GatewayDeps {
  backends: Record<string, GatewayBackend>;
  verifyUser(token: string): Promise<unknown>;
  createSignedUpload(backend: string, bucket: string, path: string): Promise<string>;
  removeObjects(backend: string, bucket: string, paths: string[]): Promise<void>;
}

const FIXED_BACKEND = "secondary";
const FIXED_BUCKET = "love-photos";
const MAX_DELETE_PATHS = 40;
const PRODUCTION_ORIGIN = "https://xrh1238.github.io";
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const CITY_SEGMENT = /^[\p{L}\p{N}_ -]+$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return "*";
  return origin === PRODUCTION_ORIGIN || LOCAL_ORIGIN.test(origin) ? origin : null;
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(request: Request, status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(corsHeaders(allowedOrigin(request)));
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (extraHeaders) new Headers(extraHeaders).forEach((value, name) => headers.set(name, value));
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(request: Request, status: number, code: string, message: string, extraHeaders?: HeadersInit): Response {
  return jsonResponse(request, status, { error: { code, message } }, extraHeaders);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAllowedCitySegment(segment: string): boolean {
  return segment.length <= 100 && segment.trim() === segment && CITY_SEGMENT.test(segment);
}

function decodedSegmentIsSafe(segment: string): boolean {
  let decoded = segment;
  for (let pass = 0; pass < 5; pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch (_) {
      return false;
    }
    decoded = next;
    if (!/%[0-9a-f]{2}/i.test(decoded)) break;
  }
  return !/%[0-9a-f]{2}/i.test(decoded) && decoded !== "." && decoded !== ".." &&
    !decoded.includes("/") && !decoded.includes("\\") && !CONTROL_CHARACTERS.test(decoded);
}

function isSafeObjectPath(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 1024) return false;
  if (value.startsWith("/") || value.endsWith("/") || value.includes("\\") || CONTROL_CHARACTERS.test(value)) {
    return false;
  }
  const segments = value.split("/");
  if (segments.length < 2 || segments.some((segment) => !segment || segment === "." || segment === ".." || !decodedSegmentIsSafe(segment))) {
    return false;
  }
  const first = segments[0];
  return first === "records" || first === "capsules" || first === "unplaced" || isAllowedCitySegment(first);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  const match = authorization && authorization.match(/^Bearer ([^\s,]+)$/i);
  return match ? match[1] : null;
}

function allowedBackend(body: Record<string, unknown>, deps: GatewayDeps): GatewayBackend | null {
  if (body.backend !== FIXED_BACKEND || !Object.prototype.hasOwnProperty.call(deps.backends, FIXED_BACKEND)) return null;
  const backend = deps.backends[FIXED_BACKEND];
  return backend && backend.bucket === FIXED_BUCKET ? backend : null;
}

export async function handleStorageGateway(request: Request, deps: GatewayDeps): Promise<Response> {
  const origin = allowedOrigin(request);
  if (request.headers.has("Origin") && !origin) {
    return new Response(null, { status: 403, headers: corsHeaders(null) });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return errorResponse(request, 405, "method_not_allowed", "Only POST requests are supported", {
      Allow: "POST, OPTIONS",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (_) {
    return errorResponse(request, 400, "invalid_json", "Request body must be valid JSON");
  }
  if (!isPlainObject(body)) {
    return errorResponse(request, 400, "invalid_request", "Request body must be an object");
  }

  const token = bearerToken(request);
  if (!token) return errorResponse(request, 401, "unauthorized", "A valid login is required");
  try {
    if (!await deps.verifyUser(token)) {
      return errorResponse(request, 401, "unauthorized", "A valid login is required");
    }
  } catch (_) {
    return errorResponse(request, 401, "unauthorized", "A valid login is required");
  }

  const backend = allowedBackend(body, deps);
  if (!backend || body.bucket !== FIXED_BUCKET) {
    return errorResponse(request, 400, "invalid_target", "Storage target is not allowed");
  }

  if (body.action === "sign-upload") {
    if (!isSafeObjectPath(body.path)) {
      return errorResponse(request, 400, "invalid_path", "Object path is not allowed");
    }
    try {
      const signedUrl = await deps.createSignedUpload(FIXED_BACKEND, FIXED_BUCKET, body.path);
      if (typeof signedUrl !== "string" || !signedUrl) throw new Error("Invalid signed upload result");
      return jsonResponse(request, 200, { signedUrl });
    } catch (_) {
      return errorResponse(request, 502, "storage_error", "Storage operation failed");
    }
  }

  if (body.action === "delete") {
    if (!Array.isArray(body.paths) || body.paths.length < 1 || body.paths.length > MAX_DELETE_PATHS) {
      return errorResponse(request, 400, "invalid_paths", "Delete requires between 1 and 40 object paths");
    }
    if (!body.paths.every(isSafeObjectPath) || new Set(body.paths).size !== body.paths.length) {
      return errorResponse(request, 400, "invalid_paths", "Every object path must be safe and unique");
    }
    try {
      await deps.removeObjects(FIXED_BACKEND, FIXED_BUCKET, body.paths);
      return jsonResponse(request, 200, { deleted: body.paths.length });
    } catch (_) {
      return errorResponse(request, 502, "storage_error", "Storage operation failed");
    }
  }

  return errorResponse(request, 400, "unsupported_action", "Storage action is not supported");
}
