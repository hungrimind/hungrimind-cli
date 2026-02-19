import {Args, Command} from '@oclif/core'

import {promptAndRunFirstInstall, promptForRequiredPlaceholders} from '../../utils/kubernetes.js'

export default class KubernetesInstall extends Command {
  static override args = {
    directory: Args.string({
      default: '.',
      description: 'The directory of the Kubernetes project to install.',
    }),
  }
static override description = 'Install/deploy a Kubernetes project after validating required configuration'

  public async run(): Promise<void> {
    const {args} = await this.parse(KubernetesInstall)

    // Validate and prompt for any missing required placeholders
    await promptForRequiredPlaceholders(this, args.directory)

    // Prompt to run first_install.sh
    await promptAndRunFirstInstall(this, args.directory)
  }
}
