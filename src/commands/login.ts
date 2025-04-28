import {Command, ux} from '@oclif/core'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'
import open from 'open'
import {GITHUB_CLIENT_ID} from '../config.js'

export default class Login extends Command {
  static override description = 'Authenticate with GitHub'

  private async saveToken(token: string): Promise<void> {
    const configDir = path.join(os.homedir(), '.hungrimind')
    await fs.mkdir(configDir, {recursive: true})
    await fs.writeFile(path.join(configDir, 'Login.json'), JSON.stringify({token}))
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  public async run(): Promise<void> {
    try {
      // Step 1: Request device and user codes
      const deviceCodeResponse = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          scope: 'user',
        }),
      })

      if (!deviceCodeResponse.ok) {
        this.error('Failed to get device code from GitHub')
        return
      }

      const deviceCodeJson = await deviceCodeResponse.json() as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      }

      const {
        device_code,
        user_code,
        verification_uri,
        interval,
      } = deviceCodeJson

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
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        })

        if (!tokenResponse.ok) {
          this.error('Failed to check authorization status with GitHub')
        }

        const data = await tokenResponse.json() as { error?: string, access_token?: string }

        if (data.error === 'authorization_pending') {
          await this.sleep(interval * 1000)
          continue
        }

        if (data.error) {
          this.error(`GitHub authorization failed: ${data.error}`)
        }

        if (data.access_token) {
          await this.saveToken(data.access_token)
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
}
