import { SettingsLayout } from "~/components/Layouts/SettingsOptionLayout"
import OptionLayout from "~/components/Layouts/Layout"
import { ChunkingPlayground } from "@/components/Option/ChunkingPlayground"

const OptionChunkingPlayground = () => {
  return (
    <OptionLayout hideHeader>
      <SettingsLayout>
        <ChunkingPlayground />
      </SettingsLayout>
    </OptionLayout>
  )
}

export default OptionChunkingPlayground
