"use client"

import type { VendorAdmin } from "@lib/data/vendor"
import { languages } from "@i18n/languages"
import { PencilSquare } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { ActionMenu, SectionRow } from "@modules/common"
import { useTranslation } from "react-i18next"

/**
 * The Profile section, laid out like the dashboard's ProfileGeneralSection:
 * a Container with a header row carrying the edit action, then one SectionRow
 * per field.
 */
export const ProfileGeneralSection = ({ admin }: { admin: VendorAdmin }) => {
  const { i18n } = useTranslation()
  const name = [admin.first_name, admin.last_name].filter(Boolean).join(" ")
  const currentLanguage = languages.find(
    (language) => language.code === i18n.language
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Profile</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage your profile details
          </Text>
        </div>
        <ActionMenu
          groups={[
            {
              actions: [
                {
                  label: "Edit",
                  to: "/settings/profile/edit",
                  icon: <PencilSquare />,
                },
              ],
            },
          ]}
        />
      </div>
      <SectionRow title="Name" value={name || "-"} />
      <SectionRow title="Email" value={admin.email} />
      <SectionRow title="Language" value={currentLanguage?.display_name ?? "-"} />
    </Container>
  )
}
