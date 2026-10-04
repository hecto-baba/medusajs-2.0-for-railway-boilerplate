"use client"

import { Disclosure } from "@headlessui/react"
import { Button, clx } from "@medusajs/ui"
import { useEffect } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { useFormStatus } from "react-dom"

type AccountInfoProps = {
  label: string
  currentInfo: string | React.ReactNode
  isSuccess?: boolean
  isError?: boolean
  errorMessage?: string
  clearState: () => void
  children?: React.ReactNode
  /**
   * Set to false for information the store API cannot change, so the section
   * renders read-only instead of offering an Edit button that leads nowhere.
   */
  isEditable?: boolean
  'data-testid'?: string
}

const AccountInfo = ({
  label,
  currentInfo,
  isSuccess,
  isError,
  clearState,
  errorMessage = "An error occurred, please try again",
  children,
  isEditable = true,
  'data-testid': dataTestid
}: AccountInfoProps) => {
  const { state, close, toggle } = useToggleState()

  const { pending } = useFormStatus()

  const handleToggle = () => {
    clearState()
    setTimeout(() => toggle(), 100)
  }

  useEffect(() => {
    if (isSuccess) {
      close()
    }
  }, [isSuccess, close])

  return (
    <div className="text-sm" data-testid={dataTestid}>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
          <div className="flex items-center flex-1 basis-0 justify-end gap-x-4">
            {typeof currentInfo === "string" ? (
              <span className="font-bold text-ink" data-testid="current-info">{currentInfo}</span>
            ) : (
              currentInfo
            )}
          </div>
        </div>
        {isEditable && (
          <div>
            <Button
              variant="secondary"
              className="w-[100px] min-h-[25px] py-1 !rounded-large !border-[1.5px] !border-brand !bg-card !font-bold !text-brand !shadow-none hover:!bg-brand-soft"
              onClick={handleToggle}
              type={state ? "reset" : "button"}
              data-testid="edit-button"
              data-active={state}
            >
              {state ? "Cancel" : "Edit"}
            </Button>
          </div>
        )}
      </div>

      {/* Success state */}
      <Disclosure>
        <Disclosure.Panel
          static
          className={clx(
            "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
            {
              "max-h-[1000px] opacity-100": isSuccess,
              "max-h-0 opacity-0": !isSuccess,
            }
          )}
          data-testid="success-message"
        >
          <div className="my-4 inline-flex rounded-rounded bg-success-soft px-3 py-2 font-bold text-success">
            <span>{label} updated succesfully</span>
          </div>
        </Disclosure.Panel>
      </Disclosure>

      {/* Error state  */}
      <Disclosure>
        <Disclosure.Panel
          static
          className={clx(
            "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
            {
              "max-h-[1000px] opacity-100": isError,
              "max-h-0 opacity-0": !isError,
            }
          )}
          data-testid="error-message"
        >
          <div className="my-4 inline-flex rounded-rounded bg-brand-soft px-3 py-2 font-bold text-brand">
            <span>{errorMessage}</span>
          </div>
        </Disclosure.Panel>
      </Disclosure>

      {isEditable && (
        <Disclosure>
          {/* The collapsed panel used to be overflow-visible, so its inputs
              kept a real bounding box: they stayed in the tab order, were
              announced by screen readers and could still be clicked despite
              being invisible. overflow-visible is only needed while the panel
              is open, so that dropdowns inside the form can escape the box. */}
          <Disclosure.Panel
            static
            className={clx(
              "transition-[max-height,opacity] duration-300 ease-in-out",
              {
                "max-h-[1000px] opacity-100 overflow-visible": state,
                "max-h-0 opacity-0 invisible overflow-hidden": !state,
              }
            )}
          >
            <div className="flex flex-col gap-y-2 py-4">
              <div>{children}</div>
              <div className="flex items-center justify-end mt-2">
                <Button
                  isLoading={pending}
                  className="w-full small:max-w-[140px] !rounded-large !border-0 !bg-brand !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90"
                  type="submit"
                  data-testid="save-button"
                >
                  Save changes
                </Button>
              </div>
            </div>
          </Disclosure.Panel>
        </Disclosure>
      )}
    </div>
  )
}

export default AccountInfo
