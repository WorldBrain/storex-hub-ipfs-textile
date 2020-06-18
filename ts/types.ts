export interface Settings {
    accessTokens: { [instanceId: string]: string }
    defaultThreadID: string
}

export interface SettingsStore {
    getSettings(): Promise<Partial<Settings>>
    updateSettings(updates: Partial<Settings>): Promise<void>
}
