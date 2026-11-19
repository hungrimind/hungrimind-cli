import {Args, Command, Flags, ux} from '@oclif/core'

import {KIT_OWNER, KUBERNETES_KIT_REPO} from '../../config.js'
import {downloadKit} from '../../utils/download.js'
import {promptAndRunFirstInstall, promptForRequiredPlaceholders} from '../../utils/kubernetes.js'
import {extractAndRenameProject} from '../../utils/zip.js'

export default class KubernetesCreate extends Command {
  static args = {
    name: Args.string({
      description: 'Name of the Kubernetes folder (lowercase with underscores, e.g., hungrimind_infrastructure)',
      async parse(input: string): Promise<string> {
        if (!/^[a-z][a-z0-9_]*$/.test(input)) {
          throw new Error('Project name must be lowercase with underscores (e.g., hungrimind_infrastructure)')
        }

        return input
      },
      required: true,
    }),
  }
static override description =
    'Create a new Kubernetes project with the Hungrimind Kubernetes Kit and configure required settings'
static flags = {
    verbose: Flags.boolean({char: 'v', description: 'Enable verbose output for debugging'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(KubernetesCreate)
    this.log(ux.colorize('blue', `Creating Kubernetes project: ${ux.colorize('cyan', args.name)}`))

    let actionRunning = false

    try {
      ux.action.start('Downloading Kubernetes Kit')
      actionRunning = true
      const zipResponse = await downloadKit(KUBERNETES_KIT_REPO, flags.verbose, this.log.bind(this))
      ux.action.stop(ux.colorize('green', '✔ Downloaded'))
      actionRunning = false

      ux.action.start('Extracting and setting up project')
      actionRunning = true

      await extractAndRenameProject(args.name, zipResponse)
      ux.action.stop(ux.colorize('green', '✔ Project set up'))
      actionRunning = false

      // New: Prompt for required placeholder replacements (blocking)
      await promptForRequiredPlaceholders(this, args.name)

      // Prompt to run first_install.sh
      await promptAndRunFirstInstall(this, args.name)

      this.log(
        ux.colorize('green', `\n🎉 Successfully created Kubernetes project '${ux.colorize('cyan', args.name)}'!`),
      )

      this.log(
        `Find documentation for the Kubernetes Kit at: ${ux.colorize(
          'blue',
          `https://github.com/${KIT_OWNER}/${KUBERNETES_KIT_REPO}`,
        )}`,
      )
    } catch (error) {
      if (actionRunning) {
        ux.action.stop(ux.colorize('red', '✖ failed'))
      }

      this.error(ux.colorize('red', `Project creation failed: ${(error as Error).message}`), {exit: 1})
    }
  }
}
