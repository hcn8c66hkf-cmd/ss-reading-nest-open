export async function onRequest(context) {
  const incoming = context.request;
  const body =
    incoming.method === "GET" || incoming.method === "HEAD"
      ? undefined
      : await incoming.arrayBuffer();
  const forwarded = new Request(incoming.url, {
    method: incoming.method,
    headers: incoming.headers,
    body,
    redirect: "manual"
  });

  return context.env.READING_NEST_WORKER.fetch(forwarded);
}
