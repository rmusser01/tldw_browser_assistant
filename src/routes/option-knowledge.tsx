import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { KnowledgeSearchChat } from "@/components/Option/KnowledgeSearchChat"

const OptionKnowledgeWorkspace = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6 flex-1 min-h-0" maxWidthClassName="max-w-7xl">
        <KnowledgeSearchChat />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionKnowledgeWorkspace
