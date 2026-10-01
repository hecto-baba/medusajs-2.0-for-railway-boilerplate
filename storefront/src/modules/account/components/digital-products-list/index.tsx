"use client"

import { Table } from "@medusajs/ui"
import { DigitalProduct } from "../../../../types/global"
import { getDigitalMediaDownloadLink } from "../../../../lib/data/digital-products"

type Props = {
  digitalProducts: DigitalProduct[]
}

export const DigitalProductsList = ({
  digitalProducts,
}: Props) => {
  const handleDownload = async (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    mediaId: string
  ) => {
    e.preventDefault()

    try {
      const url = await getDigitalMediaDownloadLink(mediaId)
      if (url) {
        window.open(url, "_blank")
      }
    } catch (err) {
      console.error("Error downloading digital media:", err)
    }
  }

  if (!digitalProducts || digitalProducts.length === 0) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-base-regular text-ui-fg-subtle">
          You haven&apos;t purchased any digital products yet.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Action</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {digitalProducts.map((digitalProduct) => {
          const medias = digitalProduct.medias?.filter((media) => media.type === "main")
          const showMediaCount = (medias?.length || 0) > 1
          return (
            <Table.Row key={digitalProduct.id}>
              <Table.Cell>
                <span className="font-semibold">{digitalProduct.name}</span>
              </Table.Cell>
              <Table.Cell>
                <ul className="flex flex-col gap-y-1">
                  {medias && medias.length > 0 ? (
                    medias.map((media, index) => (
                      <li key={media.id}>
                        <a
                          href="#"
                          onClick={(e) => handleDownload(e, media.id)}
                          className="text-ui-fg-interactive hover:underline"
                        >
                          Download{showMediaCount ? ` ${index + 1}` : ``}
                        </a>
                      </li>
                    ))
                  ) : (
                    <span className="text-ui-fg-subtle text-sm">No files attached</span>
                  )}
                </ul>
              </Table.Cell>
            </Table.Row>
          )
        })}
      </Table.Body>
    </Table>
  )
}
