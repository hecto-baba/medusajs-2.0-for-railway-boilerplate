import { redirect } from "next/navigation"

type ApiKeysPageProps = {
  searchParams?: Promise<{ tab?: string }>
}

export default async function ApiKeysPage({ searchParams }: ApiKeysPageProps) {
  const params = await searchParams
  if (params?.tab === "secret") {
    redirect("/settings/secret-api-keys")
  }
  redirect("/settings/publishable-api-keys")
}
