import { Validator } from '@tetherto/pear-apps-utils-validator'

export const fileSchema = Validator.object({
  id: Validator.string().required(),
  name: Validator.string().required()
})
