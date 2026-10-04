const Radio = ({ checked, 'data-testid': dataTestId }: { checked: boolean, 'data-testid'?: string }) => {
  return (
    <>
      <button
        type="button"
        role="radio"
        aria-checked="true"
        data-state={checked ? "checked" : "unchecked"}
        className="group relative flex h-5 w-5 items-center justify-center outline-none"
        data-testid={dataTestId || 'radio-button'}
      >
        <div className="flex h-[16px] w-[16px] items-center justify-center rounded-circle border-[1.5px] border-line bg-card transition-all group-hover:border-brand group-data-[state=checked]:border-brand group-data-[state=checked]:bg-brand group-focus-visible:ring-2 group-focus-visible:ring-brand/40">
          {checked && (
            <span
              data-state={checked ? "checked" : "unchecked"}
              className="group flex items-center justify-center"
            >
              <div className="h-1.5 w-1.5 rounded-circle bg-brand-ink"></div>
            </span>
          )}
        </div>
      </button>
    </>
  )
}

export default Radio
