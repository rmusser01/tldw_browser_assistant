import { db } from "./schema"
import type { ContentDraft, DraftAsset, DraftBatch } from "./types"

export const DRAFT_STORAGE_CAP_BYTES = 100 * 1024 * 1024

export async function getDraftBatches(): Promise<DraftBatch[]> {
  return await db.draftBatches.orderBy("createdAt").reverse().toArray()
}

export async function getDraftBatchById(
  id: string
): Promise<DraftBatch | undefined> {
  return await db.draftBatches.get(id)
}

export async function upsertDraftBatch(batch: DraftBatch): Promise<void> {
  await db.draftBatches.put(batch)
}

export async function deleteDraftBatch(id: string): Promise<void> {
  await db.draftBatches.delete(id)
}

export async function getDraftsByBatch(
  batchId: string
): Promise<ContentDraft[]> {
  return await db.contentDrafts
    .where("batchId")
    .equals(batchId)
    .toArray()
}

export async function getDraftById(
  id: string
): Promise<ContentDraft | undefined> {
  return await db.contentDrafts.get(id)
}

export async function upsertContentDraft(draft: ContentDraft): Promise<void> {
  await db.contentDrafts.put(draft)
}

export async function updateContentDraft(
  id: string,
  updates: Partial<ContentDraft>
): Promise<void> {
  await db.contentDrafts.update(id, updates)
}

export async function deleteContentDraft(id: string): Promise<void> {
  await db.contentDrafts.delete(id)
}

export async function deleteDraftsByBatch(batchId: string): Promise<void> {
  await db.contentDrafts.where("batchId").equals(batchId).delete()
}

export async function getDraftAsset(
  id: string
): Promise<DraftAsset | undefined> {
  return await db.draftAssets.get(id)
}

export async function getDraftAssetsByDraftId(
  draftId: string
): Promise<DraftAsset[]> {
  return await db.draftAssets.where("draftId").equals(draftId).toArray()
}

export async function upsertDraftAsset(asset: DraftAsset): Promise<void> {
  await db.draftAssets.put(asset)
}

export async function deleteDraftAsset(id: string): Promise<void> {
  await db.draftAssets.delete(id)
}

export async function deleteDraftAssetsByDraftId(
  draftId: string
): Promise<void> {
  await db.draftAssets.where("draftId").equals(draftId).delete()
}

export async function getDraftAssetsTotalBytes(): Promise<number> {
  const assets = await db.draftAssets.toArray()
  return assets.reduce((sum, asset) => sum + (asset.sizeBytes || 0), 0)
}

type DraftAssetInput = Blob & { name?: string; lastModified?: number }

export async function storeDraftAsset(
  draftId: string,
  file: DraftAssetInput
): Promise<{ asset: DraftAsset | null; stored: boolean }> {
  const sizeBytes = Number(file.size || 0)
  const totalBytes = await getDraftAssetsTotalBytes()
  if (totalBytes + sizeBytes > DRAFT_STORAGE_CAP_BYTES) {
    return { asset: null, stored: false }
  }
  const asset: DraftAsset = {
    id: crypto.randomUUID(),
    draftId,
    kind: "file",
    fileName: file.name || "upload",
    mimeType: file.type || "application/octet-stream",
    sizeBytes,
    blob: file,
    createdAt: Date.now()
  }
  await upsertDraftAsset(asset)
  return { asset, stored: true }
}
