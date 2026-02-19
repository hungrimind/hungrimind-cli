import {Command, ux} from '@oclif/core'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import path from 'node:path'
import open from 'open'

import {AUTH_FILE_NAME, GITHUB_CLIENT_ID, ROOT_FOLDER_NAME} from '../config.js'

export default class Login extends Command {
  static override description = 'Authenticate with GitHub'

  public async run(): Promise<void> {
    try {
      // Step 1: Request device and user codes
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      const deviceCodeResponse = await fetch('https://github.com/login/device/code', {
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID, // eslint-disable-line camelcase
          scope: 'user',
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!deviceCodeResponse.ok) {
        this.error('Failed to get device code from GitHub')
        return
      }

      const deviceCodeJson = (await deviceCodeResponse.json()) as {
        device_code: string
        expires_in: number
        interval: number
        user_code: string
        verification_uri: string
      }

      // eslint-disable-next-line camelcase
      const {device_code, interval, user_code, verification_uri} = deviceCodeJson

      // Step 2: Show instructions to user
      this.log(ux.colorize('blue', 'To complete the GitHub login process:\n'))
      this.log(`1. Copy this code: ${ux.colorize('cyan', ux.colorize('bold', user_code))}`)
      this.log(`2. Visit this URL in your browser: ${ux.colorize('blue', verification_uri)}`)
      this.log('3. Paste the code when prompted.')

      this.log('\nOpening the authentication page in your browser...')

      // Automatically open the verification URL
      await open(verification_uri)

      // Step 3: Poll for completion
      ux.action.start('Waiting for GitHub authentication...')

      while (true) {
        // eslint-disable-next-line no-await-in-loop, n/no-unsupported-features/node-builtins
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID, // eslint-disable-line camelcase
            device_code, // eslint-disable-line camelcase
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code', // eslint-disable-line camelcase
          }),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })

        if (!tokenResponse.ok) {
          this.error('Failed to check authorization status with GitHub')
        }

        const data = (await tokenResponse.json()) as {access_token?: string; error?: string;} // eslint-disable-line no-await-in-loop

        if (data.error === 'authorization_pending') {
          await this.sleep(interval * 1000) // eslint-disable-line no-await-in-loop
          continue
        }

        if (data.error) {
          this.error(`GitHub authorization failed: ${data.error}`)
        }

        if (data.access_token) {
          await this.saveToken(data.access_token) // eslint-disable-line no-await-in-loop
          ux.action.stop(ux.colorize('green', '✔ done!'))
          this.log(ux.colorize('green', '🎉 Successfully authenticated with GitHub!'))
          break
        }
      }
    } catch (error) {
      if (ux.action.running) {
        ux.action.stop(ux.colorize('red', '✖ failed'))
      }

      this.error('Authentication failed unexpectedly: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  private async saveToken(token: string): Promise<void> {
    const configDir = path.join(os.homedir(), ROOT_FOLDER_NAME)
    await fs.mkdir(configDir, {recursive: true})
    await fs.writeFile(path.join(configDir, AUTH_FILE_NAME), JSON.stringify({token}))
  }

  private async sleep(ms: number): Promise<void> {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
