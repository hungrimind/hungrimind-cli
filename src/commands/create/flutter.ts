import {Args} from '@oclif/core'
import * as path from 'path'
import {AuthenticatedCommand} from '../../utils/base.js'
import {extractAndRenameProject} from '../../utils/flutter.js'

interface BoilerplateResponse {
  downloadUrl: string
}

export default class CreateFlutter extends AuthenticatedCommand {
  static override description = 'Create a new Flutter project with Hungrimind boilerplate'

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

  public async run(): Promise<void> {
    const {args} = await this.parse(CreateFlutter)
    this.log(`Creating Flutter project: ${args.name}`)

    try {
      const response = await this.callApi('/flutter/boilerplate', {
        method: 'POST',
        body: JSON.stringify({
          name: args.name,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch boilerplate: ${response.statusText}`)
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
