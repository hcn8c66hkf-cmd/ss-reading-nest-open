import { useState } from "react";
import type { ReadingFactCard, ReadingMemory } from "@ss/shared";

const memoryLabels: Record<ReadingMemory["kind"], string> = {
  chapter_summary: "章节摘要",
  annotation_summary: "批注摘要",
  reading_impression: "阅读印象",
  book_context: "全书前情",
  chapter_context: "章节前情"
};

const sourceLabels: Record<ReadingMemory["source"], string> = {
  daddy_read: "Daddy亲读",
  assistant_scan: "辅助扫读",
  user_edit: "小安修订"
};

export function ReadingMemorySheet(props: {
  memories: ReadingMemory[];
  facts: ReadingFactCard[];
  loading: boolean;
  onRefresh: () => void;
  onCapture: () => void;
  onEditMemory: (memory: ReadingMemory, content: string) => void;
  onEditFact: (fact: ReadingFactCard, content: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const beginEdit = (id: string, value: string) => {
    setEditing(id);
    setDraft(value);
  };

  return (
    <div className="sheet-backdrop" role="presentation" onClick={props.onClose}>
      <section
        className="bottom-sheet memory-sheet"
        role="dialog"
        aria-label="长期阅读记忆"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" />
        <h2>长期阅读记忆</h2>
        <p className="memory-intro">
          摘要、共同余味和事实卡分开保存；来源标签会一直保留。
        </p>
        <div className="memory-actions">
          <button className="action-primary" onClick={props.onCapture}>
            请Daddy整理这段记忆
          </button>
          <button className="sheet-action" disabled={props.loading} onClick={props.onRefresh}>
            {props.loading ? "正在刷新…" : "刷新记忆"}
          </button>
        </div>

        <section className="memory-section">
          <h3>前情、摘要与印象</h3>
          {props.memories.length === 0 ? (
            <p className="record-empty">还没有整理过长期记忆。</p>
          ) : (
            props.memories.map((memory) => (
              <article className="memory-card" key={memory.id}>
                <header>
                  <strong>{memoryLabels[memory.kind]}</strong>
                  <span>{sourceLabels[memory.source]} · v{memory.revision}</span>
                </header>
                {memory.chapterLabel ? <small>{memory.chapterLabel}</small> : null}
                {editing === memory.id ? (
                  <form
                    className="memory-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!draft.trim()) return;
                      props.onEditMemory(memory, draft.trim());
                      setEditing(null);
                    }}
                  >
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
                    <div>
                      <button type="button" onClick={() => setEditing(null)}>取消</button>
                      <button type="submit">保存修订</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p>{memory.content}</p>
                    <button className="memory-edit-button" onClick={() => beginEdit(memory.id, memory.content)}>
                      修订这张记忆卡
                    </button>
                  </>
                )}
              </article>
            ))
          )}
        </section>

        <section className="memory-section">
          <h3>事实卡</h3>
          {props.facts.length === 0 ? (
            <p className="record-empty">还没有需要长期追踪的事实。</p>
          ) : (
            props.facts.map((fact) => (
              <article className="memory-card fact-card" key={fact.id}>
                <header>
                  <strong>{fact.subject}</strong>
                  <span>{sourceLabels[fact.source]} · v{fact.revision}</span>
                </header>
                {editing === fact.id ? (
                  <form
                    className="memory-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!draft.trim()) return;
                      props.onEditFact(fact, draft.trim());
                      setEditing(null);
                    }}
                  >
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
                    <div>
                      <button type="button" onClick={() => setEditing(null)}>取消</button>
                      <button type="submit">保存修订</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p>{fact.fact}</p>
                    <button className="memory-edit-button" onClick={() => beginEdit(fact.id, fact.fact)}>
                      修订事实
                    </button>
                  </>
                )}
              </article>
            ))
          )}
        </section>
        <button className="text-button" onClick={props.onClose}>关闭</button>
      </section>
    </div>
  );
}
