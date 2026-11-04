async function call(path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const api = {
  get: (p) => call(p),
  post: (p, body) => call(p, { method: "POST", body }),
  patch: (p, body) => call(p, { method: "PATCH", body }),
};
