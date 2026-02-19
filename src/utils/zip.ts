import AdmZip from 'adm-zip'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import path from 'node:path'

/**
 * Extracts a ZIP response and renames the top-level folder to the given project name.
 * Used by kits that just need a simple extract-and-rename (e.g., Kubernetes).
 */
// eslint-disable-next-line n/no-unsupported-features/node-builtins
export async function extractAndRenameProject(projectName: string, zipResponse: Response): Promise<string> {
  const zipBuffer = await zipResponse.arrayBuffer()
  const targetPath = path.join(process.cwd(), projectName)

  const tempFile = path.join(os.tmpdir(), `kit-${Date.now()}.zip`)
  const tempDir = path.join(os.tmpdir(), `kit-temp-${Date.now()}`)

  try {
    await fs.writeFile(tempFile, Buffer.from(zipBuffer))
    await fs.mkdir(tempDir, {recursive: true})

    const zip = new AdmZip(tempFile)
    zip.extractAllTo(tempDir, true)

    const extractedFiles = await fs.readdir(tempDir, {withFileTypes: true})
    const extractedFolder = extractedFiles.find((file) => file.isDirectory())?.name

    if (!extractedFolder) {
      throw new Error('No top-level directory found in the extracted ZIP file')
    }

    const extractedPath = path.join(tempDir, extractedFolder)
    const targetDir = path.dirname(targetPath)
    if (extractedPath === targetDir) {
      throw new Error('Source and destination paths cannot be the same')
    }

    const renamedPath = path.join(targetDir, projectName)
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    await fs.cp(extractedPath, renamedPath, {recursive: true})
    await fs.rm(extractedPath, {force: true, recursive: true})

    return renamedPath
  } finally {
    await fs.unlink(tempFile).catch(() => {})
    await fs.rm(tempDir, {force: true, recursive: true}).catch(() => {})
  }
}
