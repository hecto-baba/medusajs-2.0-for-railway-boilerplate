import { ApiKeysTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Publishable API Keys" }

export default function PublishableApiKeysPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ApiKeysTable defaultTab="publishable" />
    </div>
  )
}
