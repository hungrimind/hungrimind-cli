import {Args, Command, Flags} from '@oclif/core'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import {API_BASE_URL} from '../../config.js'
import {extractAndRenameProject} from '../../utils/flutter.js'

interface BoilerplateResponse {
  downloadUrl: string
}

interface AuthConfig {
  token: string
}

export default class CreateFlutter extends Command {
  static override description = 'Create a new Flutter project with Hungrimind boilerplate'

  static flags = {
    verbose: Flags.boolean({char: 'v', description: 'Enable verbose output for debugging'}),
  }

  static args = {
    name: Args.string({
      description: 'Name of the Flutter application (lowercase with underscores, e.g., my_app)',
      required: true,
      parse: async (input: string): Promise<string> => {
        if (!/^[a-z][a-z0-9_]*$/.test(input)) {
          throw new Error('Project name must be lowercase with underscores (e.g., my_app)')
        }
        return input
      },
    }),
  }

  private async getStoredToken(): Promise<string> {
    const configPath = path.join(os.homedir(), '.hungrimind', 'auth.json')
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as AuthConfig
      if (!config.token) {
        throw new Error('Token not found in auth config.')
      }
      return config.token
    } catch (error) {
      try {
        await fs.unlink(configPath)
        this.log('Removed potentially invalid auth file.')
      } catch (unlinkError) {
        this.log(`Warning: Could not remove auth file at ${configPath}: ${unlinkError}`)
      }
      this.error('Authentication failed or token missing. Please run `hungrimind auth` to log in.')
    }
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(CreateFlutter)
    this.log(`Creating Flutter project: ${args.name}`)

    try {
      const token = await this.getStoredToken()
      const endpoint = '/flutter/boilerplate'
      const url = `${API_BASE_URL}${endpoint}`
      this.log(`Making API call to: ${url}`)

      const requestBody = { name: args.name }
      const headers = {
        'Content-Type': 'application/json',
      }
      const bodyString = JSON.stringify({
        ...requestBody,
        githubToken: token,
      })

      if (flags.verbose) {
        this.log('--- Verbose Request Details ---')
        this.log(`Token: ${token}`)
        this.log(`Request Body Object: ${JSON.stringify(requestBody)}`)
        this.log(`Full Body String: ${bodyString}`)
        this.log(`Headers: ${JSON.stringify(headers)}`)
        this.log('-------------------------------')
      }

      const response = await fetch(url, {
        method: 'POST',
        body: bodyString,
        headers: headers,
      })

      this.log(`Response status: ${response.status}`)
      if (!response.ok) {
        const responseText = await response.text()
        this.log(`Response text: ${responseText}`)
        throw new Error(`Failed to fetch boilerplate: ${response.statusText} - ${responseText}`)
      }

      const data = await response.json() as BoilerplateResponse
      
      // Fetch the zip file from the download URL
      const zipResponse = await fetch(data.downloadUrl)
      if (!zipResponse.ok) {
        throw new Error(`Failed to download zip file: ${zipResponse.statusText}`)
      }

      if (!zipResponse.headers.get('Content-Type')?.includes('application/zip')) {
        throw new Error('Expected zip file from download URL')
      }

      const buffer = await zipResponse.arrayBuffer()
      const targetPath = path.join(process.cwd(), args.name)
      
      await extractAndRenameProject(buffer, args.name, targetPath)

      this.log('\nSuccessfully created Flutter project!')
      this.log('\nNext steps:')
      this.log(`  1. cd ${args.name}`)
      this.log('  2. flutter pub get')
      this.log('  3. flutter run')
    } catch (error) {
      this.error(`Failed to create project: ${(error as Error).message}`)
    }
  }
}
