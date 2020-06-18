import { writeFileSync, existsSync, readFileSync } from "fs";
import { SettingsStore, Settings } from "./types";
import { StorexHubApi_v0 } from "@worldbrain/storex-hub/lib/public-api";

export class FileSettingsStore implements SettingsStore {
    settings?: Partial<Settings>

    constructor(private path: string) {
    }

    async getSettings() {
        return this.settings ?? (await this._loadSettings())
    }

    async updateSettings(updates: Partial<Settings>) {
        const settings = await this.getSettings()
        Object.assign(settings, updates)
        await this._saveSettings()
    }

    async _loadSettings(): Promise<Partial<Settings>> {
        const hasConfig = existsSync(this.path)
        const existingConfig = hasConfig ? JSON.parse(readFileSync(this.path).toString()) : null
        const settings = existingConfig || {}
        this.settings = settings
        return settings
    }

    async _saveSettings() {
        writeFileSync(this.path, JSON.stringify(this.settings))
    }
}

export class MemorySettingsStore implements SettingsStore {
    settings: Partial<Settings>

    constructor(settings?: Settings) {
        this.settings = settings ?? {}
    }

    async getSettings(): Promise<Partial<Settings>> {
        return this.settings
    }

    async updateSettings(updates: Partial<Settings>) {
        Object.assign(this.settings, updates)
    }
}

export class StorexHubSettingsStore implements SettingsStore {
    settings?: Partial<Settings>

    constructor(private api: StorexHubApi_v0) { }

    async getSettings() {
        return this.settings ?? (await this._loadSettings())
    }

    async updateSettings(updates: Partial<Settings>) {
        const settings = await this.getSettings()
        Object.assign(settings, updates)
        const response = await this.api.setAppSettings({ updates: settings as any });
        if (response.status !== 'success') {
            throw new Error(`Could not save settings: ${response.status}`)
        }
    }

    async _loadSettings(): Promise<Partial<Settings>> {
        const response = await this.api.getAppSettings({ keys: 'all' });
        if (response.status !== 'success') {
            throw new Error(`Could not load settings: ${response.status}`)
        }
        const settings = response.settings
        this.settings = settings
        return settings
    }
}
