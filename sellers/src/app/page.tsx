import { redirect } from "next/navigation"

// The panel has no marketing surface of its own, so the root goes straight to
// the dashboard. The panel layout sends a visitor without a session on to
// /login, which is the same landing page login itself uses, so a visitor
// never compiles an unrelated route (/orders) just to be bounced.
export default function Home() {
  redirect("/dashboard")
}
