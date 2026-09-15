"use client"

import {
  Badge,
  Button,
  clx,
  DropdownMenu,
  IconButton,
  Kbd,
  Text,
} from "@medusajs/ui"
import { Command } from "cmdk"
import { Dialog as RadixDialog } from "radix-ui"
import {
  Children,
  ComponentPropsWithoutRef,
  ElementRef,
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  ArrowUturnLeft,
  MagnifyingGlass,
  Plus,
  Spinner,
  TriangleDownMini,
} from "@medusajs/icons"
import { matchSorter } from "match-sorter"

import { useSearch } from "./use-search"
import { Thumbnail } from "./thumbnail"
import {
  DEFAULT_SEARCH_LIMIT,
  SEARCH_AREAS,
  SEARCH_AREA_LABELS,
  SEARCH_LIMIT_INCREMENT,
} from "./constants"
import { SearchArea } from "./types"
import { useSearchResults } from "./use-search-results"

export const Search = () => {
  const [area, setArea] = useState<SearchArea>("all")
  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(DEFAULT_SEARCH_LIMIT)
  const { open, onOpenChange } = useSearch()
  const pathname = usePathname()
  const router = useRouter()

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { staticResults, dynamicResults, isFetching } = useSearchResults({
    area,
    limit,
    q: search,
  })

  const handleReset = useCallback(() => {
    setArea("all")
    setSearch("")
    setLimit(DEFAULT_SEARCH_LIMIT)
  }, [setLimit])

  const handleBack = () => {
    handleReset()
    inputRef.current?.focus()
  }

  const handleOpenChange = useCallback(
    (openState: boolean) => {
      if (!openState) {
        handleReset()
      }

      onOpenChange(openState)
    },
    [onOpenChange, handleReset]
  )

  useEffect(() => {
    handleOpenChange(false)
  }, [pathname, handleOpenChange])

  const handleSelect = (item: { to?: string; callback?: () => void }) => {
    handleOpenChange(false)

    if (item.to) {
      router.push(item.to)
      return
    }

    if (item.callback) {
      item.callback()
      return
    }
  }

  const handleShowMore = (selectedArea: SearchArea) => {
    if (selectedArea === "all") {
      setLimit(DEFAULT_SEARCH_LIMIT)
    } else {
      setLimit(SEARCH_LIMIT_INCREMENT)
    }
    setArea(selectedArea)
    inputRef.current?.focus()
  }

  const handleLoadMore = () => {
    setLimit((l) => l + SEARCH_LIMIT_INCREMENT)
  }

  const filteredStaticResults = useMemo(() => {
    const filteredResults: typeof staticResults = []

    staticResults.forEach((group) => {
      const filteredItems = matchSorter(group.items, search, {
        keys: ["label"],
      })

      if (filteredItems.length === 0) {
        return
      }

      filteredResults.push({
        ...group,
        items: filteredItems,
      })
    })

    return filteredResults
  }, [staticResults, search])

  const handleSearch = (q: string) => {
    setSearch(q)
    listRef.current?.scrollTo({ top: 0 })
  }

  const showLoading = useMemo(() => {
    return isFetching && !dynamicResults.length && !filteredStaticResults.length
  }, [isFetching, dynamicResults, filteredStaticResults])

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        isFetching={isFetching}
        ref={inputRef}
        area={area}
        setArea={setArea}
        value={search}
        onValueChange={handleSearch}
        onBack={area !== "all" ? handleBack : undefined}
        placeholder="Jump to or find anything..."
      />
      <CommandList ref={listRef}>
        {showLoading && <CommandLoading />}
        {dynamicResults.map((group) => {
          return (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((item) => {
                return (
                  <CommandItem
                    key={item.id}
                    onSelect={() => handleSelect(item)}
                    value={item.value}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-x-3 truncate">
                      {item.thumbnail && (
                        <Thumbnail
                          alt={item.title}
                          src={item.thumbnail}
                          size="small"
                        />
                      )}
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-ui-fg-muted truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
              {group.hasMore && area === "all" && (
                <CommandItem
                  onSelect={() => handleShowMore(group.area)}
                  value={`${group.title}:show:more`}
                >
                  <div className="text-ui-fg-muted flex items-center gap-x-3">
                    <Plus />
                    <Text size="small" leading="compact" weight="plus">
                      Show more
                    </Text>
                  </div>
                </CommandItem>
              )}
              {group.hasMore && area === group.area && (
                <CommandItem
                  onSelect={handleLoadMore}
                  value={`${group.title}:load:more`}
                >
                  <div className="text-ui-fg-muted flex items-center gap-x-3">
                    <Plus />
                    <Text size="small" leading="compact" weight="plus">
                      Load {Math.min(SEARCH_LIMIT_INCREMENT, group.count - limit)} more
                    </Text>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          )
        })}
        {filteredStaticResults.map((group) => {
          return (
            <CommandGroup key={group.title} heading={group.heading}>
              {group.items.map((item) => {
                return (
                  <CommandItem
                    key={item.label}
                    onSelect={() => handleSelect(item)}
                    value={`shortcut:${item.label}`}
                    className="flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <div className="flex items-center gap-x-1.5">
                      {item.keys.Mac?.map((key, index) => {
                        return (
                          <div
                            className="flex items-center gap-x-1"
                            key={index}
                          >
                            <Kbd>{key}</Kbd>
                            {index < (item.keys.Mac?.length || 0) - 1 && (
                              <span className="txt-compact-xsmall text-ui-fg-subtle">
                                then
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )
        })}
        {!showLoading && <CommandEmpty q={search} />}
      </CommandList>
    </CommandDialog>
  )
}

const CommandPalette = forwardRef<
  ElementRef<typeof Command>,
  ComponentPropsWithoutRef<typeof Command>
>(({ className, ...props }, ref) => (
  <Command
    shouldFilter={false}
    ref={ref}
    className={clx(
      "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
      className
    )}
    {...props}
  />
))
CommandPalette.displayName = Command.displayName

interface CommandDialogProps extends RadixDialog.DialogProps {
  isLoading?: boolean
}

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  const preserveHeight = useMemo(() => {
    return props.isLoading && Children.count(children) === 0
  }, [props.isLoading, children])

  return (
    <RadixDialog.Root {...props}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-ui-bg-overlay fixed inset-0 z-50" />
        <RadixDialog.Content
          className={clx(
            "bg-ui-bg-base shadow-elevation-modal fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100%-16px)] w-[calc(100%-16px)] min-w-0 max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-xl p-0",
            {
              "h-[300px]": preserveHeight,
            }
          )}
        >
          <RadixDialog.Title className="sr-only">
            Search
          </RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Search your entire store, including orders, products, customers, and more.
          </RadixDialog.Description>
          <CommandPalette className="[&_[cmdk-group-heading]]:text-muted-foreground flex h-full flex-col overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0">
            {children}
          </CommandPalette>
          <div className="bg-ui-bg-field text-ui-fg-subtle flex items-center justify-end border-t px-4 py-3">
            <div className="flex items-center gap-x-3">
              <div className="flex items-center gap-x-2">
                <Text size="xsmall" leading="compact">
                  Navigation
                </Text>
                <div className="flex items-center gap-x-1">
                  <Kbd className="bg-ui-bg-field-component">↓</Kbd>
                  <Kbd className="bg-ui-bg-field-component">↑</Kbd>
                </div>
              </div>
              <div className="bg-ui-border-strong h-3 w-px" />
              <div className="flex items-center gap-x-2">
                <Text size="xsmall" leading="compact">
                  Open result
                </Text>
                <Kbd className="bg-ui-bg-field-component">↵</Kbd>
              </div>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

const CommandInput = forwardRef<
  ElementRef<typeof Command.Input>,
  ComponentPropsWithoutRef<typeof Command.Input> & {
    area: SearchArea
    setArea: (area: SearchArea) => void
    isFetching: boolean
    onBack?: () => void
  }
>(
  (
    {
      className,
      value,
      onValueChange,
      area,
      setArea,
      isFetching,
      onBack,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLInputElement>(null)
    useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
      ref,
      () => innerRef.current
    )

    return (
      <div className="flex flex-col border-b">
        <div className="px-4 pt-4">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Badge
                size="2xsmall"
                className="hover:bg-ui-bg-base-pressed transition-fg cursor-pointer select-none"
              >
                {SEARCH_AREA_LABELS[area] || area}
                <TriangleDownMini className="text-ui-fg-muted" />
              </Badge>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              align="start"
              className="h-full max-h-[360px] overflow-auto z-50"
              onCloseAutoFocus={(e) => {
                e.preventDefault()
                innerRef.current?.focus()
              }}
            >
              <DropdownMenu.RadioGroup
                value={area}
                onValueChange={(v) => setArea(v as SearchArea)}
              >
                {SEARCH_AREAS.map((a) => (
                  <Fragment key={a}>
                    {a === "command" && <DropdownMenu.Separator />}
                    <DropdownMenu.RadioItem value={a}>
                      {SEARCH_AREA_LABELS[a] || a}
                    </DropdownMenu.RadioItem>
                    {a === "all" && <DropdownMenu.Separator />}
                  </Fragment>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
        <div className="relative flex items-center gap-x-2 px-4 py-3">
          {onBack && (
            <IconButton
              type="button"
              size="small"
              variant="transparent"
              onClick={onBack}
            >
              <ArrowUturnLeft className="text-ui-fg-muted" />
            </IconButton>
          )}
          <Command.Input
            ref={innerRef}
            value={value}
            onValueChange={onValueChange}
            className={clx(
              "placeholder:text-ui-fg-muted flex !h-6 w-full rounded-md bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
          <div className="absolute end-4 top-1/2 flex -translate-y-1/2 items-center justify-end gap-x-2">
            {isFetching && (
              <Spinner className="text-ui-fg-muted animate-spin" />
            )}
            {value && (
              <Button
                variant="transparent"
                size="small"
                className="text-ui-fg-muted hover:text-ui-fg-subtle"
                type="button"
                onClick={() => {
                  onValueChange?.("")
                  innerRef.current?.focus()
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }
)

CommandInput.displayName = Command.Input.displayName

const CommandList = forwardRef<
  ElementRef<typeof Command.List>,
  ComponentPropsWithoutRef<typeof Command.List>
>(({ className, ...props }, ref) => (
  <Command.List
    ref={ref}
    className={clx(
      "max-h-[300px] flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4",
      className
    )}
    {...props}
  />
))

CommandList.displayName = Command.List.displayName

const CommandEmpty = forwardRef<
  ElementRef<typeof Command.Empty>,
  Omit<ComponentPropsWithoutRef<typeof Command.Empty>, "children"> & {
    q?: string
  }
>((props, ref) => {
  return (
    <Command.Empty ref={ref} className="py-6 text-center text-sm" {...props}>
      <div className="text-ui-fg-subtle flex min-h-[236px] flex-col items-center justify-center gap-y-3">
        <MagnifyingGlass className="text-ui-fg-subtle" />
        <div className="flex flex-col items-center justify-center gap-y-1">
          <Text size="small" weight="plus" leading="compact">
            {props.q ? "No results found" : "Type to search"}
          </Text>
          <Text size="small" className="text-ui-fg-muted">
            {props.q
              ? "We couldn't find anything that matched your search."
              : "Enter a keyword or phrase to explore."}
          </Text>
        </div>
      </div>
    </Command.Empty>
  )
})

CommandEmpty.displayName = Command.Empty.displayName

const CommandLoading = forwardRef<
  ElementRef<typeof Command.Loading>,
  ComponentPropsWithoutRef<typeof Command.Loading>
>((props, ref) => {
  return (
    <Command.Loading
      ref={ref}
      {...props}
      className="bg-ui-bg-base flex flex-col"
    >
      <div className="w-full px-2 pb-1 pt-3">
        <div className="bg-ui-bg-component h-5 w-10 animate-pulse rounded-[4px]" />
      </div>
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="w-full p-2">
          <div className="bg-ui-bg-component h-5 w-full animate-pulse rounded-[4px]" />
        </div>
      ))}
    </Command.Loading>
  )
})
CommandLoading.displayName = Command.Loading.displayName

const CommandGroup = forwardRef<
  ElementRef<typeof Command.Group>,
  ComponentPropsWithoutRef<typeof Command.Group>
>(({ className, ...props }, ref) => (
  <Command.Group
    ref={ref}
    className={clx(
      "text-ui-fg-base [&_[cmdk-group-heading]]:text-ui-fg-muted [&_[cmdk-group-heading]]:txt-compact-xsmall-plus overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-item]]:py-2",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = Command.Group.displayName

const CommandItem = forwardRef<
  ElementRef<typeof Command.Item>,
  ComponentPropsWithoutRef<typeof Command.Item>
>(({ className, ...props }, ref) => (
  <Command.Item
    ref={ref}
    className={clx(
      "aria-selected:bg-ui-bg-base-hover focus-visible:bg-ui-bg-base-hover txt-compact-small [&>svg]:text-ui-fg-subtle relative flex cursor-pointer select-none items-center gap-x-3 rounded-md p-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = Command.Item.displayName
