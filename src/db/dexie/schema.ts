
import Dexie, { type Table } from 'dexie';
import {
  HistoryInfo,
  Message,
  Prompt,
  SessionFiles,
  UserSettings,
  Webshare,
  Model,
  ModelNickname,
  Folder,
  Keyword,
  FolderKeywordLink,
  ConversationKeywordLink,
  ProcessedMedia,
  CompareState,
  ContentDraft,
  DraftBatch,
  DraftAsset,
  AudiobookProject,
  AudiobookChapterAsset
} from "./types"

export class PageAssistDexieDB extends Dexie {
  chatHistories!: Table<HistoryInfo>;
  messages!: Table<Message>;
  prompts!: Table<Prompt>;
  webshares!: Table<Webshare>;
  sessionFiles!: Table<SessionFiles>;
  userSettings!: Table<UserSettings>;

  customModels!: Table<Model>;
  modelNickname!: Table<ModelNickname>
  processedMedia!: Table<ProcessedMedia>
  compareStates!: Table<CompareState>
  contentDrafts!: Table<ContentDraft>
  draftBatches!: Table<DraftBatch>
  draftAssets!: Table<DraftAsset>

  // Folder system tables (cache from server)
  folders!: Table<Folder>
  keywords!: Table<Keyword>
  folderKeywordLinks!: Table<FolderKeywordLink>
  conversationKeywordLinks!: Table<ConversationKeywordLink>

  // Audiobook projects
  audiobookProjects!: Table<AudiobookProject>
  audiobookChapterAssets!: Table<AudiobookChapterAsset>

  constructor() {
    super('PageAssistDatabase');

    this.version(1).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt'
    });

    // Version 2: Add timeline/branching fields for conversation tree visualization
    this.version(2).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id, root_id, parent_conversation_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName, parent_message_id',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt'
    });

    // Version 3: Add folder system tables (cache from tldw_server)
    this.version(3).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id, root_id, parent_conversation_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName, parent_message_id',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt',
      // Folder system: cache of server data
      folders: 'id, name, parent_id, deleted',
      keywords: 'id, keyword, deleted',
      folderKeywordLinks: '[folder_id+keyword_id], folder_id, keyword_id',
      conversationKeywordLinks: '[conversation_id+keyword_id], conversation_id, keyword_id'
    });

    // Version 4: Compare state + compare metadata on messages
    this.version(4).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id, root_id, parent_conversation_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName, clusterId, modelId, parent_message_id',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt',
      folders: 'id, name, parent_id, deleted',
      keywords: 'id, keyword, deleted',
      folderKeywordLinks: '[folder_id+keyword_id], folder_id, keyword_id',
      conversationKeywordLinks: '[conversation_id+keyword_id], conversation_id, keyword_id',
      compareStates: 'history_id'
    });

    // Version 5: Content review drafts + batches + assets
    this.version(5).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id, root_id, parent_conversation_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName, clusterId, modelId, parent_message_id',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt',
      folders: 'id, name, parent_id, deleted',
      keywords: 'id, keyword, deleted',
      folderKeywordLinks: '[folder_id+keyword_id], folder_id, keyword_id',
      conversationKeywordLinks: '[conversation_id+keyword_id], conversation_id, keyword_id',
      compareStates: 'history_id',
      contentDrafts: 'id, batchId, status, mediaType, createdAt, updatedAt, expiresAt',
      draftBatches: 'id, createdAt, updatedAt',
      draftAssets: 'id, draftId, createdAt'
    });

    // Version 6: add server chat mapping for local mirrors
    this.version(6).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id, root_id, parent_conversation_id, server_chat_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName, clusterId, modelId, parent_message_id',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt',
      folders: 'id, name, parent_id, deleted',
      keywords: 'id, keyword, deleted',
      folderKeywordLinks: '[folder_id+keyword_id], folder_id, keyword_id',
      conversationKeywordLinks: '[conversation_id+keyword_id], conversation_id, keyword_id',
      compareStates: 'history_id',
      contentDrafts: 'id, batchId, status, mediaType, createdAt, updatedAt, expiresAt',
      draftBatches: 'id, createdAt, updatedAt',
      draftAssets: 'id, draftId, createdAt'
    });

    // Version 7: Audiobook projects
    this.version(7).stores({
      chatHistories: 'id, title, is_rag, message_source, is_pinned, createdAt, doc_id, last_used_prompt, model_id, root_id, parent_conversation_id, server_chat_id',
      messages: 'id, history_id, name, role, content, createdAt, messageType, modelName, clusterId, modelId, parent_message_id',
      prompts: 'id, title, content, is_system, createdBy, createdAt',
      webshares: 'id, title, url, api_url, share_id, createdAt',
      sessionFiles: 'sessionId, retrievalEnabled, createdAt',
      userSettings: 'id, user_id',
      customModels: 'id, model_id, name, model_name, model_image, provider_id, lookup, model_type, db_type',
      modelNickname: 'id, model_id, model_name, model_avatar',
      processedMedia: 'id, url, createdAt',
      folders: 'id, name, parent_id, deleted',
      keywords: 'id, keyword, deleted',
      folderKeywordLinks: '[folder_id+keyword_id], folder_id, keyword_id',
      conversationKeywordLinks: '[conversation_id+keyword_id], conversation_id, keyword_id',
      compareStates: 'history_id',
      contentDrafts: 'id, batchId, status, mediaType, createdAt, updatedAt, expiresAt',
      draftBatches: 'id, createdAt, updatedAt',
      draftAssets: 'id, draftId, createdAt',
      audiobookProjects: 'id, title, status, createdAt, updatedAt, lastOpenedAt',
      audiobookChapterAssets: 'id, projectId, chapterId, createdAt'
    });
  }
}

export const db = new PageAssistDexieDB();
