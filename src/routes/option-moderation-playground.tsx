import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { ModerationPlayground } from "@/components/Option/ModerationPlayground"

const OptionModerationPlayground = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6" maxWidthClassName="max-w-7xl">
        <ModerationPlayground />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionModerationPlayground
