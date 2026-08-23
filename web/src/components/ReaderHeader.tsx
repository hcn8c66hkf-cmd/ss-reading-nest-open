export function ReaderHeader(props: {
  title: string;
  progress: string;
  fullscreenLabel?: string;
  themeMode?: "light" | "dark";
  onBack: () => void;
  onFullscreen: () => void;
  onCollapse: () => void;
  onToggleTheme?: () => void;
  onSettings: () => void;
  onMore: () => void;
}) {
  return (
    <header className="reader-header">
      <button className="icon-button" onClick={props.onBack} aria-label="返回首页">‹</button>
      <div className="reader-heading">
        <strong>{props.title}</strong>
        <span>{props.progress}</span>
      </div>
      <div className="header-buttons">
        {props.onToggleTheme ? (
          <button
            className="icon-button reader-theme-button"
            onClick={props.onToggleTheme}
            aria-label={props.themeMode === "dark" ? "切换为白天模式" : "切换为夜间模式"}
            title={props.themeMode === "dark" ? "白天模式" : "夜间模式"}
          >
            {props.themeMode === "dark" ? "☀︎" : "☾"}
          </button>
        ) : null}
        <button className="reader-display-button" onClick={props.onFullscreen}>
          {props.fullscreenLabel ?? "全屏阅读"}
        </button>
        <button className="icon-button" onClick={props.onSettings} aria-label="缓存设置">⌁</button>
        <button className="icon-button" onClick={props.onMore} aria-label="更多操作">⋯</button>
        <button
          className="icon-button reader-collapse-button"
          onClick={props.onCollapse}
          aria-label="收起小窝卡片"
          title="收起小窝卡片"
        >
          ×
        </button>
      </div>
    </header>
  );
}
