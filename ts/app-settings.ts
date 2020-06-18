import { SettingsDescription } from "@worldbrain/storex-hub-interfaces/lib/settings";

export const APP_SETTINGS_DESCRIPTION: SettingsDescription = {
    layout: {
        sections: [
            {
                title: "General",
                contents: [{ field: "walletKey" }],
            },
        ],
    },
    fields: {
        walletKey: {
            type: "string",
            label: "Arweave JWT key",
            widget: { type: "text-input" },
        },
    },
}