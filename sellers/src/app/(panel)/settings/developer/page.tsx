import { redirect } from "next/navigation"

export default function DeveloperSettingsPage() {
  redirect("/settings/publishable-api-keys")
}
