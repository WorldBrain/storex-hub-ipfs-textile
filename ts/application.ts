import { EventEmitter } from 'events'
import { Client, Buckets, ThreadID, KeyInfo, PrivateKey } from '@textile/hub'
import { StorexHubApi_v0, StorexHubCallbacks_v0, HandleRemoteCallResult_v0 } from '@worldbrain/storex-hub/lib/public-api'
import { SettingsStore, Settings } from './types'
import { APP_NAME } from './constants'
import { APP_SETTINGS_DESCRIPTION } from './app-settings'

type Logger = (...args: any[]) => void

export class StorageOperationError extends Error { }

export class Application {
    events = new EventEmitter()
    client!: StorexHubApi_v0
    threadsClient?: Client
    bucketsClient?: Buckets
    settingsStore!: SettingsStore
    localSettingsStore?: SettingsStore
    logger: Logger
    schemaUpdated = false

    constructor(private options: {
        needsIdentification: boolean
        logger?: Logger
        localSettingsStore?: SettingsStore
    }) {
        this.logger = options?.logger || console.log.bind(console)
        this.localSettingsStore = options.localSettingsStore
    }

    getCallbacks(): StorexHubCallbacks_v0 {
        return {
            handleEvent: async ({ event }) => {
            },
            handleRemoteCall: async ({ call, args }) => {
                try {
                    let result: HandleRemoteCallResult_v0
                    if (call === 'createThread') {
                        result = await this.createThreadCall()
                    } else if (call === 'createCollection') {
                        result = await this.createCollectionCall(args)
                    } else if (call === 'createObjects') {
                        result = await this.createObjectsCall(args)
                    } else if (call === 'findObjects') {
                        result = await this.findObjectsCall(args)
                    } else if (call === 'ensureBucket') {
                        result = await this.ensureBucketCall(args)
                    } else if (call === 'pushBucket') {
                        result = await this.pushBucketCall(args)
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

    async getKeyInfo() {
        const settings = await this.settingsStore.getSettings()
        if (!settings.userKey || !settings.userSecret) {
            throw new Error(`Tried to execute a call without providing a user key or secret`)
        }
        const keyInfo: KeyInfo = {
            key: settings.userKey,
            secret: settings.userSecret,
        }
        return keyInfo
    }

    async createThreadsClient() {
        const client = await Client.withKeyInfo(await this.getKeyInfo())
        const identity = await PrivateKey.fromRandom()
        await client.getToken(identity)
        this.threadsClient = client
        return client
    }

    async createBucketsClient() {
        const client = await Buckets.withKeyInfo(await this.getKeyInfo())
        const identity = await PrivateKey.fromRandom()
        await client.getToken(identity)
        this.bucketsClient = client
        return client
    }

    async getBucketsClient() {
        return this.bucketsClient ?? this.createBucketsClient()
    }

    async getThreadsClient() {
        return this.threadsClient ?? this.createThreadsClient()
    }

    async createThreadCall(): Promise<HandleRemoteCallResult_v0> {
        const newThreadID = ThreadID.fromRandom()
        const client = await this.getThreadsClient()
        // await client.newDB(newThreadID)
        return { status: 'success', result: { threadID: newThreadID.toString() } }
    }

    async createCollectionCall(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
        const { name: collectionName, threadID: givenThreadID, schema } = args
        if (!collectionName) {
            return { status: 'invalid-args' }
        }
        const threadID = await this._getThreadID(givenThreadID)
        if (threadID === 'invalid') {
            return { status: 'invalid-args' }
        }
        const client = await this.getThreadsClient()
        await client.newCollection(threadID, collectionName, schema)
        return { status: 'success', result: {} }
    }

    async createObjectsCall(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
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

    async ensureBucketCall(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
        const bucketName = args.bucketName
        if (!bucketName) {
            return { status: 'invalid-args' }
        }

        return { status: 'success', result: await this.ensureBucket({ bucketName }) }
    }

    async ensureBucket(args: { bucketName: string }) {
        const client = await this.getBucketsClient()

        const result = await client.getOrInit(args.bucketName)
        const bucketKey = result.root?.key
        if (!bucketKey) throw new Error('bucket not created')
        return { bucketKey }
    }

    async findObjectsCall(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
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
        return { status: 'call-not-found' }
    }

    async pushBucketCall(args: { [key: string]: any }): Promise<HandleRemoteCallResult_v0> {
        const { bucketName, path, content } = args
        if (!bucketName || !path || !content) {
            return { status: 'invalid-args' }
        }

        const { pushResult } = await this.pushBucket({ bucketName, path, content })
        return { status: 'success', result: { pushResult } }
    }

    async pushBucket(args: { bucketName: string, path: string, content: any }) {
        console.log(`Pushing to bucket ${args.bucketName}, path ${args.path}`)
        const client = await this.getBucketsClient()
        console.log(`Got bucket client, ensuring bucket exists`)
        const { bucketKey } = await this.ensureBucket({ bucketName: args.bucketName })
        console.log(`Ensured bucket exists, pushing content`)
        const content = typeof args.content === 'string' ? args.content : JSON.stringify(args.content)
        const file = { path: args.path, content: Buffer.from(content) }
        const pushResult = await client.pushPath(bucketKey, args.path, file)
        console.log('Successful push! Result:', pushResult)
        return { pushResult }
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
        const newThreadID = ThreadID.fromRandom()
        console.log('creating client')
        const client = await this.getThreadsClient()
        console.log('creating database')
        await client.newDB(newThreadID)
        return newThreadID
    }

    async registerOrIdentify() {
        if (!this.options.needsIdentification) {
            return
        }

        const localSettingsStore = this.localSettingsStore!
        const sessionInfo = await this.client.getSessionInfo()

        this.logger(`Identifying with Storex Hub as '${APP_NAME}'`)
        const accessTokens = (await localSettingsStore.getSettings()).accessTokens ?? {}
        const accessToken = accessTokens[sessionInfo.instanceId]
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
                await localSettingsStore.updateSettings({ accessTokens })
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
