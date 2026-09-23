import { getVendorSession } from "@lib/data/vendor"
import { VendorLoginForm } from "@modules/auth"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your store.",
}

export default async function LoginPage() {
  // Someone already signed in has no reason to see this form.
  if (await getVendorSession()) {
    redirect("/dashboard")
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-6 py-12">
      <VendorLoginForm />
    </div>
  )
}
