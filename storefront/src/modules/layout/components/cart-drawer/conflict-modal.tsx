"use client"

import Modal from "@modules/common/components/modal"

const ConflictModal = ({
  message,
  isOpen,
  onKeep,
  onReplace,
}: {
  message?: string
  isOpen: boolean
  onKeep: () => void
  onReplace: () => void
}) => (
  <Modal
    isOpen={isOpen}
    close={onKeep}
    size="small"
    data-testid="cart-conflict-modal"
  >
    <Modal.Title>Start a new order?</Modal.Title>
    <Modal.Description>{message}</Modal.Description>
    <Modal.Footer>
      <button
        type="button"
        onClick={onKeep}
        className="rounded-rounded border border-line bg-card px-4 py-2 text-sm font-bold"
        data-testid="cart-conflict-keep"
      >
        Keep my cart
      </button>
      <button
        type="button"
        onClick={onReplace}
        className="rounded-rounded bg-brand px-4 py-2 text-sm font-bold text-brand-ink"
        data-testid="cart-conflict-replace"
      >
        Start new order
      </button>
    </Modal.Footer>
  </Modal>
)

export default ConflictModal
