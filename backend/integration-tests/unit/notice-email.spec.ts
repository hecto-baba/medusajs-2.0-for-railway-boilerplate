import { generateEmailTemplate } from "../../src/modules/email-notifications/templates"
import {
  NOTICE_TEMPLATES,
  NoticeTemplate,
  isNoticeData,
} from "../../src/modules/email-notifications/templates/notice"
import { quoteEmailsFor } from "../../src/lib/quote-emails"
import { buildEoiNotice, eoiItemsOf } from "../../src/lib/eoi-email"

// Rendering to HTML needs `node --experimental-vm-modules`, which this suite does
// not run with; these cover registration, validation and the content builders.
describe("notice-style emails", () => {
  const data = NoticeTemplate.PreviewProps

  it("every notice template key is registered and renders", () => {
    for (const key of NOTICE_TEMPLATES) {
      expect(generateEmailTemplate(key, data)).toBeTruthy()
    }
  })

  it("rejects bad data with a clear error", () => {
    expect(() => generateEmailTemplate("refund-issued", { heading: "x" })).toThrow(/Invalid data/)
    expect(isNoticeData({ ...data, button: { label: "x" } })).toBe(false)
    expect(isNoticeData(data)).toBe(true)
  })

  it("still rejects an unknown template", () => {
    expect(() => generateEmailTemplate("nope", data)).toThrow(/Unknown template/)
  })
})

describe("quote emails by state", () => {
  const recipients = { buyer: "buyer@x.test", buyerName: "Sam", vendorEmails: ["v@x.test"] }
  const quote = (status: string, metadata: any = {}) => ({
    id: "quote_ABCDEFGH12345678",
    status,
    metadata,
    cart: { currency_code: "usd", items: [{ title: "Pipe", quantity: 3 }] },
  })
  const who = (mails: any[]) => mails.map((m) => `${m.template}:${m.to}`).sort()

  it("request: the vendor and a copy to the buyer", () => {
    expect(who(quoteEmailsFor(quote("pending_merchant"), recipients))).toEqual([
      "quote-requested:buyer@x.test",
      "quote-requested:v@x.test",
    ])
  })

  it("price sent: the buyer, with the negotiated total", () => {
    const mails = quoteEmailsFor(
      quote("pending_customer", { items_negotiated: [{ title: "Pipe", quantity: 3, unit_price: 10 }], admin_shipping_price: 5 }),
      recipients
    )
    expect(who(mails)).toEqual(["quote-sent:buyer@x.test"])
    expect(mails[0].notice.rows.find((r: any) => r.label === "Total").value).toBe("$35.00")
  })

  it("accepted: both sides, plus a status email for each milestone reached", () => {
    const mails = quoteEmailsFor(quote("accepted", { payment_status: "paid", fulfillment_status: "shipped" }), recipients)
    expect(who(mails)).toEqual([
      "quote-accepted:buyer@x.test",
      "quote-accepted:v@x.test",
      "quote-status-update:buyer@x.test",
      "quote-status-update:buyer@x.test",
    ])
    expect(mails.filter((m) => m.template === "quote-status-update").map((m) => m.keySuffix).sort()).toEqual(["paid", "shipped"])
  })

  it("rejections go to the other party only", () => {
    expect(who(quoteEmailsFor(quote("customer_rejected"), recipients))).toEqual(["quote-rejected:v@x.test"])
    expect(who(quoteEmailsFor(quote("merchant_rejected"), recipients))).toEqual(["quote-rejected:buyer@x.test"])
  })

  it("a guest quote with no buyer address emails the vendor only", () => {
    expect(who(quoteEmailsFor(quote("accepted"), { ...recipients, buyer: null }))).toEqual(["quote-accepted:v@x.test"])
  })

  it("every email it builds is valid notice data", () => {
    for (const status of ["pending_merchant", "pending_customer", "accepted", "customer_rejected", "merchant_rejected"]) {
      for (const mail of quoteEmailsFor(quote(status), recipients)) {
        expect(isNoticeData(mail.notice)).toBe(true)
      }
    }
  })
})

describe("EOI reservation email", () => {
  const order = {
    id: "order_1",
    display_id: 7,
    currency_code: "usd",
    items: [
      { title: "Villa", quantity: 1, unit_price: 100, metadata: { is_eoi: true, eoi_charged_amount: 100, eoi_remaining_amount: 900 } },
      { title: "Mug", quantity: 1, unit_price: 5, metadata: {} },
    ],
  }

  it("picks out only the reservation lines", () => {
    expect(eoiItemsOf(order).map((i) => i.title)).toEqual(["Villa"])
  })

  it("states the deposit and the uncharged balance, and promises no payment link", () => {
    const notice = buildEoiNotice(order, eoiItemsOf(order))
    expect(isNoticeData(notice)).toBe(true)
    const text = JSON.stringify(notice)
    expect(text).toContain("$100.00")
    expect(text).toContain("$900.00")
    expect(text).toContain("not been charged")
    expect(notice.button).toBeUndefined()
  })
})
