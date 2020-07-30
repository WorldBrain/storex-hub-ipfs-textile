import { SettingsDescription } from "@worldbrain/storex-hub-interfaces/lib/settings";

export const APP_SETTINGS_DESCRIPTION: SettingsDescription = {
    layout: {
        sections: [
            {
                title: "General",
                contents: [{ field: "userKey" }, { field: "userSecret" }],
            },
        ],
    },
    fields: {
        userKey: {
            type: "string",
            label: "Textile user key",
            widget: { type: "text-input" },
        },
        userSecret: {
            type: "string",
            label: "Textile user secret",
            widget: { type: "text-input" },
        },
    },
}