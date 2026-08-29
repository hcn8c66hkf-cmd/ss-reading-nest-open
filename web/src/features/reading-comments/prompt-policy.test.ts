import { describe, expect, it } from "vitest";
import type { CommentLength, ReadingCommentMode } from "@ss/shared";
import {
  buildLiveReadingDraftPrompt,
  buildLiveReadingModelContext,
  buildLiveReadingPrompt,
  buildLiveReadingRetryPrompt,
  buildLiveReadingWakePrompt,
  buildReadingCommentPrompt,
  normalizeCommentLength
} from "./prompt-policy.js";

describe("normalizeCommentLength", () => {
  it.each([
    ["light_chat", "long", "normal"],
    ["reaction_only", "long", "normal"],
    ["cp_talk", "long", "normal"],
    ["plot_guess", "long", "normal"],
    ["deep_analysis", "long", "long"],
    ["diary_summary", "long", "long"]
  ] satisfies Array<[ReadingCommentMode, CommentLength, CommentLength]>)(
    "normalizes %s + %s to %s",
    (mode, requested, expected) => {
      expect(normalizeCommentLength(mode, requested)).toBe(expected);
    }
  );
});

const base = {
  sessionId: "session-1",
  title: "测试小说",
  position: { kind: "paragraph" as const, index: 12, label: "第 12 段" },
  source: "current_only" as const,
  operationId: "comment-op-1",
  autoSaveCompanionComments: true
};

describe("buildReadingCommentPrompt", () => {
  it("builds light chat without the four-part review structure", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "light_chat",
      length: "normal"
    });

    expect(prompt).toMatch(/轻松共读|轻松陪读/);
    expect(prompt).toContain("1-3");
    expect(prompt).toMatch(/吐槽|嗑点/);
    expect(prompt).toContain("不需要完整书评");
    expect(prompt).toContain("不需要逐项总结");
    expect(prompt).not.toMatch(/剧情变化.*人物变化.*伏笔猜测.*当前感受/s);
  });

  it("builds reaction-only danmaku guidance", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "reaction_only",
      length: "short"
    });

    expect(prompt).toContain("弹幕");
    expect(prompt).toContain("1-5 句");
    expect(prompt).toContain("不总结剧情");
    expect(prompt).toContain("不分析结构");
  });

  it("builds relationship-focused cp talk guidance", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "cp_talk",
      length: "normal"
    });

    expect(prompt).toMatch(/关系张力/);
    expect(prompt).toMatch(/暧昧/);
    expect(prompt).toMatch(/占有欲/);
    expect(prompt).toMatch(/互动反差/);
    expect(prompt).toMatch(/好嗑/);
    expect(prompt).toMatch(/少复述剧情/);
  });

  it("builds plot guessing with fact/speculation separation", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "plot_guess",
      length: "normal"
    });

    expect(prompt).toMatch(/伏笔/);
    expect(prompt).toMatch(/隐藏信息/);
    expect(prompt).toMatch(/后续走向/);
    expect(prompt).toMatch(/原文事实.*猜测/s);
    expect(prompt).toMatch(/不详细总结/);
  });

  it("allows the full structure only for deep analysis", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "deep_analysis",
      length: "long"
    });

    expect(prompt).toMatch(/剧情变化/);
    expect(prompt).toMatch(/人物变化/);
    expect(prompt).toMatch(/伏笔猜测/);
    expect(prompt).toMatch(/当前感受/);
    expect(prompt).toContain("已生成长评，可回聊天区查看。");
    expect(prompt).toContain("不要把长评正文传给 publish_companion_comment");
  });

  it("keeps diary summary separate from ordinary paragraph chat", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "diary_summary",
      length: "normal"
    });

    expect(prompt).toMatch(/读书日记/);
    expect(prompt).toMatch(/不是普通段落点评/);
  });

  it.each([
    "light_chat",
    "reaction_only",
    "cp_talk",
    "plot_guess"
  ] satisfies ReadingCommentMode[])(
    "requires %s to publish the same short comment before replying when auto-save is on",
    (mode) => {
      const prompt = buildReadingCommentPrompt({
        ...base,
        mode,
        length: "normal"
      });

      expect(prompt).toContain("先调用 publish_companion_comment");
      expect(prompt).toContain("sessionId=session-1");
      expect(prompt).toContain("position.kind=paragraph");
      expect(prompt).toContain("position.index=12");
      expect(prompt).toContain("position.label=第 12 段");
      expect(prompt).toContain("text=最终短评全文");
      expect(prompt).toContain("operationId=comment-op-1");
      expect(prompt).toContain("source=current_context");
      expect(prompt).toContain("再在聊天区回复完全相同的短评");
      expect(prompt).toMatch(/失败.*不要声称.*Dock/s);
      expect(prompt).toContain("短评未同步到 Dock");
    }
  );

  it("does not mention the publish tool when companion auto-save is off", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      mode: "reaction_only",
      length: "short",
      autoSaveCompanionComments: false
    });

    expect(prompt).not.toContain("publish_companion_comment");
    expect(prompt).toContain("不自动保存短评到 Dock");
    expect(prompt).toContain("不要调用任何应用写回工具");
    expect(prompt).toContain("直接在聊天区回复短评");
  });

  it("includes catch-up range metadata without restoring the old long-review instruction", () => {
    const prompt = buildReadingCommentPrompt({
      ...base,
      source: "catch_up_complete",
      mode: "light_chat",
      length: "normal",
      syncedRange: { start: 3, end: 12 }
    });

    expect(prompt).toContain("补课已确认完成");
    expect(prompt).toContain("第 3-12 段");
    expect(prompt).toContain("source=catch_up_completion");
    expect(prompt).not.toMatch(/总结这段区间的剧情变化/);
  });
});

