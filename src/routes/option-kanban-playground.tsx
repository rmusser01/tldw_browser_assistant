import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { KanbanPlayground } from "@/components/Option/KanbanPlayground"

const OptionKanbanPlayground = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6" maxWidthClassName="max-w-7xl">
        <KanbanPlayground />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionKanbanPlayground
