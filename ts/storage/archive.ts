import { StorageModule, StorageModuleConfig } from '@worldbrain/storex-pattern-modules'
import { ArchivedPage } from '../types'

export class ArchiveStorage extends StorageModule {
    getConfig = (): StorageModuleConfig => ({
        collections: {
            archivedPage: {
                version: new Date('2020-04-17'),
                fields: {
                    createdWhen: { type: 'timestamp' },
                    pageUrl: { type: 'string' },
                    transactionId: { type: 'string' },
                }
            }
        },
        operations: {
            createArchivedPage: {
                operation: 'createObject',
                collection: 'archivedPage'
            },
            findArchivedPage: {
                operation: 'findObject',
                collection: 'archivedPage',
                args: { pageUrl: '$pageUrl:string' }
            },
            listArchivedPages: {
                operation: 'findObjects',
                collection: 'archivedPage',
                args: {}
            }
        }
    })

    async storeArchivedPage(archivedPage: ArchivedPage) {
        await this.operation('createArchivedPage', { ...archivedPage, createdWhen: Date.now() })
    }

    async getArchivedPage(pageUrl: string) {
        return this.operation('findArchivedPage', { pageUrl })
    }
}
