"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { updateVendorMe, type VendorMe } from "@lib/data/vendor-client"
import { languages } from "@i18n/languages"
import { Button, Input, Select, toast } from "@medusajs/ui"
import { Form, KeyboundForm, RouteDrawer, useRouteModal } from "@modules/common"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import * as zod from "zod"

const EditProfileSchema = zod.object({
  first_name: zod.string().optional(),
  last_name: zod.string().optional(),
  language: zod.string(),
})

/**
 * Edit form for the Profile section, built the way the dashboard builds its
 * drawer forms: react-hook-form + zod behind a RouteDrawer, a mutation, and a
 * toast on either outcome.
 */
export const EditProfileForm = ({ admin }: { admin: VendorMe }) => {
  const { handleSuccess } = useRouteModal()
  const { i18n } = useTranslation()

  const form = useForm<zod.infer<typeof EditProfileSchema>>({
    defaultValues: {
      first_name: admin.first_name ?? "",
      last_name: admin.last_name ?? "",
      language: i18n.language,
    },
    resolver: zodResolver(EditProfileSchema),
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (values: zod.infer<typeof EditProfileSchema>) =>
      updateVendorMe({
        first_name: values.first_name,
        last_name: values.last_name,
      }),
  })

  const changeLanguage = async (code: string) => {
    await i18n.changeLanguage(code)

    try {
      window.localStorage.setItem("lng", code)
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await mutateAsync(values)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your profile."
      )
      return
    }

    await changeLanguage(values.language)

    toast.success("Profile updated")
    handleSuccess()
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit profile</RouteDrawer.Title>
          <RouteDrawer.Description>
            Manage your profile details
          </RouteDrawer.Description>
        </RouteDrawer.Header>

        <RouteDrawer.Body>
          <div className="flex flex-col gap-y-8">
            <div className="grid grid-cols-2 gap-4">
              <Form.Field
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <Form.Item>
                    <Form.Label>First name</Form.Label>
                    <Form.Control>
                      <Input {...field} />
                    </Form.Control>
                    <Form.ErrorMessage />
                  </Form.Item>
                )}
              />
              <Form.Field
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <Form.Item>
                    <Form.Label>Last name</Form.Label>
                    <Form.Control>
                      <Input {...field} />
                    </Form.Control>
                    <Form.ErrorMessage />
                  </Form.Item>
                )}
              />
            </div>

            <Form.Item>
              <Form.Label>Email</Form.Label>
              <Input value={admin.email} disabled />
              <Form.Hint>
                Your email signs you in, so it cannot be changed here.
              </Form.Hint>
            </Form.Item>

            <Form.Field
              control={form.control}
              name="language"
              render={({ field: { ref, ...field } }) => (
                <Form.Item className="gap-y-4">
                  <div>
                    <Form.Label>Language</Form.Label>
                    <Form.Hint>
                      This only changes the language of the vendor panel.
                    </Form.Hint>
                  </div>
                  <div>
                    <Form.Control>
                      <Select {...field} onValueChange={field.onChange}>
                        <Select.Trigger ref={ref} className="py-1 text-[13px]">
                          <Select.Value placeholder="Select language">
                            {
                              languages.find(
                                (language) => language.code === field.value
                              )?.display_name
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Content>
                          {languages.map((language) => (
                            <Select.Item key={language.code} value={language.code}>
                              {language.display_name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Form.Control>
                    <Form.ErrorMessage />
                  </div>
                </Form.Item>
              )}
            />
          </div>
        </RouteDrawer.Body>

        <RouteDrawer.Footer>
          <div className="flex items-center gap-x-2">
            <RouteDrawer.Close asChild>
              <Button size="small" variant="secondary">
                Cancel
              </Button>
            </RouteDrawer.Close>
            <Button size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </div>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
