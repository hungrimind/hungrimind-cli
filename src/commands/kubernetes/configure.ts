import {Args, Command} from '@oclif/core'
import {promptForPlaceholderReplacements} from '../../utils/kubernetes.js'

export default class KubernetesConfigure extends Command {
  static override description = 'Configure placeholders in a Kubernetes project (allows skipping any placeholder)'

  static override args = {
    directory: Args.string({
      description: 'The directory of the Kubernetes project to configure.',
      default: '.',
    }),
  }

  public async run(): Promise<void> {
    const {args} = await this.parse(KubernetesConfigure)
    await promptForPlaceholderReplacements(this, args.directory)
  }
}