describe("buildLiveReadingPrompt", () => {
  it("always builds short reaction-only danmaku and publishes first when auto-save is on", () => {
    const prompt = buildLiveReadingPrompt({
      sessionId: "session-1",
      title: "测试小说",
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      text: "他把没说出口的话咽了回去。",
      operationId: "live-op-1",
      autoSaveCompanionComments: true,
      requestedMode: "deep_analysis",
      requestedLength: "long"
    });

    expect(prompt).toContain("reaction_only");
    expect(prompt).toContain("short");
    expect(prompt).toContain("1-3 句弹幕式短评");
    expect(prompt).toContain("本段原文");
    expect(prompt).toContain("他把没说出口的话咽了回去");
    expect(prompt).not.toContain("read_live_reading_context");
    expect(prompt).toContain("不是回复正文的前置条件");
    expect(prompt).toContain("不能让本轮只思考却没有正文输出");
    expect(prompt).toContain("不总结全文");
    expect(prompt).toContain("不重复剧情");
    expect(prompt).toContain("不写完整书评");
    expect(prompt).toContain("如果 submit_live_reading_comment_v39 可用");
    expect(prompt).toContain("否则尝试 publish_companion_comment");
    expect(prompt).toContain("position.index=12");
    expect(prompt).toContain("text=最终短评全文");
    expect(prompt).toContain("operationId=live-op-1");
    expect(prompt).toContain("短评未同步到 Dock");
    expect(prompt).not.toMatch(/剧情变化.*人物变化/s);
  });

  it("publishes live-reading comments even when the general auto-save preference is off", () => {
    const prompt = buildLiveReadingPrompt({
      sessionId: "session-1",
      title: "测试小说",
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      text: "这一段原文。",
      operationId: "live-op-1",
      autoSaveCompanionComments: false
    });

    expect(prompt).toContain("如果 submit_live_reading_comment_v39 可用");
    expect(prompt).toContain("否则尝试 publish_companion_comment");
    expect(prompt).toContain("source=live_reading");
    expect(prompt).not.toContain("不自动保存短评到 Dock");
  });
});

describe("buildLiveReadingDraftPrompt", () => {
  it("asks the host model for plain short-comment text without tool instructions", () => {
    const prompt = buildLiveReadingDraftPrompt({
      title: "测试小说",
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      text: "他把没说出口的话咽了回去。"
    });

    expect(prompt).toContain("第 12 段");
    expect(prompt).toContain("他把没说出口的话咽了回去");
    expect(prompt).toContain("最多 160 字");
    expect(prompt).toContain("只返回最终短评正文");
    expect(prompt).not.toContain("publish_companion_comment");
  });
});

describe("hidden live-reading context", () => {
  const input = {
    sessionId: "session-1",
    title: "测试小说",
    position: { kind: "paragraph" as const, index: 12, label: "第 12 段" },
    text: "这是一段不该出现在可见触发消息里的原文。",
    operationId: "live-op-1"
  };

  it("keeps the paragraph and exact publish arguments in model context", () => {
    const context = buildLiveReadingModelContext(input);

    expect(context).toMatchObject({
      kind: "reading_nest_live_reading_v1",
      sessionId: "session-1",
      title: "测试小说",
      position: input.position,
      currentText: input.text,
      responsePolicy: {
        mode: "reaction_only",
        length: "short",
        style: "danmaku",
        publishTool: "submit_live_reading_comment_v39",
        fallbackPublishTool: "publish_companion_comment",
        publishArguments: {
          sessionId: "session-1",
          position: input.position,
          mode: "reaction_only",
          length: "short",
          source: "live_reading",
          operationId: "live-op-1"
        }
      }
    });
  });

  it("keeps the visible wake-up message free of article data but explicit about write-back", () => {
    const prompt = buildLiveReadingWakePrompt(input.position, input.text);

    expect(prompt).toContain("第 12 段");
    expect(prompt).toContain("1-3 句短评");
    expect(prompt).toContain(input.text);
    expect(prompt).not.toContain(input.sessionId);
    expect(prompt).not.toContain(input.operationId);
    expect(prompt).toContain("publish_companion_comment");
    expect(prompt).toContain("必须优先调用");
  });

  it("builds a stronger tool-first retry without repeating the article", () => {
    const prompt = buildLiveReadingRetryPrompt(input.position, input.text);

    expect(prompt).toContain("上一次");
    expect(prompt).toContain("publish_companion_comment");
    expect(prompt).toContain("不要只做口头回复");
    expect(prompt).toContain(input.text);
    expect(prompt).not.toContain(input.sessionId);
    expect(prompt).not.toContain(input.operationId);
  });
});
