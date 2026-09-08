import type { CompanionComment } from "@ss/shared";

export function matchesParagraphComment(
  comment: CompanionComment,
  sessionId: string,
  positionIndex: number,
  operationId: string
) {
  return comment.sessionId === sessionId && (
    comment.operationId === operationId ||
    (comment.position.kind === "paragraph" && comment.position.index === positionIndex)
  );
}
