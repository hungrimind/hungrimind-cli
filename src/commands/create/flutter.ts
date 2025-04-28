import { Args, Command, Flags } from '@oclif/core'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { API_BASE_URL } from '../../config.js'
import { extractAndRenameProject } from '../../utils/flutter.js'
import { fetchWithVerboseLogging } from '../../utils/fetch.js'

interface BoilerplateResponse {
  downloadUrl: string
}

interface AuthConfig {
  token: string
}

export default class CreateFlutter extends Command {
  static override description = 'Create a new Flutter project with Hungrimind boilerplate'

  static flags = {
    verbose: Flags.boolean({ char: 'v', description: 'Enable verbose output for debugging' }),
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
      this.error('Authentication failed or token missing. Please run `hungrimind login` to log in.')
    }
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(CreateFlutter)
    this.log(`Creating Flutter project: ${args.name}`)

    try {
      const token = await this.getStoredToken()
      const endpoint = '/flutter/boilerplate'
      const url = `${API_BASE_URL}${endpoint}`

      // Prepare fetch options
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
      };

      // Use the wrapper function for the API call
      const { response, responseText } = await fetchWithVerboseLogging(
        url,
        fetchOptions,
        flags.verbose,
        this.log.bind(this)
      );

      this.log(`Response status: ${response.status}`)

      if (!response.ok) {
        // Use pre-read text if available (from verbose log), otherwise read now
        const errorBody = responseText ?? await response.text();
        this.log(`Error Body: ${errorBody}`);
        throw new Error(`Failed to fetch boilerplate: ${response.statusText} - ${errorBody}`);
      }

      // Parse JSON data
      let data: BoilerplateResponse;
      try {
        if (responseText !== undefined) {
          // If text was read for verbose logging, parse it
          data = JSON.parse(responseText) as BoilerplateResponse;
        } else {
          // Otherwise, parse directly from the response stream
          data = await response.json() as BoilerplateResponse;
        }
      } catch (error) {
        this.error(`Failed to parse boilerplate response JSON: ${error}. Body was: ${responseText ?? '[Not Read]'}`);
        return; // Exit if parsing fails
      }

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
      this.log(`1. cd ${args.name}`)
      this.log('2. flutter pub get')
      this.log('3. flutter run')
    } catch (error) {
      this.error(`Failed to create project: ${(error as Error).message}`)
    }
  }
}
