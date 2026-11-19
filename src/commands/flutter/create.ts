import {Args, Command, Flags, ux} from '@oclif/core'
import {execSync} from 'node:child_process'
import * as fs from 'node:fs/promises'
import path from 'node:path'

import {FLUTTER_KIT_REPO, KIT_OWNER} from '../../config.js'
import {downloadKit} from '../../utils/download.js'
import {
  extractKitToTemp,
  mergePubspec,
  overlayKitFiles,
  patchAndroidManifest,
  patchMacOSEntitlements,
  runFlutterCreate,
  runFlutterPubGet,
} from '../../utils/flutter.js'

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
      description: 'Path to a local kit directory (skips the GitHub download, useful for development)',
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
        // Local development mode — skip the GitHub download
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
        // Normal flow — download the public kit from GitHub
        ux.action.start('Downloading Flutter Kit')
        actionRunning = true
        const zipResponse = await downloadKit(FLUTTER_KIT_REPO, flags.verbose, this.log.bind(this))
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
          `https://github.com/${KIT_OWNER}/${FLUTTER_KIT_REPO}`,
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
}
