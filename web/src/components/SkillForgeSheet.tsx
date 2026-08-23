import type { SkillCandidate } from "@ss/shared";

const verdictCopy: Record<SkillCandidate["verdict"], { label: string; detail: string }> = {
  forge_skill: {
    label: "值得炼成 Skill",
    detail: "已经生成可审阅的 SKILL.md 候选；安装前仍要由你确认。"
  },
  knowledge_only: {
    label: "更适合知识卡",
    detail: "内容值得留下，但还不是能反复调用的工作流。"
  },
  insufficient_coverage: {
    label: "材料还不够",
    detail: "继续读、继续划线和讨论，之后再评估更靠谱。"
  }
};

export function SkillForgeSheet(props: {
  candidates: SkillCandidate[];
  loading: boolean;
  onForge: () => void;
  onCopy: (candidate: SkillCandidate) => void;
  onClose: () => void;
}) {
  const latest = props.candidates[0];
  const copy = latest ? verdictCopy[latest.verdict] : null;
  return (
    <div className="sheet-backdrop" role="presentation" onClick={props.onClose}>
      <section
        className="bottom-sheet skill-forge-sheet"
        role="dialog"
        aria-label="读后炼制 P3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" />
        <h2>读后炼制 P3</h2>
        <p className="memory-intro">
          先做章节快照和价值判定。只有真正能复用的方法，才会生成 Skill 候选。
        </p>
        <button className="action-primary" disabled={props.loading} onClick={props.onForge}>
          {props.loading ? "正在整理快照并判断…" : "评估当前已读内容"}
        </button>

        {latest && copy ? (
          <article className={`skill-verdict ${latest.verdict}`}>
            <header>
              <div>
                <span>{copy.label}</span>
                <strong>{latest.title}</strong>
              </div>
              <small>{latest.chapterLabel}</small>
            </header>
            <p>{latest.rationale}</p>
            <p className="skill-verdict-detail">{copy.detail}</p>
            {latest.workflow.length ? (
              <section>
                <h3>可复用工作流</h3>
                <ol>{latest.workflow.map((item) => <li key={item}>{item}</li>)}</ol>
              </section>
            ) : null}
            {latest.boundaries.length ? (
              <section>
                <h3>边界</h3>
                <ul>{latest.boundaries.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            ) : null}
            {latest.skillMarkdown ? (
              <details>
                <summary>预览 SKILL.md</summary>
                <pre>{latest.skillMarkdown}</pre>
              </details>
            ) : null}
            <footer>
              <code>{latest.analysisFingerprint}</code>
              {latest.skillMarkdown ? (
                <button onClick={() => props.onCopy(latest)}>复制候选包</button>
              ) : null}
            </footer>
          </article>
        ) : (
          <p className="record-empty">还没有做过读后炼制评估。</p>
        )}

        {props.candidates.length > 1 ? (
          <details className="skill-history">
            <summary>以前的评估（{props.candidates.length - 1}）</summary>
            <ul>
              {props.candidates.slice(1).map((candidate) => (
                <li key={candidate.id}>
                  <span>{verdictCopy[candidate.verdict].label}</span>
                  <strong>{candidate.title}</strong>
                  <small>{candidate.chapterLabel}</small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <button className="text-button" onClick={props.onClose}>关闭</button>
      </section>
    </div>
  );
}
