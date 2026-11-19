/* eslint-disable n/no-unsupported-features/node-builtins */
import {KIT_OWNER, KIT_REF} from '../config.js'

/**
 * Downloads a kit as a ZIP archive straight from its public GitHub repository.
 * GitHub wraps the archive in a single top-level folder, which the extract helpers expect.
 */
export async function downloadKit(repo: string, verbose = false, log: (message: string) => void = console.log): Promise<Response> {
  const url = `https://codeload.github.com/${KIT_OWNER}/${repo}/zip/refs/heads/${KIT_REF}`
  if (verbose) log(`Downloading ${url}`)

  const response = await fetch(url)
  if (verbose) log(`Response status: ${response.status}`)

  if (!response.ok) {
    throw new Error(`Failed to download ${KIT_OWNER}/${repo}: ${response.status} ${response.statusText}`)
  }

  return response
}
