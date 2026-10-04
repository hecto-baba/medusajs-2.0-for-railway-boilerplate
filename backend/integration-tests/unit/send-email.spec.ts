import { sendEmail, findSentBaseKeys } from "../../src/lib/send-email"

const input = {
  template: "order-cancelled",
  to: "buyer@example.com",
  subject: "Your order was cancelled",
  data: { order: { id: "order_1" } },
  idempotencyKey: "order-cancelled:order_1",
}

// `existing` is what the notification table already holds for this key.
const makeContainer = (createNotifications: jest.Mock, existing: any[] = []) => ({
  resolve: (key: string) => {
    if (key === "logger") return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    return { createNotifications, listNotifications: jest.fn().mockResolvedValue(existing) }
  },
})

describe("sendEmail", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  // Runs the call and fast-forwards the retry delays.
  const run = async (createNotifications: jest.Mock, existing: any[] = []) => {
    const promise = sendEmail(makeContainer(createNotifications, existing) as any, input)
    await jest.runAllTimersAsync()
    return promise
  }

  it("sends once with the idempotency key and subject", async () => {
    const create = jest.fn().mockResolvedValue([{ id: "noti_1" }])
    expect(await run(create)).toBe("sent")
    expect(create).toHaveBeenCalledTimes(1)
    const payload = create.mock.calls[0][0]
    expect(payload.idempotency_key).toBe("order-cancelled:order_1")
    expect(payload.data.emailOptions.subject).toBe("Your order was cancelled")
  })

  it("skips without sending when this email already succeeded", async () => {
    const create = jest.fn()
    expect(await run(create, [{ idempotency_key: "order-cancelled:order_1", status: "success" }])).toBe("skipped")
    expect(create).not.toHaveBeenCalled()
  })

  it("skips while another worker's send is still in flight, but not once it is stale", async () => {
    const create = jest.fn().mockResolvedValue([{ id: "noti_1" }])
    const fresh = { idempotency_key: "order-cancelled:order_1", status: "pending", created_at: new Date() }
    expect(await run(create, [fresh])).toBe("skipped")
    expect(create).not.toHaveBeenCalled()

    const stale = { ...fresh, created_at: new Date(Date.now() - 60 * 60 * 1000) }
    expect(await run(create, [stale])).toBe("sent")
    // The dead attempt's key is not reused.
    expect(create.mock.calls[0][0].idempotency_key).toBe("order-cancelled:order_1~1")
  })

  it("after a failed attempt, sends under a NEW key instead of reusing the failed one", async () => {
    const create = jest.fn().mockResolvedValue([{ id: "noti_2" }])
    const failed = [
      { idempotency_key: "order-cancelled:order_1", status: "failure" },
      { idempotency_key: "order-cancelled:order_1~1", status: "failure" },
    ]
    expect(await run(create, failed)).toBe("sent")
    expect(create.mock.calls[0][0].idempotency_key).toBe("order-cancelled:order_1~2")
  })

  it("gives up for good once every attempt key has failed", async () => {
    const create = jest.fn()
    const all = Array.from({ length: 8 }, (_, i) => ({
      idempotency_key: i === 0 ? "order-cancelled:order_1" : `order-cancelled:order_1~${i}`,
      status: "failure",
    }))
    expect(await run(create, all)).toBe("failed")
    expect(create).not.toHaveBeenCalled()
  })

  it("treats a unique-index collision as a duplicate, not a failure", async () => {
    const create = jest.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint "IDX_notification_idempotency_key_unique"'))
    expect(await run(create)).toBe("skipped")
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("retries a temporary ZeptoMail failure under fresh keys and then succeeds", async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error("ZeptoMail rejected the email: 503 Service Unavailable"))
      .mockRejectedValueOnce(new Error("Failed to reach ZeptoMail to send"))
      .mockResolvedValue([{ id: "noti_1" }])
    expect(await run(create)).toBe("sent")
    expect(create.mock.calls.map((c) => c[0].idempotency_key)).toEqual([
      "order-cancelled:order_1",
      "order-cancelled:order_1~1",
      "order-cancelled:order_1~2",
    ])
  })

  it("gives up after 3 attempts and does not throw", async () => {
    const create = jest.fn().mockRejectedValue(new Error("ZeptoMail rejected the email: 429 Too Many Requests"))
    expect(await run(create)).toBe("failed")
    expect(create).toHaveBeenCalledTimes(3)
  })

  it("does not retry an error that will not fix itself", async () => {
    const create = jest.fn().mockRejectedValue(new Error("ZeptoMail rejected the email: 422 Invalid address"))
    expect(await run(create)).toBe("failed")
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("does not throw when the lookup itself fails", async () => {
    const container = {
      resolve: (key: string) =>
        key === "logger"
          ? { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
          : { createNotifications: jest.fn(), listNotifications: jest.fn().mockRejectedValue(new Error("db down")) },
    }
    const promise = sendEmail(container as any, input)
    await jest.runAllTimersAsync()
    expect(await promise).toBe("failed")
  })

  it("does not throw when email is not configured", async () => {
    const container = {
      resolve: (key: string) => {
        if (key === "logger") return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
        throw new Error("not registered")
      },
    }
    expect(await sendEmail(container as any, input)).toBe("failed")
  })

  it("does not send without a recipient", async () => {
    const create = jest.fn()
    const promise = sendEmail(makeContainer(create) as any, { ...input, to: "" })
    await jest.runAllTimersAsync()
    expect(await promise).toBe("failed")
    expect(create).not.toHaveBeenCalled()
  })
})

describe("findSentBaseKeys", () => {
  it("returns base keys of successful sends, stripping the attempt suffix", async () => {
    const container = {
      resolve: () => ({
        listNotifications: jest.fn().mockResolvedValue([
          { idempotency_key: "quote-sent:q1:pending_customer:sent:a@x.test~2" },
          { idempotency_key: "quote-sent:q2:pending_customer:sent:a@x.test" },
        ]),
      }),
    }
    const done = await findSentBaseKeys(container as any, { resource_type: "quote", resource_ids: ["q1", "q2"] })
    expect([...done].sort()).toEqual([
      "quote-sent:q1:pending_customer:sent:a@x.test",
      "quote-sent:q2:pending_customer:sent:a@x.test",
    ])
  })

  it("returns nothing, without querying, when there are no resources", async () => {
    const list = jest.fn()
    const done = await findSentBaseKeys({ resolve: () => ({ listNotifications: list }) } as any, {
      resource_type: "quote",
      resource_ids: [],
    })
    expect(done.size).toBe(0)
    expect(list).not.toHaveBeenCalled()
  })
})
