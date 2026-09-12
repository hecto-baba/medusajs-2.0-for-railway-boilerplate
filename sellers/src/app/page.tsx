import { redirect } from "next/navigation"

// The panel has no marketing surface of its own: the root either resumes a
// session or asks for one. getVendorSession is not consulted here because
// /orders already guards itself via the panel layout, and checking twice
// would double the round-trip on the most common entry point.
export default function Home() {
  redirect("/orders")
}
