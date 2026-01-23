import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { WorkspacePlayground } from "@/components/Option/WorkspacePlayground"

const OptionWorkspacePlayground = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6 flex-1 min-h-0" maxWidthClassName="max-w-7xl">
        <WorkspacePlayground />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionWorkspacePlayground
