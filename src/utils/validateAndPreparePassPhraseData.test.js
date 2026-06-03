import { validateAndPrepareCustomFields } from './validateAndPrepareCustomFields'
import { validateAndPreparePassPhraseData } from './validateAndPreparePassPhraseData'

jest.mock('./validateAndPrepareCustomFields', () => ({
  validateAndPrepareCustomFields: jest.fn((fields) => fields || [])
}))

describe('validateAndPreparePassPhraseData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should validate and prepare valid pass phrase data', () => {
    const passPhraseData = {
      title: 'My Passphrase',
      passPhrase: 'correct horse battery staple',
      note: 'This is my secure passphrase',
      customFields: [{ name: 'Category', value: 'Security', type: 'text' }]
    }

    validateAndPrepareCustomFields.mockReturnValue([
      { name: 'Category', value: 'Security', type: 'text' }
    ])

    const result = validateAndPreparePassPhraseData(passPhraseData)

    expect(validateAndPrepareCustomFields).toHaveBeenCalledWith([
      { name: 'Category', value: 'Security', type: 'text' }
    ])
    expect(result).toEqual({
      title: 'My Passphrase',
      passPhrase: 'correct horse battery staple',
      note: 'This is my secure passphrase',
      customFields: [{ name: 'Category', value: 'Security', type: 'text' }],
      attachments: undefined
    })
  })

  test('should handle missing optional fields', () => {
    const passPhraseData = {
      title: 'Basic Passphrase',
      passPhrase: 'simple passphrase'
    }

    validateAndPrepareCustomFields.mockReturnValue([])

    const result = validateAndPreparePassPhraseData(passPhraseData)

    expect(result).toEqual({
      title: 'Basic Passphrase',
      passPhrase: 'simple passphrase',
      note: undefined,
      customFields: [],
      attachments: undefined
    })
  })

  test('should handle null customFields', () => {
    const passPhraseData = {
      title: 'Passphrase',
      passPhrase: 'my passphrase',
      note: 'Passphrase description',
      customFields: null
    }

    validateAndPrepareCustomFields.mockReturnValue([])

    const result = validateAndPreparePassPhraseData(passPhraseData)

    expect(validateAndPrepareCustomFields).toHaveBeenCalledWith(null)
    expect(result).toEqual({
      title: 'Passphrase',
      passPhrase: 'my passphrase',
      note: 'Passphrase description',
      customFields: [],
      attachments: undefined
    })
  })

  test('should include attachments in result', () => {
    const attachments = [
      { id: 'file-1', name: 'photo.png' },
      { id: 'file-2', name: 'doc.pdf' }
    ]
    const passPhraseData = {
      title: 'My Passphrase',
      passPhrase: 'correct horse battery staple',
      attachments
    }

    validateAndPrepareCustomFields.mockReturnValue([])

    const result = validateAndPreparePassPhraseData(passPhraseData)

    expect(result.attachments).toEqual(attachments)
  })

  test('should be valid without attachments', () => {
    const passPhraseData = {
      title: 'My Passphrase',
      passPhrase: 'correct horse battery staple'
    }

    validateAndPrepareCustomFields.mockReturnValue([])

    expect(() =>
      validateAndPreparePassPhraseData(passPhraseData)
    ).not.toThrow()
  })

  test('should throw error for missing required title', () => {
    const passPhraseData = {
      passPhrase: 'my passphrase'
    }

    expect(() => validateAndPreparePassPhraseData(passPhraseData)).toThrow(
      'Invalid pass phrase data'
    )
  })

  test('should throw error for missing required passPhrase', () => {
    const passPhraseData = {
      title: 'My Passphrase'
    }

    expect(() => validateAndPreparePassPhraseData(passPhraseData)).toThrow(
      'Invalid pass phrase data'
    )
  })

  test('should throw error for invalid data type', () => {
    const passPhraseData = {
      title: 123, // Should be string
      passPhrase: 'my passphrase'
    }

    expect(() => validateAndPreparePassPhraseData(passPhraseData)).toThrow(
      'Invalid pass phrase data'
    )
  })

  test('should throw error for empty title', () => {
    const passPhraseData = {
      title: '',
      passPhrase: 'my passphrase'
    }

    expect(() => validateAndPreparePassPhraseData(passPhraseData)).toThrow(
      'Invalid pass phrase data'
    )
  })

  test('should throw error for empty passPhrase', () => {
    const passPhraseData = {
      title: 'My Passphrase',
      passPhrase: ''
    }

    expect(() => validateAndPreparePassPhraseData(passPhraseData)).toThrow(
      'Invalid pass phrase data'
    )
  })
})
