import {Command} from '@oclif/core'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'
import {API_BASE_URL} from '../config.js'

interface AuthConfig {
  token: string
}

export abstract class AuthenticatedCommand extends Command {
  protected async getStoredToken(): Promise<string> {
    try {
      const configPath = path.join(os.homedir(), '.hungrimind', 'auth.json')
      const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as AuthConfig
      return config.token
    } catch (error) {
      this.error('Not authenticated. Please run `hungrimind auth` first.')
    }
  }

  protected async callApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getStoredToken()
    const url = `${API_BASE_URL}${endpoint}`
    
    this.log(`Making API call to: ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    this.log(`Response status: ${response.status}`)
    if (!response.ok) {
      this.log(`Response text: ${await response.text()}`)
    }
    
    return response
  }
} 