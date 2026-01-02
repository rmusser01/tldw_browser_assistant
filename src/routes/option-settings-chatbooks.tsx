import { SettingsLayout } from "~/components/Layouts/SettingsOptionLayout"
import OptionLayout from "~/components/Layouts/Layout"
import { ChatbooksSettings } from "~/components/Option/Settings/chatbooks"

const OptionChatbooksSettings = () => {
  return (
    <OptionLayout hideHeader>
      <SettingsLayout>
        <ChatbooksSettings />
      </SettingsLayout>
    </OptionLayout>
  )
}

export default OptionChatbooksSettings
