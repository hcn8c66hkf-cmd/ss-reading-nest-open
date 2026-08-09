export function CacheSettings(props: {
  type: "novel" | "manga";
  remembered: boolean;
  liveReadingEnabled: boolean;
  onRememberChange: (value: boolean) => void;
  onLiveReadingChange: (value: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const noun = props.type === "novel" ? "本书" : "这部漫画";
  return (
    <div className="sheet-backdrop" role="presentation" onClick={props.onClose}>
      <section className="bottom-sheet" role="dialog" aria-label="缓存设置" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>本设备缓存</h2>
        <label className="toggle-row">
          <span>在本设备记住{noun}</span>
          <input
            type="checkbox"
            checked={props.remembered}
            onChange={(event) => props.onRememberChange(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>实时陪读模式（停留 1.8 秒后同步）</span>
          <input
            type="checkbox"
            checked={props.liveReadingEnabled}
            onChange={(event) => props.onLiveReadingChange(event.target.checked)}
          />
        </label>
        <p className="privacy-note">
          本设备缓存用于快速继续阅读；私人云端副本用于网页端与 iPad 恢复，不会生成公开链接。
        </p>
        <button className="danger-button" onClick={props.onClear}>
          {props.type === "novel" ? "清除正文缓存" : "清除漫画缓存"}
        </button>
        <button className="text-button" onClick={props.onClose}>完成</button>
      </section>
    </div>
  );
}
