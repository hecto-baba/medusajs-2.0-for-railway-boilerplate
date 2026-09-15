import { redirect } from "next/navigation"

export default function SecretApiKeysRedirectPage() {
  redirect("/settings/api-keys?tab=secret")
}
