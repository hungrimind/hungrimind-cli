import {Args, Command, Flags, ux} from '@oclif/core'
import {execSync} from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import path from 'node:path'

import {API_BASE_URL, AUTH_FILE_NAME, ROOT_FOLDER_NAME} from '../../config.js'
import {fetchWithVerboseLogging} from '../../utils/fetch.js'
import {
  extractKitToTemp,
  mergePubspec,
  overlayKitFiles,
  patchAndroidManifest,
  patchMacOSEntitlements,
  runFlutterCreate,
  runFlutterPubGet,
} from '../../utils/flutter.js'

interface FlutterCreateKitResponse {
  downloadUrl: string
}

interface AuthConfig {
  token: string
}

export default class FlutterCreate extends Command {
  static args = {
    name: Args.string({
      description: 'Name of the Flutter application (lowercase with underscores, e.g., my_app)',
      async parse(input: string): Promise<string> {
        if (!/^[a-z][a-z0-9_]*$/.test(input)) {
          throw new Error('Project name must be lowercase with underscores (e.g., my_app)')
        }

        return input
      },
      required: true,
    }),
  }
static override description = 'Create a new Flutter project with the Hungrimind Flutter Kit'
static flags = {
    local: Flags.string({
      description: 'Path to a local kit directory (skips API download, useful for development)',
    }),
    org: Flags.string({
      default: 'com.example',
      description: 'Organization identifier for the project (e.g., com.mycompany)',
    }),
    verbose: Flags.boolean({char: 'v', description: 'Enable verbose output for debugging'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlutterCreate)

    // Verify Flutter SDK is installed
    try {
      execSync('flutter --version', {stdio: 'pipe'})
    } catch {
      this.error(
        ux.colorize('red', 'Flutter SDK not found. Please install Flutter first: https://flutter.dev/docs/get-started/install'),
        {exit: 1},
      )
    }

    this.log(ux.colorize('blue', `Creating Flutter project: ${ux.colorize('cyan', args.name)}`))

    let actionRunning = false

    try {
      if (flags.local) {
        // Local development mode — skip API download
        this.log(ux.colorize('yellow', `Using local kit at: ${flags.local}`))

        const projectPath = path.join(process.cwd(), args.name)

        ux.action.start('Running flutter create')
        actionRunning = true
        runFlutterCreate(args.name, flags.org, process.cwd())
        ux.action.stop(ux.colorize('green', '✔ Flutter project scaffolded'))
        actionRunning = false

        ux.action.start('Overlaying kit files')
        actionRunning = true
        await overlayKitFiles(projectPath, flags.local, args.name)
        ux.action.stop(ux.colorize('green', '✔ Kit files applied'))
        actionRunning = false

        ux.action.start('Merging dependencies')
        actionRunning = true
        await mergePubspec(projectPath, flags.local)
        ux.action.stop(ux.colorize('green', '✔ Dependencies merged'))
        actionRunning = false

        ux.action.start('Patching platform files')
        actionRunning = true
        await patchAndroidManifest(projectPath)
        await patchMacOSEntitlements(projectPath)
        ux.action.stop(ux.colorize('green', '✔ Platform files patched'))
        actionRunning = false

        ux.action.start('Resolving dependencies (flutter pub get)')
        actionRunning = true
        runFlutterPubGet(projectPath)
        ux.action.stop(ux.colorize('green', '✔ Dependencies resolved'))
        actionRunning = false
      } else {
        // Normal flow — download from API
        ux.action.start('Fetching Flutter Kit details')
        actionRunning = true
        const token = await this.getStoredToken()
        const endpoint = '/kit/flutter'
        const url = `${API_BASE_URL}${endpoint}`

        const fetchOptions = {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
          method: 'POST',
        }

        const {response, responseText} = await fetchWithVerboseLogging(
          url,
          fetchOptions,
          flags.verbose,
          this.log.bind(this),
        )

        if (flags.verbose) {
          this.log(`Response status: ${response.status}`)
        }

        if (!response.ok) {
          const errorBody = responseText ?? (await response.text())
          if (flags.verbose) {
            this.log(`Error Body: ${errorBody}`)
          }

          throw new Error(`Failed to fetch Flutter Kit: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`)
        }

        let data: FlutterCreateKitResponse
        try {
          const bodyToParse = responseText ?? (await response.json())
          data =
            typeof bodyToParse === 'string'
              ? (JSON.parse(bodyToParse) as FlutterCreateKitResponse)
              : (bodyToParse as FlutterCreateKitResponse)
        } catch (error) {
          const bodyContent = responseText ?? '[Response body not available or already consumed]'
          throw new Error(`Failed to parse Flutter Kit response JSON: ${error}. Body was: ${bodyContent}`)
        }

        ux.action.stop(ux.colorize('green', '✔ Fetched details'))
        actionRunning = false

        ux.action.start('Downloading Flutter Kit')
        actionRunning = true
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
      const zipResponse = await fetch(data.downloadUrl)
        if (!zipResponse.ok) {
          throw new Error(`Failed to download zip file: ${zipResponse.statusText}`)
        }

        if (!zipResponse.headers.get('Content-Type')?.includes('application/zip')) {
          throw new Error('Expected zip file from download URL, but received different content type.')
        }

        ux.action.stop(ux.colorize('green', '✔ Downloaded'))
        actionRunning = false

        ux.action.start('Extracting kit')
        actionRunning = true
        const {kitPath, tempDir} = await extractKitToTemp(zipResponse)
        ux.action.stop(ux.colorize('green', '✔ Kit extracted'))
        actionRunning = false

        try {
          const projectPath = path.join(process.cwd(), args.name)

          ux.action.start('Running flutter create')
          actionRunning = true
          runFlutterCreate(args.name, flags.org, process.cwd())
          ux.action.stop(ux.colorize('green', '✔ Flutter project scaffolded'))
          actionRunning = false

          ux.action.start('Overlaying kit files')
          actionRunning = true
          await overlayKitFiles(projectPath, kitPath, args.name)
          ux.action.stop(ux.colorize('green', '✔ Kit files applied'))
          actionRunning = false

          ux.action.start('Merging dependencies')
          actionRunning = true
          await mergePubspec(projectPath, kitPath)
          ux.action.stop(ux.colorize('green', '✔ Dependencies merged'))
          actionRunning = false

          ux.action.start('Patching platform files')
          actionRunning = true
          await patchAndroidManifest(projectPath)
          await patchMacOSEntitlements(projectPath)
          ux.action.stop(ux.colorize('green', '✔ Platform files patched'))
          actionRunning = false

          ux.action.start('Resolving dependencies (flutter pub get)')
          actionRunning = true
          runFlutterPubGet(projectPath)
          ux.action.stop(ux.colorize('green', '✔ Dependencies resolved'))
          actionRunning = false
        } finally {
          await fs.rm(tempDir, {force: true, recursive: true}).catch(() => {})
        }
      }

      this.log(ux.colorize('green', '\n🎉 Successfully created Flutter project!'))

      this.log(
        `Find documentation for the Flutter Kit at: ${ux.colorize(
          'blue',
          'https://hungrimind.com/kit/flutter/introduction',
        )}`,
      )

      this.log('\nIn order to run your application:')
      this.log(`  $ cd ${ux.colorize('cyan', args.name)}`)
      this.log(`  $ ${ux.colorize('cyan', 'flutter run')}`)
    } catch (error) {
      if (actionRunning) {
        ux.action.stop(ux.colorize('red', '✖ failed'))
      }

      this.error(ux.colorize('red', `Project creation failed: ${(error as Error).message}`), {exit: 1})
    }
  }

  private async getStoredToken(): Promise<string> {
    const configPath = path.join(os.homedir(), ROOT_FOLDER_NAME, AUTH_FILE_NAME)
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as AuthConfig
      if (!config.token) {
        throw new Error('Token not found in auth config.')
      }

      return config.token
    } catch {
      try {
        await fs.unlink(configPath)
        this.log('Removed potentially invalid auth file.')
      } catch (unlinkError) {
        this.warn(`Could not remove auth file at ${configPath}: ${unlinkError}`)
      }

      this.error(
        ux.colorize('red', 'Authentication failed or token missing. Please run `hungrimind login` to log in.'),
        {exit: 1},
      )
    }
  }
}
