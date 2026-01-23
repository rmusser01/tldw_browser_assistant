import { db } from "./schema"
import type { TtsClip } from "./types"

export const TTS_CLIP_LIMIT = 30

export async function getTtsClips(): Promise<TtsClip[]> {
  return await db.ttsClips.orderBy("createdAt").reverse().toArray()
}

export async function getTtsClipById(id: string): Promise<TtsClip | undefined> {
  return await db.ttsClips.get(id)
}

export async function saveTtsClip(clip: TtsClip): Promise<void> {
  await db.transaction("rw", [db.ttsClips], async () => {
    await db.ttsClips.put(clip)
    const count = await db.ttsClips.count()
    if (count <= TTS_CLIP_LIMIT) return

    const overflow = count - TTS_CLIP_LIMIT
    const toRemove = await db.ttsClips.orderBy("createdAt").limit(overflow).toArray()
    if (toRemove.length) {
      await db.ttsClips.bulkDelete(toRemove.map((item) => item.id))
    }
  })
}

export async function deleteTtsClip(id: string): Promise<void> {
  await db.ttsClips.delete(id)
}

export async function clearTtsClips(): Promise<void> {
  await db.ttsClips.clear()
}
