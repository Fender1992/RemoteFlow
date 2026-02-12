import * as pdfParse from 'pdf-parse'
import * as mammoth from 'mammoth'

// Handle both CJS default and ESM named exports
const pdf = ('default' in pdfParse ? pdfParse.default : pdfParse) as (buffer: Buffer) => Promise<{ text: string }>

/**
 * Extract text from a PDF file buffer.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer)
  return data.text
}

/**
 * Extract text from a DOCX file buffer.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

/**
 * Extract text from a resume file based on its extension.
 */
export async function extractResumeText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'pdf':
      return extractTextFromPdf(buffer)
    case 'docx':
    case 'doc':
      return extractTextFromDocx(buffer)
    case 'txt':
      return buffer.toString('utf-8')
    default:
      throw new Error(`Unsupported file type: .${ext}`)
  }
}
