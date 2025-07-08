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

      // Display next steps
      this.log(ux.colorize('blue', '\nNext steps:'))
      this.log(`  $ cd ${ux.colorize('cyan', config.appName)}`)
      this.log('  $ git add .')
      this.log(`  $ git commit -m "Add ${config.appName} app"`)
      this.log('  $ git push')

      // Display deployment overview
      this.log(ux.colorize('blue', '\n📋 Deployment Overview:'))
      this.log(`• Repository dispatch (automatic) → deploys to DEV (${config.appName}-dev.${config.domain})`)
      this.log(`• Manual workflow dispatch → deploys to PROD (${config.appName}.${config.domain})`)

      this.log(ux.colorize('gray', '\n--- Explanation ---'))
      this.log(ux.colorize('gray', 'Deployment happens automatically via GitHub Actions:'))
      this.log(ux.colorize('gray', '• Push/merge triggers Docker build → auto-deploys to DEV'))
      this.log(ux.colorize('gray', '• Manual workflow dispatch → deploys to PROD'))
      this.log(ux.colorize('gray', ''))
      this.log(ux.colorize('gray', 'Or trigger manually via API:'))
      this.log(ux.colorize('gray', '# Dev deployment (repository dispatch)'))
      this.log(
        ux.colorize(
          'gray',
          "• You can trigger the automatic dispatch with a command like this from your service's github action",
        ),
      )
      this.log(ux.colorize('gray', '$ curl -L -X POST \\'))
      this.log(ux.colorize('gray', '  -H "Accept: application/vnd.github+json" \\'))
      this.log(ux.colorize('gray', '  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \\'))
      this.log(ux.colorize('gray', '  -H "X-GitHub-Api-Version: 2022-11-28" \\'))
      this.log(
        ux.colorize('gray', '  https://api.github.com/repos/YOUR-ORG-OR-USERNAME/infrastructure-repo/dispatches \\'),
      )
      this.log(
        ux.colorize(
          'gray',
          `  -d '{"event_type":"${config.appName}-build-completed","client_payload":{"image_tag":"` +
            '${{ steps.version.outputs.VERSION }}' +
            `"}}'`,
        ),
      )
    } catch (error) {
      this.error(ux.colorize('red', `App creation failed: ${(error as Error).message}`), {exit: 1})
    }
  }
}
