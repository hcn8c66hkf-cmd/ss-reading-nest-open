export async function onRequest(context) {
  return context.env.READING_NEST_WORKER.fetch(context.request);
}
