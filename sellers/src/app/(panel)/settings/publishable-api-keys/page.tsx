import { redirect } from "next/navigation"

export default function PublishableApiKeysRedirectPage() {
  redirect("/settings/api-keys?tab=publishable")
}
