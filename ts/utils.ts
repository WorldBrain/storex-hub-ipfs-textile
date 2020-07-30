import { KeyInfo } from "@textile/hub"

export function requireEnvVar(key: string) {
    const value = process.env[key]
    if (!value) {
        console.error(`Didn't get a ${key}`)
        process.exit(1)
    }
    return value
}
