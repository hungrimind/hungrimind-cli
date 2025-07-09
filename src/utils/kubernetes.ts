import {ux} from '@oclif/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import inquirer from 'inquirer'
import * as childProcess from 'child_process'

// Required placeholders that must be filled before deployment
export const REQUIRED_PLACEHOLDERS = ['metal-lb-server-ip', 'cert-staging-email', 'cert-prod-email']

// Helper method to recursively get all files in a directory
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dirPath, {withFileTypes: true})

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      // Skip common directories to avoid processing unnecessary files
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') {
        continue
      }
      await getAllFiles(fullPath, arrayOfFiles)
    } else if (entry.isFile()) {
      // Filter for YAML files with "values" in their name
      const fileName = entry.name.toLowerCase()
      if (fileName.includes('values') && (fileName.endsWith('.yaml') || fileName.endsWith('.yml'))) {
        arrayOfFiles.push(fullPath)
      }
    }
  }
  return arrayOfFiles
}

// Helper method to get line number and line content for a character index
function getLineContext(content: string, charIndex: number): {lineNumber: number; line: string} {
  let lineNumber = 1
  let lineStartIndex = 0
  for (let i = 0; i < charIndex; i++) {
    if (content[i] === '\n') {
      lineNumber++
      lineStartIndex = i + 1
    }
  }
  const lineEndIndex = content.indexOf('\n', lineStartIndex)
  const line = content.substring(lineStartIndex, lineEndIndex === -1 ? content.length : lineEndIndex)
  return {lineNumber, line}
}

// Method to validate if all required placeholders are filled in a project
export async function validateRequiredPlaceholders(
  command: {log: (message?: string) => void; warn: (input: string | Error) => void},
  projectDirName: string,
): Promise<{isValid: boolean; missingPlaceholders: string[]}> {
  const projectFullPath = path.resolve(projectDirName)
  const placeholderRegex = /{{\s*([^}]+?)\s*}}/g
  const allFiles = await getAllFiles(projectFullPath)
  const foundPlaceholders = new Set<string>()

  for (const filePath of allFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      let match
      placeholderRegex.lastIndex = 0

      while ((match = placeholderRegex.exec(content)) !== null) {
        const placeholderName = match[1].trim()
        foundPlaceholders.add(placeholderName)
      }
    } catch (error) {
      // Skip files that can't be read
      continue
    }
  }

  const stillNeededPlaceholders = REQUIRED_PLACEHOLDERS.filter((required) => foundPlaceholders.has(required))

  return {
    isValid: stillNeededPlaceholders.length === 0,
    missingPlaceholders: stillNeededPlaceholders,
  }
}

// Method to prompt for required placeholders only (blocking until all are filled)
export async function promptForRequiredPlaceholders(
  command: {log: (message?: string) => void; warn: (input: string | Error) => void},
  projectDirName: string,
): Promise<void> {
  const validation = await validateRequiredPlaceholders(command, projectDirName)

  if (validation.isValid) {
    command.log(ux.colorize('green', '✔ All required placeholders are configured.'))
    return
  }

  command.log(ux.colorize('yellow', '\n⚠ Required placeholders must be configured before proceeding.'))
  command.log(`Missing required placeholders: ${validation.missingPlaceholders.join(', ')}`)

  await promptForPlaceholderReplacements(command, projectDirName, 'required-only')

  // Validate again to ensure all required placeholders are now filled
  const revalidation = await validateRequiredPlaceholders(command, projectDirName)
  if (!revalidation.isValid) {
    throw new Error(`Required placeholders still missing: ${revalidation.missingPlaceholders.join(', ')}`)
  }
}

