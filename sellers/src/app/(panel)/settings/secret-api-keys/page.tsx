import { ApiKeysTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Secret API Keys" }

export default function SecretApiKeysPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ApiKeysTable fixedType="secret" />
    </div>
  )
}
