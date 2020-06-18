global['WebSocket'] = require('isomorphic-ws')
import io from 'socket.io-client'
import { createStorexHubSocketClient } from '@worldbrain/storex-hub/lib/client'
import { Identity, ThreadID, Libp2pCryptoIdentity } from '@textile/threads-core'
import { Database } from '@textile/threads-database'
import { Client, KeyInfo } from '@textile/hub'
import { Application } from './application'
import { FileSettingsStore } from './settings'
import { join } from 'path'

export async function main(options?: {
    port?: number
    local?: boolean
}) {
    function serializeThreadID(threadID: ThreadID) {
        return threadID.toString()
    }
    function deserializeThreadID(threadIDString: string) {
        return ThreadID.fromString(threadIDString)
    }

    // let database: Database
    // if (options?.local) {
    //     const identity = await Database.randomIdentity()
    //     database = new Database('demo.db')
    //     await database.start(identity)
    // } else {
    //     const client = await Client.withKeyInfo(getKeyInfo())
    //     const identity = await Libp2pCryptoIdentity.fromRandom()
    //     const token = await client.getToken(identity)
    //     const threadId = ThreadID.fromRandom()
    //     await client.newDB(threadId)
    // }

    // const db = new Database('demo.db')
    // await db.start(identity)

    // const Thing = db.collections.get('Thing') ?? await db.newCollection('Thing', {})
    // const thing1 = new Thing({ test: 5 })
    // const thing2 = new Thing({ test: 8 })
    // await thing1.save()
    // await thing2.save()

    // for await (const test of Thing.find({ test: { $gt: 6 } })) {
    //     console.log(await test)
    // }

    // const db = new Database()
    const port = options?.port ?? (process.env.NODE_ENV === 'production' ? 50482 : 50483)
    const socket = io(`http://localhost:${port}`)
    console.log('Connecting to Storex Hub')

    const application = new Application({ needsIdentification: true })
    const client = await createStorexHubSocketClient(socket, { callbacks: application.getCallbacks() })
    const settingsStore = new FileSettingsStore(join(__dirname, '..', 'private', 'settings.json'))
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
