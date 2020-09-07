global['WebSocket'] = require('isomorphic-ws')
import io from 'socket.io-client'
import { createStorexHubSocketClient } from '@worldbrain/storex-hub/lib/client'
// import { Client, KeyInfo, ThreadID, Identity, PrivateKey } from '@textile/hub'
import { Application } from './application'
import { FileSettingsStore, StorexHubSettingsStore } from './settings'
import { join } from 'path'

export async function main(options?: {
    port?: number
    local?: boolean
}) {
    // function serializeThreadID(threadID: ThreadID) {
    //     return threadID.toString()
    // }
    // function deserializeThreadID(threadIDString: string) {
    //     return ThreadID.fromString(threadIDString)
    // }

    // const client = await Client.withKeyInfo(getKeyInfo())
    // const identity = await PrivateKey.fromRandom()
    // const token = await client.getToken(identity)
    // const threadId = ThreadID.fromRandom()
    // await client.newDB(threadId)

    const port = options?.port ?? (process.env.NODE_ENV === 'production' ? 50482 : 50483)
    const socket = io(`http://localhost:${port}`)
    console.log('Connecting to Storex Hub')

    const localSettingsStore = new FileSettingsStore(join(__dirname, '..', 'private', 'settings.json'))
    const application = new Application({ needsIdentification: true, localSettingsStore })
    const client = await createStorexHubSocketClient(socket, { callbacks: application.getCallbacks() })
    const settingsStore = new StorexHubSettingsStore(client)
    await application.setup({
        client,
        settingsStore,
    })

    console.log('Connected to Storex Hub')

    socket.on('reconnect', async () => {
        console.log('Re-connected to Storex Hub')
        await application.initializeSession()
    })
    socket.on('disconnect', async (reason: string) => {
        console.log('Lost connection to Storex Hub:', reason)
    })

    console.log('Setup complete')
}

if (require.main === module) {
    main()
}
