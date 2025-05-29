import { Args, Command, Flags, ux } from '@oclif/core'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { API_BASE_URL, AUTH_FILE_NAME, ROOT_FOLDER_NAME } from '../../config.js'
import { extractAndRenameProject, updateProjectFiles } from '../../utils/flutter.js'
import { fetchWithVerboseLogging } from '../../utils/fetch.js'

interface FlutterKitResponse {
  downloadUrl: string
}

interface AuthConfig {
  token: string
}

export default class CreateFlutter extends Command {
  static override description = 'Create a new Flutter project with the Hungrimind Flutter Kit'

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
    const configPath = path.join(os.homedir(), ROOT_FOLDER_NAME, AUTH_FILE_NAME)
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
        this.warn(`Could not remove auth file at ${configPath}: ${unlinkError}`)
      }
      this.error(ux.colorize('red', 'Authentication failed or token missing. Please run `hungrimind login` to log in.'), { exit: 1 })
    }
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(CreateFlutter)
    this.log(ux.colorize('blue', `Creating Flutter project: ${ux.colorize('cyan', args.name)}`))

    let actionRunning = false;

    try {
      ux.action.start('Fetching Flutter Kit details')
      actionRunning = true;
      const token = await this.getStoredToken()
      const endpoint = '/kit/flutter'
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

      if (flags.verbose) {
        this.log(`Response status: ${response.status}`)
      }

      if (!response.ok) {
        const errorBody = responseText ?? await response.text();
        if (flags.verbose) {
          this.log(`Error Body: ${errorBody}`);
        }
        throw new Error(`Failed to fetch Flutter Kit: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
      }

      // Parse JSON data
      let data: FlutterKitResponse;
      try {
        const bodyToParse = responseText ?? await response.json();
        data = typeof bodyToParse === 'string' ? JSON.parse(bodyToParse) as FlutterKitResponse : bodyToParse as FlutterKitResponse;
      } catch (error) {
        const bodyContent = responseText ?? '[Response body not available or already consumed]';
        throw new Error(`Failed to parse Flutter Kit response JSON: ${error}. Body was: ${bodyContent}`);
      }
      ux.action.stop(ux.colorize('green', '✔ Fetched details'))
      actionRunning = false;

      // Fetch the zip file from the download URL
      ux.action.start('Downloading Flutter Kit')
      actionRunning = true;
      const zipResponse = await fetch(data.downloadUrl)
      if (!zipResponse.ok) {
        throw new Error(`Failed to download zip file: ${zipResponse.statusText}`)
      }

      if (!zipResponse.headers.get('Content-Type')?.includes('application/zip')) {
        throw new Error('Expected zip file from download URL, but received different content type.')
      }
      ux.action.stop(ux.colorize('green', '✔ Downloaded'))
      actionRunning = false;

      ux.action.start('Extracting and setting up project')
      actionRunning = true;

      const projectPath = await extractAndRenameProject(args.name, zipResponse)
      await updateProjectFiles(projectPath, args.name);
      ux.action.stop(ux.colorize('green', '✔ Project set up'))
      actionRunning = false;

      this.log(ux.colorize('green', '\n🎉 Successfully created Flutter project!'))

      // Add link to Hungrimind docs
      this.log(`Find documentation for the Flutter Kit at: ${ux.colorize('blue', 'https://hungrimind.com/kit/flutter/introduction')}`)

      // Mimic flutter create output for running the app
      this.log('\nIn order to run your application:')
      this.log(`  $ cd ${ux.colorize('cyan', args.name)}`)
      this.log(`  $ ${ux.colorize('cyan', 'flutter run')}`)

    } catch (error) {
      if (actionRunning) {
        ux.action.stop(ux.colorize('red', '✖ failed'))
      }
      this.error(ux.colorize('red', `Project creation failed: ${(error as Error).message}`), { exit: 1 })
    }
  }
}
