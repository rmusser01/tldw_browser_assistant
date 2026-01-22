import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { ModelPlayground } from "@/components/Option/ModelPlayground"

const OptionModelPlayground = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6" maxWidthClassName="max-w-7xl">
        <ModelPlayground />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionModelPlayground
