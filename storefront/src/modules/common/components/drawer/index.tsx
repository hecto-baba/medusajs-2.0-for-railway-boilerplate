"use client"

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react"
import { clx } from "@medusajs/ui"
import React, { Fragment } from "react"

import X from "@modules/common/icons/x"

type DrawerProps = {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  /** Pinned to the bottom of the panel (for example the checkout button). */
  footer?: React.ReactNode
  side?: "right" | "left"
  className?: string
  "data-testid"?: string
}

/**
 * Side panel built on Headless UI's Dialog, which gives a focus trap, Escape
 * to close, scroll lock and focus return to the trigger.
 */
const Drawer = ({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  className,
  "data-testid": dataTestId = "drawer",
}: DrawerProps) => {
  const right = side === "right"

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[90]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/50" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-hidden">
          <div
            className={clx("absolute inset-y-0 flex max-w-full", {
              "right-0": right,
              "left-0": !right,
            })}
          >
            <TransitionChild
              as={Fragment}
              enter="transform transition ease-out duration-300"
              enterFrom={right ? "translate-x-full" : "-translate-x-full"}
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-200"
              leaveFrom="translate-x-0"
              leaveTo={right ? "translate-x-full" : "-translate-x-full"}
            >
              <DialogPanel
                data-testid={dataTestId}
                className={clx(
                  "flex h-full w-screen max-w-[440px] flex-col bg-canvas text-ink shadow-pop",
                  className
                )}
              >
                <div className="flex items-center justify-between px-5 pb-3 pt-5">
                  <DialogTitle className="font-display text-2xl font-extrabold">
                    {title}
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    data-testid={`${dataTestId}-close`}
                    className="grid h-9 w-9 place-items-center rounded-circle bg-card shadow-lift"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 pb-5">
                  {children}
                </div>
                {footer && (
                  <div className="border-t border-line bg-card px-5 py-4">
                    {footer}
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default Drawer
