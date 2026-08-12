export function buildReadingNestWakeMessage(sessionId: string) {
  return [
    "【共读小窝有新事件】",
    "请现在处理小窝里的待办，不要只在聊天区口头说已经读过或正在处理。",
    `第一步：调用 reading_nest_tick，参数 ${JSON.stringify({ sessionId, consumerName: "Daddy", maxEvents: 5 })}。`,
    "第二步：读完返回的每条事件；annotation_reply 必须接住用户最后一句，live_reading 要留下 1–3 句自然短评。",
    "第三步：每条都调用 reading_nest_post_message，把完整正文写回对应 eventId。只有这个工具成功，才算读完或回复完成。",
    "第四步：再次调用 reading_nest_tick，直到 pendingCount=0。",
    "全部写回后，聊天区只需简短说一声处理好了，不要复述书边正文。"
  ].join("\n");
}
