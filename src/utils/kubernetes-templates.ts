import {Command, ux} from '@oclif/core'
import * as fs from 'node:fs/promises'
import path from 'node:path'

export interface AppConfig {
  appDescription: string
  appName: string
  devDomain: string
  dockerUsername: string
  prodDomain: string
}

export function validateAppName(input: string): string {
  // Kubernetes naming requirements: lowercase alphanumeric and hyphens, max 63 chars
  if (!/^[a-z]([a-z0-9-]*[a-z0-9])?$/.test(input)) {
    throw new Error('App name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens')
  }

  if (input.length > 63) {
    throw new Error('App name must be 63 characters or less')
  }

  return input
}

export async function promptForAppConfig(_command: Command): Promise<AppConfig> {
  const inquirer = await import('inquirer')

  const answers = await inquirer.default.prompt([
    {
      message: 'App name:',
      name: 'appName',
      type: 'input',
      validate(input: string) {
        try {
          validateAppName(input)
          return true
        } catch (error) {
          return (error as Error).message
        }
      },
    },
    {
      message: 'App description:',
      name: 'appDescription',
      type: 'input',
      validate: (input: string) => input.trim().length > 0 || 'Description cannot be empty',
    },
    {
      message: 'Production domain (e.g., playing.hungrimind.com):',
      name: 'prodDomain',
      type: 'input',
      validate(input: string) {
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)) {
          return 'Please enter a valid domain name'
        }

        return true
      },
    },
    {
      message: 'Development domain (e.g., playing-dev.hungrimind.com):',
      name: 'devDomain',
      type: 'input',
      validate(input: string) {
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)) {
          return 'Please enter a valid domain name'
        }

        return true
      },
    },
    {
      message: 'Docker username:',
      name: 'dockerUsername',
      type: 'input',
      validate: (input: string) => input.trim().length > 0 || 'Docker username cannot be empty',
    },
  ])

  return {
    appDescription: answers.appDescription,
    appName: answers.appName,
    devDomain: answers.devDomain,
    dockerUsername: answers.dockerUsername,
    prodDomain: answers.prodDomain,
  }
}

export function replacePlaceholders(content: string, config: AppConfig): string {
  return content
    .replaceAll('{{app-name}}', config.appName)
    .replaceAll('{{app-description}}', config.appDescription)
    .replaceAll('{{your-domain}}', config.prodDomain)
    .replaceAll('{{dev-domain}}', config.devDomain)
    .replaceAll('{{docker-username}}', config.dockerUsername)
}

export async function copyAndProcessTemplate(
  templatePath: string,
  targetPath: string,
  config: AppConfig,
): Promise<void> {
  const content = await fs.readFile(templatePath, 'utf8')
  const processedContent = replacePlaceholders(content, config)

  // Ensure target directory exists
  await fs.mkdir(path.dirname(targetPath), {recursive: true})

  await fs.writeFile(targetPath, processedContent)
}

export async function checkIfDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export async function createAppStructure(config: AppConfig, command: Command): Promise<void> {
  const appDir = config.appName
  let appDirCreated = false
  let workflowFileCreated = false
  const workflowFile = path.join('.github', 'workflows', `${config.appName}.yaml`)

  // Get the CLI package directory from the import.meta.url
  const currentModuleUrl = import.meta.url
  const currentModulePath = new URL(currentModuleUrl).pathname
  // Go up from dist/utils to package root
  const cliRootDir = path.resolve(path.dirname(currentModulePath), '..', '..')
  const templatesDir = path.join(cliRootDir, 'templates', 'kubernetes', 'app')

  try {
    // Check if app directory already exists
    if (await checkIfDirectoryExists(appDir)) {
      const inquirer = await import('inquirer')
      const {overwrite} = await inquirer.default.prompt([
        {
          default: false,
          message: `Directory '${appDir}' already exists. Overwrite?`,
          name: 'overwrite',
          type: 'confirm',
        },
      ])

      if (!overwrite) {
        command.error('App creation cancelled.')
      }
    }

    // Create app directory structure
    await fs.mkdir(appDir, {recursive: true})
    appDirCreated = true
    await fs.mkdir(path.join(appDir, 'templates'), {recursive: true})
    await fs.mkdir(path.join('.github', 'workflows'), {recursive: true})

    // Copy and process all template files
    const templateFiles = [
      {
        target: path.join(appDir, 'Chart.yaml'),
        template: path.join(templatesDir, 'Chart.yaml.template'),
      },
      {
        target: path.join(appDir, 'values.yaml'),
        template: path.join(templatesDir, 'values.yaml.template'),
      },
      {
        target: path.join(appDir, 'values-dev.yaml'),
        template: path.join(templatesDir, 'values-dev.yaml.template'),
      },
      {
        target: path.join(appDir, 'templates', 'deployment.yaml'),
        template: path.join(templatesDir, 'templates', 'deployment.yaml.template'),
      },
      {
        target: path.join(appDir, 'templates', 'service.yaml'),
        template: path.join(templatesDir, 'templates', 'service.yaml.template'),
      },
      {
        target: path.join(appDir, 'templates', 'ingress.yaml'),
        template: path.join(templatesDir, 'templates', 'ingress.yaml.template'),
      },
      {
        target: workflowFile,
        template: path.join(templatesDir, '.github', 'workflows', 'app-workflow.yaml.template'),
      },
    ]

    for (const {target, template} of templateFiles) {
      // eslint-disable-next-line no-await-in-loop
      await copyAndProcessTemplate(template, target, config)
      command.log(ux.colorize('green', `✔ Created ${target}`))

      // Track if workflow file was created
      if (target === workflowFile) {
        workflowFileCreated = true
      }
    }
  } catch (error) {
    // Cleanup on error
    command.log(ux.colorize('red', '\n✖ Error occurred during app creation. Cleaning up...'))

    try {
      // Remove app directory if we created it
      if (appDirCreated && (await checkIfDirectoryExists(appDir))) {
        await fs.rm(appDir, {force: true, recursive: true})
        command.log(ux.colorize('yellow', `✔ Removed ${appDir} directory`))
      }

      // Remove workflow file if we created it
      if (workflowFileCreated) {
        try {
          await fs.unlink(workflowFile)
          command.log(ux.colorize('yellow', `✔ Removed ${workflowFile}`))
        } catch {
          // File might not exist, that's OK
        }
      }
    } catch (cleanupError) {
      command.log(ux.colorize('red', `Warning: Could not clean up files: ${(cleanupError as Error).message}`))
    }

    // Re-throw the original error
    throw error
  }
}
