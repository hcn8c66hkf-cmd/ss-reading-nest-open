import {
  migrateReadingDatabase,
  type Bookmark,
  type CompanionComment,
  type Quote,
  type Reaction,
  type ReadingDatabase,
  type ReadingSession,
  type ReadingAnnotation,
  type AnnotationFavorite,
  type ReadingMemory,
  type ReadingFactCard,
  type SkillCandidate,
  type SourceManifest
} from "@ss/shared";

export function normalizeReadingDatabase(input: unknown): ReadingDatabase {
  const database = migrateReadingDatabase(input);
  return {
    schemaVersion: 7,
    sessions: database.sessions.map(copySession),
    quotes: database.quotes.map(copyQuote),
    reactions: database.reactions.map(copyReaction),
    bookmarks: database.bookmarks.map(copyBookmark),
    companionComments: database.companionComments.map(copyCompanionComment),
    annotations: database.annotations.map(copyAnnotation),
    annotationFavorites: database.annotationFavorites.map(copyAnnotationFavorite),
    readingMemories: database.readingMemories.map(copyReadingMemory),
    readingFactCards: database.readingFactCards.map(copyReadingFactCard),
    skillCandidates: database.skillCandidates.map(copySkillCandidate)
  };
}

function copySkillCandidate(candidate: SkillCandidate): SkillCandidate {
  return structuredClone(candidate);
}

function copyAnnotationFavorite(favorite: AnnotationFavorite): AnnotationFavorite {
  return {
    id: favorite.id,
    sessionId: favorite.sessionId,
    annotationId: favorite.annotationId,
    ...(favorite.messageId ? { messageId: favorite.messageId } : {}),
    position: structuredClone(favorite.position),
    excerpt: favorite.excerpt,
    ...(favorite.author ? { author: favorite.author } : {}),
    ...(favorite.text ? { text: favorite.text } : {}),
    operationId: favorite.operationId,
    createdAt: favorite.createdAt
  };
}

function copyReadingMemory(memory: ReadingMemory): ReadingMemory {
  return {
    id: memory.id,
    sessionId: memory.sessionId,
    kind: memory.kind,
    scope: memory.scope,
    ...(memory.chapterLabel ? { chapterLabel: memory.chapterLabel } : {}),
    ...(memory.rangeStart !== undefined ? { rangeStart: memory.rangeStart } : {}),
    ...(memory.rangeEnd !== undefined ? { rangeEnd: memory.rangeEnd } : {}),
    content: memory.content,
    source: memory.source,
    status: memory.status,
    revision: memory.revision,
    ...(memory.supersedesId ? { supersedesId: memory.supersedesId } : {}),
    operationId: memory.operationId,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt
  };
}

function copyReadingFactCard(card: ReadingFactCard): ReadingFactCard {
  return {
    id: card.id,
    sessionId: card.sessionId,
    subject: card.subject,
    fact: card.fact,
    status: card.status,
    source: card.source,
    ...(card.position ? { position: structuredClone(card.position) } : {}),
    revision: card.revision,
    ...(card.supersedesId ? { supersedesId: card.supersedesId } : {}),
    operationId: card.operationId,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  };
}

function copyAnnotation(annotation: ReadingAnnotation): ReadingAnnotation {
  return {
    id: annotation.id,
    sessionId: annotation.sessionId,
    position: structuredClone(annotation.position),
    anchor: structuredClone(annotation.anchor),
    createdBy: annotation.createdBy,
    messages: structuredClone(annotation.messages),
    ...(annotation.operationId ? { operationId: annotation.operationId } : {}),
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt
  };
}

export function needsReadingDatabaseWriteback(
  raw: unknown,
  normalized: ReadingDatabase
): boolean {
  return JSON.stringify(raw) !== JSON.stringify(normalized);
}

function copySession(session: ReadingSession): ReadingSession {
  return {
    id: session.id,
    title: session.title,
    type: session.type,
    status: session.status,
    userCurrentPosition: structuredClone(session.userCurrentPosition),
    assistantSyncedPosition: session.assistantSyncedPosition
      ? structuredClone(session.assistantSyncedPosition)
      : null,
    liveReadingEnabled: session.liveReadingEnabled,
    ...(session.liveReadingStartIndex !== undefined
      ? { liveReadingStartIndex: session.liveReadingStartIndex }
      : {}),
    ...(session.pendingLiveReadingPositions
      ? { pendingLiveReadingPositions: structuredClone(session.pendingLiveReadingPositions) }
      : {}),
    ...(session.pendingAnnotationReplies
      ? { pendingAnnotationReplies: structuredClone(session.pendingAnnotationReplies) }
      : {}),
    sessionPreferences: structuredClone(session.sessionPreferences),
    sourceManifest: copySourceManifest(session.sourceManifest),
    ...(session.lastAssistantConfirmation
      ? { lastAssistantConfirmation: structuredClone(session.lastAssistantConfirmation) }
      : {}),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastReadAt: session.lastReadAt,
    ...(session.completedAt ? { completedAt: session.completedAt } : {})
  };
}

function copySourceManifest(manifest: SourceManifest | null): SourceManifest | null {
  if (!manifest) return null;
  return {
    sourceId: manifest.sourceId,
    sourceKind: manifest.sourceKind,
    ...(manifest.title ? { title: manifest.title } : {}),
    contentHash: manifest.contentHash,
    segmentationVersion: manifest.segmentationVersion,
    ...(manifest.paragraphCount !== undefined
      ? { paragraphCount: manifest.paragraphCount }
      : {}),
    ...(manifest.pageCount !== undefined ? { pageCount: manifest.pageCount } : {}),
    cloudSync: structuredClone(manifest.cloudSync),
    ...(manifest.createdOnDeviceId
      ? { createdOnDeviceId: manifest.createdOnDeviceId }
      : {}),
    ...(manifest.lastVerifiedAt ? { lastVerifiedAt: manifest.lastVerifiedAt } : {})
  };
}

function copyQuote(quote: Quote): Quote {
  return {
    id: quote.id,
    sessionId: quote.sessionId,
    content: quote.content,
    position: structuredClone(quote.position),
    ...(quote.note !== undefined ? { note: quote.note } : {}),
    ...(quote.operationId ? { operationId: quote.operationId } : {}),
    createdAt: quote.createdAt
  };
}

function copyReaction(reaction: Reaction): Reaction {
  return {
    id: reaction.id,
    sessionId: reaction.sessionId,
    content: reaction.content,
    position: structuredClone(reaction.position),
    speaker: reaction.speaker,
    ...(reaction.operationId ? { operationId: reaction.operationId } : {}),
    createdAt: reaction.createdAt
  };
}

function copyBookmark(bookmark: Bookmark): Bookmark {
  return {
    id: bookmark.id,
    sessionId: bookmark.sessionId,
    position: structuredClone(bookmark.position),
    ...(bookmark.label !== undefined ? { label: bookmark.label } : {}),
    ...(bookmark.operationId ? { operationId: bookmark.operationId } : {}),
    createdAt: bookmark.createdAt
  };
}

function copyCompanionComment(comment: CompanionComment): CompanionComment {
  return {
    id: comment.id,
    sessionId: comment.sessionId,
    position: structuredClone(comment.position),
    mode: comment.mode,
    length: comment.length,
    text: comment.text,
    source: comment.source,
    inRecent: comment.inRecent,
    inHistory: comment.inHistory,
    ...(comment.operationId ? { operationId: comment.operationId } : {}),
    createdAt: comment.createdAt,
    ...(comment.updatedAt ? { updatedAt: comment.updatedAt } : {})
  };
}
