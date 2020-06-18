import { PluginEntryFunction, PluginInterface } from "@worldbrain/storex-hub-interfaces/lib/plugins"
import { Application } from "./application"
import { StorexHubSettingsStore } from "./settings"

export const main: PluginEntryFunction = async (input) => {
    const application = new Application({ needsIdentification: false })
    const api = await input.getApi({ callbacks: application.getCallbacks() })
    const settingsStore = new StorexHubSettingsStore(api)

    const plugin: PluginInterface = {
        start: async () => {
            await application.setup({
                client: api,
                settingsStore,
            })
        },
        stop: async () => {
        }
    }
    return plugin
}
