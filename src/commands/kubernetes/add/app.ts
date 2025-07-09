import {Command, ux} from '@oclif/core'
import {promptForAppConfig, createAppStructure} from '../../../utils/kubernetes-templates.js'

export default class KubernetesAddApp extends Command {
  static override description = 'Create a new Kubernetes app with Helm chart and GitHub Actions workflow'

  static override examples = ['$ hungrimind kubernetes add app']

  public async run(): Promise<void> {
    this.log(ux.colorize('blue', '✨ Adding a new Kubernetes app'))

    try {
      // Prompt for app configuration
      const config = await promptForAppConfig(this)

      this.log(ux.colorize('blue', '\n📁 Creating app structure...'))

      // Create all the files and directories
      await createAppStructure(config, this)

      this.log(ux.colorize('green', `\n🎉 App '${ux.colorize('cyan', config.appName)}' created successfully!`))
    } catch (error) {
      this.error(ux.colorize('red', `App creation failed: ${(error as Error).message}`), {exit: 1})
    }
  }
}
