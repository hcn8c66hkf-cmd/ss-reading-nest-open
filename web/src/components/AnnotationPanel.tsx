import { useEffect, useState } from "react";
import type { ReadingAnnotation, TextAnchor } from "@ss/shared";

export function AnnotationPanel(props: {
  selectedAnchor: TextAnchor | null;
  annotations: ReadingAnnotation[];
  loading: boolean;
  error?: string;
  saving: boolean;
  onCreate: (anchor: TextAnchor, comment?: string) => void;
  onReply: (annotationId: string, text: string) => void;
  onAskDaddy: (annotation: ReadingAnnotation) => void;
}) {
  const [comment, setComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  useEffect(() => setComment(""), [props.selectedAnchor?.selectedText]);

  return (
    <section className="annotation-panel" aria-label="共读划线与评论">
      <header>
        <div>
          <strong>共读批注</strong>
          <span>选中文字，就能一起在书边说话</span>
        </div>
      </header>

      {props.selectedAnchor ? (
        <div className="annotation-composer">
          <blockquote>“{props.selectedAnchor.selectedText}”</blockquote>
          <textarea
            aria-label="批注内容"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="写下你的想法（也可以只划线）"
          />
          <div>
            <button
              type="button"
              disabled={props.saving}
              onClick={() => props.onCreate(props.selectedAnchor!)}
            >
              只划线
            </button>
            <button
              type="button"
              className="annotation-primary"
              disabled={!comment.trim() || props.saving}
              onClick={() => props.onCreate(props.selectedAnchor!, comment.trim())}
            >
              {props.saving ? "保存中…" : "划线并评论"}
            </button>
          </div>
        </div>
      ) : (
        <p className="annotation-hint">长按或拖动选中文字，就会出现批注框。</p>
      )}

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
              <button type="button" onClick={() => props.onAskDaddy(annotation)}>
                请Daddy回这条
              </button>
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
