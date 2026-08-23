import { useEffect, useState } from "react";
import {
  subscribeHostContext,
  type ReadingHostContext
} from "../bridge/host.js";

export type CompanionLayout = "wide" | "compact";

export function useReadingHostLayout() {
  const [context, setContext] = useState<ReadingHostContext>(
    () => window.openai?.hostContext ?? {}
  );
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
  const [revision, setRevision] = useState(0);
  const [inlineHeight, setInlineHeight] = useState(() => stableInlineHeight());

  useEffect(() => {
    const measure = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const nextInlineHeight = stableInlineHeight();
      setInlineHeight(nextInlineHeight);
      document.documentElement.style.setProperty(
        "--reader-inline-height",
        `${nextInlineHeight}px`
      );
      setRevision((value) => value + 1);
    };
    measure();
    const unsubscribe = subscribeHostContext((next) => {
      setContext((current) => ({ ...current, ...next }));
      setRevision((value) => value + 1);
    });
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    const insets = context.safeAreaInsets;
    if (!insets) return;
    const root = document.documentElement.style;
    root.setProperty("--safe-top", `${insets.top}px`);
    root.setProperty("--safe-right", `${insets.right}px`);
    root.setProperty("--safe-bottom", `${insets.bottom}px`);
    root.setProperty("--safe-left", `${insets.left}px`);
    return () => {
      root.removeProperty("--safe-top");
      root.removeProperty("--safe-right");
      root.removeProperty("--safe-bottom");
      root.removeProperty("--safe-left");
    };
  }, [context.safeAreaInsets]);

  useEffect(() => {
    document.documentElement.dataset.displayMode = context.displayMode ?? "inline";
  }, [context.displayMode]);

  const width =
    context.containerDimensions?.width ??
    context.containerDimensions?.maxWidth ??
    viewport.width;
  const height =
    context.containerDimensions?.height ??
    context.containerDimensions?.maxHeight ??
    viewport.height;
  const layout: CompanionLayout =
    width >= 900 && width > height ? "wide" : "compact";
  const available = context.availableDisplayModes;

  return {
    layout,
    revision,
    inlineHeight,
    displayMode: context.displayMode ?? "inline",
    canRequestPip:
      available?.includes("pip") ?? Boolean(window.openai?.requestDisplayMode)
  };
}

function stableInlineHeight(): number {
  const screenHeight = window.screen?.availHeight || window.screen?.height || 0;
  if (!Number.isFinite(screenHeight) || screenHeight < 400) return 680;
  return Math.max(540, Math.min(720, Math.round(screenHeight * 0.72)));
}
