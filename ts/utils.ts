import { KeyInfo } from "@textile/hub"

export function requireEnvVar(key: string) {
    const value = process.env[key]
    if (!value) {
        console.error(`Didn't get a ${key}`)
        process.exit(1)
    }
    return value
}

export function getKeyInfo(): KeyInfo {
    return {
        key: requireEnvVar('USER_API_KEY'),
        secret: requireEnvVar('USER_API_SECRET'),
    }
}