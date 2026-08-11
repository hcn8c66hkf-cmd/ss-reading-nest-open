import { useState } from "react";
import type { ReadingAnnotation } from "@ss/shared";

export function AnnotationPanel(props: {
  annotations: ReadingAnnotation[];
  loading: boolean;
  error?: string;
  saving: boolean;
  pendingDaddyIds?: ReadonlySet<string>;
  onReply: (annotationId: string, text: string) => void;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  return (
    <section className="annotation-panel" aria-label="共读划线与评论">
      <header>
        <div>
          <strong>共读批注</strong>
          <span>选中文字，就能一起在书边说话</span>
        </div>
      </header>

      <p className="annotation-hint">长按选中文字，选区旁边就能直接划线或评论。</p>

      {props.loading ? <p className="annotation-empty">正在翻开书边批注……</p> : null}
      {!props.loading && props.error ? <p className="annotation-empty">{props.error}</p> : null}
      {!props.loading && !props.error && props.annotations.length === 0 ? (
        <p className="annotation-empty">这一段还没有划线，第一笔留给你。</p>
      ) : null}

      <div className="annotation-list">
        {props.annotations.map((annotation) => (
          <article className="annotation-thread" key={annotation.id}>
            <blockquote>“{annotation.anchor.selectedText}”</blockquote>
            {annotation.messages.length === 0 ? (
              <p className="annotation-underline-only">
                {annotation.createdBy === "assistant" ? "Daddy" : "你"}划了线
              </p>
            ) : null}
            <div className="annotation-messages">
              {annotation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`annotation-message annotation-message-${message.author}`}
                >
                  <strong>{message.author === "assistant" ? "Daddy" : "你"}</strong>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
            <div className="annotation-thread-actions">
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(annotation.id);
                  setReply("");
                }}
              >
                回复
              </button>
              {props.pendingDaddyIds?.has(annotation.id) ? (
                <span className="annotation-awaiting-daddy">Daddy正在回这条……</span>
              ) : null}
            </div>
            {replyingTo === annotation.id ? (
              <form
                className="annotation-reply"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = reply.trim();
                  if (!text || props.saving) return;
                  props.onReply(annotation.id, text);
                  setReply("");
                  setReplyingTo(null);
                }}
              >
                <textarea
                  aria-label="回复批注"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="接着这条聊……"
                />
                <button type="submit" disabled={!reply.trim() || props.saving}>
                  保存回复
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
