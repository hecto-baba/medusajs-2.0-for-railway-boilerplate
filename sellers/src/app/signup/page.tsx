import { getVendorSession } from "@lib/data/vendor"
import { VendorSignupForm } from "@modules/components/vendor-signup-form"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Create your store",
  description: "Register as a seller on the marketplace.",
}

export default async function SignupPage() {
  if (await getVendorSession()) {
    redirect("/dashboard")
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-6 py-12">
      <VendorSignupForm />
    </div>
  )
}
