import { EventEmitter } from 'events'
import { Libp2pCryptoIdentity } from '@textile/threads-core'
import { Client, ThreadID, KeyInfo } from '@textile/hub'
import { StorexHubApi_v0, StorexHubCallbacks_v0, HandleRemoteCallResult_v0 } from '@worldbrain/storex-hub/lib/public-api'
import { StorageOperationChangeInfo } from '@worldbrain/storex-middleware-change-watcher/lib/types'
import { Tag } from '@worldbrain/memex-storex-hub/lib/types'
import { SettingsStore, Settings } from './types'
import { APP_NAME } from './constants'
import { APP_SETTINGS_DESCRIPTION } from './app-settings'
import { getKeyInfo } from './utils'

type Logger = (...args: any[]) => void

export class StorageOperationError extends Error { }

export class Application {
    events = new EventEmitter()
    client!: StorexHubApi_v0
    threadsClient?: Client
    settingsStore!: SettingsStore
    logger: Logger
    schemaUpdated = false

    constructor(private options: {
        needsIdentification: boolean
        logger?: Logger
    }) {
        this.logger = options?.logger || console.log.bind(console)
    }

    getCallbacks(): StorexHubCallbacks_v0 {
        return {
            handleEvent: async ({ event }) => {
            },
            handleRemoteCall: async ({ call, args }) => {
                try {
                    let result: HandleRemoteCallResult_v0
                    if (call === 'createThread') {
                        result = await this.createThread()
                    } else if (call === 'createCollection') {
                        result = await this.createCollection(args)
                    } else if (call === 'createObjects') {
                        result = await this.createObjects(args)
                    } else if (call === 'findObjects') {
                        result = await this.findObjects(args)
                    } else {
                        return { status: 'call-not-found' }
                    }
                    return result
                } catch (e) {
                    console.error('Error while processing remote call:')
                    console.error(e)
                    return { status: 'internal-error', errorStatus: 'exception', errorText: e.message || '' }
                }
            }
        }
    }

    async setup(options: {
        client: StorexHubApi_v0
        settingsStore: SettingsStore
    }) {
        this.client = options.client
        this.settingsStore = options.settingsStore

        await this.initializeSession()
    }

    async getSetting<Key extends keyof Settings>(key: Key): Promise<Partial<Settings>[Key]> {
        const settings = await this.settingsStore.getSettings()
        return settings[key]
    }

    async createThreadsClient() {
        const client = await Client.withKeyInfo(getKeyInfo())
        const identity = await Libp2pCryptoIdentity.fromRandom()
        await client.getToken(identity)
        return client
    }

    async getThreadsClient() {
        return this.threadsClient ?? (this.createThreadsClient())
    }

    async createThread(): Promise<HandleRemoteCallResult_v0> {
        const newThreadID = ThreadID.fromRandom()
        const client = await this.getThreadsClient()
        await client.newDB(newThreadID)
        return { status: 'success', result: { threadID: newThreadID.toString() } }
    }

    async createCollection(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
        const { name: collectionName, threadID: givenThreadID, schema } = args
        if (!collectionName) {
            return { status: 'invalid-args' }
        }
        const threadID = await this._getThreadID(givenThreadID)
        if (threadID === 'invalid') {
            return { status: 'invalid-args' }
        }
        const client = await this.getThreadsClient()
        console.log(client.context)
        console.log('creating collection in thread', threadID, collectionName, schema)
        const schema2 = {
            properties: {
                _id: { type: 'string' },
                fullName: { type: 'string' },
                age: { type: 'integer', minimum: 0 },
            },
        }
        console.log(await client.listDBs())
        // await client.newCollection(threadID, collectionName, schema2)
        return { status: 'success', result: {} }
    }

    async createObjects(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
        const { collection, objects, threadID: givenThreadID } = args
        if (!collection || !objects || !(objects instanceof Array)) {
            return { status: 'invalid-args' }
        }
        const threadID = await this._getThreadID(givenThreadID)
        if (threadID === 'invalid') {
            return { status: 'invalid-args' }
        }
        const client = await this.getThreadsClient()
        await client.create(threadID, collection, objects)

        return { status: 'success', result: {} }
    }

    async findObjects(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
        const { collection, where, threadID: givenThreadID } = args
        if (!collection || !where) {
            return { status: 'invalid-args' }
        }
        const threadID = await this._getThreadID(givenThreadID)
        if (threadID === 'invalid') {
            return { status: 'invalid-args' }
        }
        const client = await this.getThreadsClient()
        const resultList = await client.find(threadID, collection, where)
        console.log(resultList.instancesList)

        return { status: 'call-not-found' }
    }

    async _getThreadID(givenThreadID?: string): Promise<ThreadID | 'invalid'> {
        if (givenThreadID) {
            try {
                return ThreadID.fromString(givenThreadID)
            } catch (e) {
                return 'invalid'
            }
        }
        return this.getDefaultThreadID()
    }

    async getDefaultThreadID() {
        // const savedThreadID = await this.getSetting('defaultThreadID')
        // if (savedThreadID) {
        //     return ThreadID.fromString(savedThreadID)
        // }

        const newThreadID = ThreadID.fromRandom()
        console.log('creating client')
        const client = await this.getThreadsClient()
        console.log('creating database')
        await client.newDB(newThreadID)
        // await this.settingsStore.updateSettings({ defaultThreadID: newThreadID.toString() })
        return newThreadID
    }

    async registerOrIdentify() {
        if (!this.options.needsIdentification) {
            return
        }

        const sessionInfo = await this.client.getSessionInfo()

        this.logger(`Identifying with Storex Hub as '${APP_NAME}'`)
        const accessTokens = await this.getSetting('accessTokens') ?? {}
        const accessToken = accessTokens?.[sessionInfo.instanceId]
        if (accessToken) {
            this.logger(`Found existing access token, using it to identify`)
            const identificationResult = await this.client.identifyApp({
                name: APP_NAME,
                accessToken
            })
            if (identificationResult.status !== 'success') {
                throw new Error(`Couldn't identify app '${APP_NAME}': ${identificationResult.status}`)
            }
        }
        else {
            this.logger(`Could not find existing access token, so registering`)
            const registrationResult = await this.client.registerApp({
                name: APP_NAME,
                identify: true,
                remote: true,
            })
            if (registrationResult.status === 'success') {
                const accessToken = registrationResult.accessToken
                accessTokens[sessionInfo.instanceId] = accessToken
                await this.settingsStore.updateSettings({ accessTokens })
            }
            else {
                throw new Error(`Couldn't register app '${APP_NAME}'": ${registrationResult.status}`)
            }
        }
        this.logger(`Successfuly identified with Storex Hub as '${APP_NAME}'`)
    }

    async initializeSession() {
        await this.registerOrIdentify()
        if (!this.schemaUpdated) {
            await this.client.describeAppSettings({
                description: APP_SETTINGS_DESCRIPTION
            })

            this.schemaUpdated = true
        }
    }
}
