
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
  ProcessedMedia
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

  // Folder system tables (cache from server)
  folders!: Table<Folder>
  keywords!: Table<Keyword>
  folderKeywordLinks!: Table<FolderKeywordLink>
  conversationKeywordLinks!: Table<ConversationKeywordLink>

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
  }
}

export const db = new PageAssistDexieDB();