// Method to prompt for placeholder replacements
export async function promptForPlaceholderReplacements(
  command: {log: (message?: string) => void; warn: (input: string | Error) => void},
  projectDirName: string,
  mode: 'all' | 'required-only' = 'all',
): Promise<void> {
  const projectFullPath = path.resolve(projectDirName)
  const modeText = mode === 'required-only' ? 'required' : 'all'
  command.log(
    ux.colorize(
      'blue',
      `\nScanning for ${modeText} '{{...}}' placeholders in 'values' YAML files within '${projectDirName}'...`,
    ),
  )

  const placeholderRegex = /{{\s*([^}]+?)\s*}}/g // Regex to find {{ placeholder }}
  const allFiles = await getAllFiles(projectFullPath)
  let anyPlaceholdersFoundInAnyFile = false

  for (const filePath of allFiles) {
    try {
      const originalContent = await fs.readFile(filePath, 'utf8')
      let currentFileContent = originalContent
      let newFileContentParts: string[] = []
      let lastIndexProcessed = 0
      let madeChangesToFile = false
      let instanceInFile = 0
      let match

      // Check if the file initially contains any placeholders to avoid unnecessary processing
      if (!placeholderRegex.test(currentFileContent)) {
        // Reset regex for next file if test() was used
        placeholderRegex.lastIndex = 0
        continue
      }
      // Ensure regex is reset before exec loop for current file
      placeholderRegex.lastIndex = 0

      const relativeFilePath = path.relative(projectFullPath, filePath)
      let hasRelevantPlaceholders = false

      // First pass: check if this file has placeholders we care about
      while ((match = placeholderRegex.exec(currentFileContent)) !== null) {
        const placeholderName = match[1].trim()
        if (mode === 'all' || REQUIRED_PLACEHOLDERS.includes(placeholderName)) {
          hasRelevantPlaceholders = true
          break
        }
      }

      if (!hasRelevantPlaceholders) {
        continue
      }

      command.log(ux.colorize('magenta', `\nProcessing file: ${relativeFilePath}`))
      placeholderRegex.lastIndex = 0 // Reset for actual processing

      while ((match = placeholderRegex.exec(currentFileContent)) !== null) {
        const placeholderName = match[1].trim()

        // Skip if we're in required-only mode and this isn't a required placeholder
        if (mode === 'required-only' && !REQUIRED_PLACEHOLDERS.includes(placeholderName)) {
          continue
        }

        anyPlaceholdersFoundInAnyFile = true
        instanceInFile++

        const fullMatch = match[0] // e.g., "{{ some_value }}"
        const placeholderIndex = match.index

        newFileContentParts.push(currentFileContent.substring(lastIndexProcessed, placeholderIndex))

        const {line} = getLineContext(currentFileContent, placeholderIndex)
        command.log(`File: ${ux.colorize('cyan', relativeFilePath)}`)
        command.log(line.trim()) // Log the content of the line

        const isRequired = REQUIRED_PLACEHOLDERS.includes(placeholderName)
        const promptMessage =
          mode === 'required-only' || isRequired
            ? `Replace '${fullMatch}' with (required):`
            : `Replace '${fullMatch}' with (leave empty to skip):`

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'replacement',
            message: promptMessage,
            default: '',
            validate: (input: string) => {
              if ((mode === 'required-only' || isRequired) && (!input || input.trim() === '')) {
                return 'This placeholder is required and cannot be empty.'
              }
              return true
            },
          },
        ])
        const userInput = answers.replacement

        if (userInput && userInput.trim() !== '') {
          newFileContentParts.push(userInput.trim())
          madeChangesToFile = true
          command.log(ux.colorize('green', `  Replaced with: "${userInput.trim()}"`))
        } else {
          newFileContentParts.push(fullMatch) // Keep original placeholder
          command.log(ux.colorize('dim', `  Skipped.`))
        }
        lastIndexProcessed = placeholderIndex + fullMatch.length
      }

      if (lastIndexProcessed < currentFileContent.length) {
        newFileContentParts.push(currentFileContent.substring(lastIndexProcessed))
      }

      if (madeChangesToFile) {
        const finalContent = newFileContentParts.join('')
        await fs.writeFile(filePath, finalContent, 'utf8')
        command.log(ux.colorize('green', `✔ Updated file: ${relativeFilePath}`))
      } else if (instanceInFile > 0) {
        // Had placeholders but none were changed
        command.log(ux.colorize('dim', `No changes made to: ${relativeFilePath} (all placeholders skipped)`))
      }
    } catch (error) {
      // Log error for specific file and continue with others
      command.warn(
        `Could not process file ${filePath} for placeholders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      if (error instanceof Error && (error.message.includes('EISDIR') || error.message.includes('EINVAL'))) {
        command.log(ux.colorize('dim', `Skipping likely binary or problematic file: ${filePath}`))
      }
    }
  }

  if (!anyPlaceholdersFoundInAnyFile) {
    command.log(`No ${modeText} '{{...}}' placeholders found in any 'values' YAML files within '${projectDirName}'.`)
  } else {
    command.log(
      ux.colorize(
        'green',
        `\n✔ ${
          modeText.charAt(0).toUpperCase() + modeText.slice(1)
        } placeholder update process complete for '${projectDirName}'.`,
      ),
    )
  }
}

// Method to prompt and execute first_install.sh script
export async function promptAndRunFirstInstall(
  command: {log: (message?: string) => void; warn: (input: string | Error) => void},
  projectDirName: string,
): Promise<void> {
  const firstInstallScriptPath = path.join(projectDirName, 'first_install.sh')

  try {
    await fs.access(firstInstallScriptPath, fs.constants.F_OK) // Check if script exists

    command.log(ux.colorize('yellow', '\n--- Next Step ---'))
    const {runScript} = await inquirer.prompt([
      {
        name: 'runScript',
        type: 'confirm',
        message: `You have now cloned all the Kubernetes Kit files. This includes ‘first_install.sh’ which will deploy the preconfigured applications to your cluster. Do you want to run it? (You can also run it later with ‘hungrimind kubernetes install‘)`,
        default: true,
      },
    ])

    if (runScript) {
      command.log(ux.colorize('blue', `\nRunning 'first_install.sh'...\n`))

      try {
        // Ensure the script is executable
        await fs.chmod(firstInstallScriptPath, 0o755)

        // Use execSync for simpler execution with real-time output
        childProcess.execSync('./first_install.sh', {
          cwd: path.resolve(projectDirName),
          stdio: 'inherit',
        })

        command.log(ux.colorize('green', `\n✔ 'first_install.sh' executed successfully!`))
      } catch (scriptError: any) {
        command.warn(
          ux.colorize('red', `\n✖ 'first_install.sh' failed with exit code ${scriptError.status || 'unknown'}.`),
        )
        command.log(ux.colorize('dim', `You may need to run it manually: cd ${projectDirName} && ./first_install.sh`))
      }
    } else {
      command.log(
        ux.colorize(
          'dim',
          `Skipped execution of 'first_install.sh'. You can run it later from the '${projectDirName}' directory.`,
        ),
      )
    }
  } catch (error) {
    // fs.access throws if file doesn't exist - this is fine, just means no script to run.
    command.log(ux.colorize('dim', `No 'first_install.sh' script found in '${projectDirName}', skipping this step.`))
  }
}
