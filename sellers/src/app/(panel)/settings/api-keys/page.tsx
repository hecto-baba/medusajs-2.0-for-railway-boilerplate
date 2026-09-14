import { ApiKeysTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "API Key Management" }

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ApiKeysTable />
    </div>
  )
}
