import { ModuleProviderExports } from '@medusajs/framework/types'
import { ZeptoMailNotificationService } from './services/zeptomail'

const services = [ZeptoMailNotificationService]

const providerExport: ModuleProviderExports = {
  services,
}

export default providerExport
