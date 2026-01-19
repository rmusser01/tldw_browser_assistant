import OptionLayout from "~/components/Layouts/Layout"
import { PageShell } from "@/components/Common/PageShell"
import { WritingPlayground } from "@/components/Option/WritingPlayground"

const OptionWritingPlayground = () => {
  return (
    <OptionLayout>
      <PageShell className="py-6" maxWidthClassName="max-w-7xl">
        <WritingPlayground />
      </PageShell>
    </OptionLayout>
  )
}

export default OptionWritingPlayground
