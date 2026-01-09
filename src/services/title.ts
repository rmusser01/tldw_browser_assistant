import { pageAssistModel } from "@/models"
import { HumanMessage } from "@/types/messages"
import { removeReasoning } from "@/libs/reasoning"
import { coerceBoolean, defineSetting, getSetting, setSetting } from "@/services/settings/registry"

const TITLE_GEN_ENABLED_SETTING = defineSetting(
    "titleGenEnabled",
    false,
    (value) => coerceBoolean(value, false)
)

// this prompt is copied from the OpenWebUI codebase
export const DEFAULT_TITLE_GEN_PROMPT = `Here is the query:

--------------

{{query}}

--------------

Create a concise, 3-5 word phrase as a title for the previous query. Avoid quotation marks or special formatting. RESPOND ONLY WITH THE TITLE TEXT. ANSWER USING THE SAME LANGUAGE AS THE QUERY.


Examples of titles:

Stellar Achievement Celebration
Family Bonding Activities
🇫🇷 Voyage à Paris
🍜 Receta de Ramen Casero
Shakespeare Analyse Literarische
日本の春祭り体験
Древнегреческая Философия Обзор

Response:`


export const isTitleGenEnabled = async () => {
    return await getSetting(TITLE_GEN_ENABLED_SETTING)
}

export const setTitleGenEnabled = async (enabled: boolean) => {
    await setSetting(TITLE_GEN_ENABLED_SETTING, enabled)
}


export const generateTitle = async (model: string, query: string, fallBackTitle: string) => {

    const isEnabled = await isTitleGenEnabled()

    if (!isEnabled) {
        return fallBackTitle
    }

    try {
        const titleModel = await pageAssistModel({
            model,
            toolChoice: "none",
            saveToDb: false
        })

        const prompt = DEFAULT_TITLE_GEN_PROMPT.replace("{{query}}", query)

        const title = await titleModel.invoke([
            new HumanMessage({
                content: prompt
            })
        ])

        return removeReasoning(title.content.toString())
    } catch (error) {
        console.error(`Error generating title: ${error}`)
        return fallBackTitle
    }
}
