"use client"

import { Drawer, Heading, clx } from "@medusajs/ui"
import { useRouter } from "next/navigation"
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react"
import { FieldValues, FormProvider, UseFormReturn } from "react-hook-form"

/**
 * The dashboard's edit drawer, rebuilt on the App Router.
 *
 * In the dashboard a drawer is a child *route* rendered into an <Outlet>, and
 * closing it navigates to the parent. There is no Outlet here, so the drawer
 * owns its open state and closing calls router.back() - which keeps the URL
 * behaviour the dashboard has (a drawer is a history entry, so Back closes it)
 * without needing parallel routes.
 *
 * Mounted only while open: the dashboard's drawers are mounted by the router on
 * navigation, so their forms initialise from fresh data each time. Keeping this
 * one mounted would let a cancelled edit's values persist into the next open.
 */

type RouteModalContextValue = {
  handleSuccess: (path?: string) => void
  close: () => void
}

const RouteModalContext = createContext<RouteModalContextValue | null>(null)

export const useRouteModal = () => {
  const context = useContext(RouteModalContext)

  if (!context) {
    throw new Error("useRouteModal must be used inside a RouteDrawer")
  }

  return context
}

type RouteDrawerProps = PropsWithChildren<{
  /** Where to go when the drawer closes. Defaults to router.back(). */
  returnTo?: string
}>

const Root = ({ children, returnTo }: RouteDrawerProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  const navigateAway = useCallback(() => {
    if (returnTo) {
      router.push(returnTo)
      return
    }

    router.back()
  }, [returnTo, router])

  const close = useCallback(() => {
    setOpen(false)
    // Let the close animation finish before the route changes, otherwise the
    // drawer disappears instantly instead of sliding out.
    window.setTimeout(navigateAway, 200)
  }, [navigateAway])

  const handleSuccess = useCallback(
    (path?: string) => {
      setOpen(false)
      window.setTimeout(() => {
        if (path) {
          router.push(path)
          return
        }

        navigateAway()
        // The section behind the drawer renders server-fetched data, so it has
        // to be refetched or a save would leave stale values on screen.
        router.refresh()
      }, 200)
    },
    [navigateAway, router]
  )

  return (
    <RouteModalContext.Provider value={{ handleSuccess, close }}>
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            close()
          }
        }}
      >
        <Drawer.Content>{children}</Drawer.Content>
      </Drawer>
    </RouteModalContext.Provider>
  )
}

const Header = ({ children }: PropsWithChildren) => {
  return <Drawer.Header>{children}</Drawer.Header>
}

const Title = ({ children }: PropsWithChildren) => {
  return (
    <Drawer.Title asChild>
      <Heading>{children}</Heading>
    </Drawer.Title>
  )
}

const Description = ({ children }: PropsWithChildren) => {
  return (
    <Drawer.Description className="txt-small text-ui-fg-subtle">
      {children}
    </Drawer.Description>
  )
}

const Body = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => {
  return (
    <Drawer.Body className={clx("flex flex-1 flex-col overflow-auto", className)}>
      {children}
    </Drawer.Body>
  )
}

const Footer = ({ children }: PropsWithChildren) => {
  return <Drawer.Footer>{children}</Drawer.Footer>
}

const Close = Drawer.Close

/**
 * Wraps the drawer's children in a react-hook-form provider, mirroring
 * RouteDrawer.Form in the dashboard.
 */
const FormWrapper = <TFieldValues extends FieldValues>({
  form,
  children,
}: PropsWithChildren<{ form: UseFormReturn<TFieldValues> }>) => {
  return <FormProvider {...form}>{children}</FormProvider>
}

export const RouteDrawer = Object.assign(Root, {
  Header,
  Title,
  Description,
  Body,
  Footer,
  Close,
  Form: FormWrapper,
})
