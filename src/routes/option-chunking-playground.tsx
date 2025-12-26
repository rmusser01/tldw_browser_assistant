import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { ChunkingPlayground } from "@/components/Option/ChunkingPlayground"

const OptionChunkingPlayground = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6" maxWidthClassName="max-w-4xl">
        <ChunkingPlayground />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionChunkingPlayground
