import { ChromeIcon, CpuIcon } from "lucide-react"
import { OllamaIcon } from "../Icons/Ollama"
import { FireworksMonoIcon } from "../Icons/Fireworks"
import { GroqMonoIcon } from "../Icons/Groq"
import { LMStudioIcon } from "../Icons/LMStudio"
import { OpenAiIcon } from "../Icons/OpenAI"
import { TogtherMonoIcon } from "../Icons/Togther"
import { OpenRouterIcon } from "../Icons/OpenRouter"
import { LLamaFile } from "../Icons/Llamafile"
import { GeminiIcon } from "../Icons/GeminiIcon"
import { MistarlIcon } from "../Icons/Mistral"
import { DeepSeekIcon } from "../Icons/DeepSeek"
import { SiliconFlowIcon } from "../Icons/SiliconFlow"
import { VolcEngineIcon } from "../Icons/VolcEngine"
import { TencentCloudIcon } from "../Icons/TencentCloud"
import { AliBaBaCloudIcon } from "../Icons/AliBaBaCloud"
import { LlamaCppLogo } from "../Icons/LlamacppLogo"
import { InfinigenceAI } from "../Icons/InfinigenceAI"
import { NovitaIcon } from "../Icons/Novita"
import { VllmLogo } from "../Icons/VllmLogo"
import { MoonshotIcon } from "../Icons/Moonshot"
import { XAIIcon } from "../Icons/XAI"
import { HuggingFaceIcon } from "../Icons/HuggingFaceIcon"
import { VercelIcon } from "../Icons/VercelIcon"
import { ChutesIcon } from "../Icons/ChutesIcon"

export const ProviderIcons = ({
  provider,
  className
}: {
  provider: string
  className?: string
}) => {
  switch (provider) {
    case "tldw":
      return <CpuIcon className={className} />
    case "chrome":
      return <ChromeIcon className={className} />
    case "custom":
      return <CpuIcon className={className} />
    case "fireworks":
      return <FireworksMonoIcon className={className} />
    case "groq":
      return <GroqMonoIcon className={className} />
    case "lmstudio":
      return <LMStudioIcon className={className} />
    case "openai":
      return <OpenAiIcon className={className} />
    case "together":
      return <TogtherMonoIcon className={className} />
    case "openrouter":
      return <OpenRouterIcon className={className} />
    case "llamafile":
      return <LLamaFile className={className} />
    case "gemini":
      return <GeminiIcon className={className} />
    case "mistral":
      return <MistarlIcon className={className} />
    case "deepseek":
      return <DeepSeekIcon className={className} />
    case "siliconflow":
      return <SiliconFlowIcon className={className} />
    case "volcengine":
      return <VolcEngineIcon className={className} />
    case "tencentcloud":
      return <TencentCloudIcon className={className} />
    case "alibabacloud":
      return <AliBaBaCloudIcon className={className} />
    case "llamacpp":
      return <LlamaCppLogo className={className} />
    case "infinitenceai":
      return <InfinigenceAI className={className} />
    case "novita":
      return <NovitaIcon className={className} />
    case "vllm":
      return <VllmLogo className={className} />
    case "moonshot":
      return <MoonshotIcon className={className} />
    case "xai":
      return <XAIIcon className={className} />
    case "huggingface":
      return <HuggingFaceIcon className={className} />
    case "vercel":
      return <VercelIcon className={className} />
    case "chutes":
      return <ChutesIcon className={className} />
    default:
      return <CpuIcon className={className} />
  }
}
