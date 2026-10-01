"use client"

import { Popover, Transition } from "@headlessui/react"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { Text, clx, useToggleState } from "@medusajs/ui"
import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CountrySelect from "../country-select"
import { HttpTypes } from "@medusajs/types"
import { getStoreName } from "@lib/util/env"

type SideMenuGroup = {
  title?: string
  items: {
    name: string
    href: string
  }[]
}

const SideMenuGroups: SideMenuGroup[] = [
  {
    title: "Catalog",
    items: [
      { name: "Home", href: "/" },
      { name: "Store", href: "/store" },
      { name: "Digital Products", href: "/digital-products" },
      { name: "Restaurants", href: "/restaurants" },
    ],
  },
  {
    title: "Account",
    items: [
      { name: "Account", href: "/account" },
      { name: "My Digital Library", href: "/account/digital-products" },
    ],
  },
  {
    title: "Cart & Search",
    items: [
      { name: "Search", href: "/search" },
      { name: "Cart", href: "/cart" },
    ],
  },
]

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  customerInfo?: { first_name?: string | null; email?: string | null } | null
}

const SideMenu = ({
  regions,
  customerInfo,
}: SideMenuProps) => {
  const toggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  className="relative h-full flex items-center transition-all ease-out duration-200 focus:outline-none hover:text-ui-fg-base"
                >
                  Menu
                </Popover.Button>
              </div>

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100 backdrop-blur-2xl"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 backdrop-blur-2xl"
                leaveTo="opacity-0"
              >
                <Popover.Panel className="flex flex-col absolute w-full pr-4 sm:pr-0 sm:w-1/3 2xl:w-1/4 sm:min-w-min h-[calc(100vh-1rem)] z-[60] inset-x-0 text-sm text-ui-fg-on-color m-2 backdrop-blur-2xl">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col h-full bg-[rgba(3,7,18,0.7)] rounded-rounded justify-between p-6 overflow-hidden"
                  >
                    <div className="flex justify-between items-center pb-4 border-b border-white/10" id="xmark">
                      {customerInfo ? (
                        <div className="text-xs text-white/80">
                          Signed in as <span className="font-semibold text-white">{customerInfo.first_name || customerInfo.email}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-white/60 uppercase tracking-wider font-semibold">
                          Navigation
                        </div>
                      )}

                      <button
                        type="button"
                        data-testid="close-menu-button"
                        onClick={close}
                        aria-label="Close menu"
                        className="text-white/80 hover:text-white transition"
                      >
                        <XMark />
                      </button>
                    </div>
                    <div className="flex flex-col gap-6 overflow-y-auto pr-1 my-4">
                      {SideMenuGroups.map((group, groupIdx) => (
                        <div key={groupIdx} className="flex flex-col gap-y-2">
                          {group.title && (
                            <span className="text-xs uppercase tracking-wider text-ui-fg-muted font-semibold pb-1 border-b border-white/10">
                              {group.title}
                            </span>
                          )}
                          <ul className="flex flex-col gap-2.5 items-start justify-start">
                            {group.items.map(({ name, href }) => {
                              return (
                                <li key={name}>
                                  <LocalizedClientLink
                                    href={href}
                                    className="text-2xl leading-8 hover:text-ui-fg-disabled transition-colors"
                                    onClick={close}
                                    data-testid={`${name.toLowerCase().replace(/\s+/g, "-")}-link`}
                                  >
                                    {name}
                                  </LocalizedClientLink>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-y-6 pt-4 border-t border-white/10">
                      <div
                        className="flex justify-between items-center"
                        onMouseEnter={toggleState.open}
                        onMouseLeave={toggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={toggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            toggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="flex justify-between txt-compact-small text-white/60">
                        © {new Date().getFullYear()} {getStoreName()}. All rights
                        reserved.
                      </Text>
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
