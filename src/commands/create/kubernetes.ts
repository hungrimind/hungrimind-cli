import { Args, Command, Flags, ux } from '@oclif/core'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import inquirer from 'inquirer'
import * as childProcess from 'child_process'
import { API_BASE_URL, AUTH_FILE_NAME, ROOT_FOLDER_NAME } from '../../config.js'
import { extractAndRenameProject } from '../../utils/flutter.js'
import { fetchWithVerboseLogging } from '../../utils/fetch.js'

interface KubernetesKitResponse {
  downloadUrl: string
}

interface AuthConfig {
  token: string
}

export default class CreateKubernetes extends Command {
  static override description = 'Create a new Kubernetes project with the Hungrimind Kubernetes Kit'

  static flags = {
    verbose: Flags.boolean({ char: 'v', description: 'Enable verbose output for debugging' }),
  }

  static args = {
    name: Args.string({
      description: 'Name of the Kubernetes folder (lowercase with underscores, e.g., hungrimind_infrastructure)',
      required: true,
      parse: async (input: string): Promise<string> => {
        if (!/^[a-z][a-z0-9_]*$/.test(input)) {
          throw new Error('Project name must be lowercase with underscores (e.g., hungrimind_infrastructure)')
        }
        return input
      },
    }),
  }

  private async getStoredToken(): Promise<string> {
    const configPath = path.join(os.homedir(), ROOT_FOLDER_NAME, AUTH_FILE_NAME)
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as AuthConfig
      if (!config.token) {
        throw new Error('Token not found in auth config.')
      }
      return config.token
    } catch (error) {
      try {
        await fs.unlink(configPath)
        this.log('Removed potentially invalid auth file.')
      } catch (unlinkError) {
        this.warn(`Could not remove auth file at ${configPath}: ${unlinkError}`)
      }
      this.error(ux.colorize('red', 'Authentication failed or token missing. Please run `hungrimind login` to log in.'), { exit: 1 })
    }
  }

  // Helper method to recursively get all files in a directory
  private async getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Skip common directories to avoid processing unnecessary files
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') {
          continue;
        }
        await this.getAllFiles(fullPath, arrayOfFiles);
      } else if (entry.isFile()) {
        // Filter for YAML files with "values" in their name
        const fileName = entry.name.toLowerCase();
        if (fileName.includes('values') && (fileName.endsWith('.yaml') || fileName.endsWith('.yml'))) {
          arrayOfFiles.push(fullPath);
        }
      }
    }
    return arrayOfFiles;
  }

  // Helper method to get line number and line content for a character index
  private getLineContext(content: string, charIndex: number): { lineNumber: number; line: string } {
    let lineNumber = 1;
    let lineStartIndex = 0;
    for (let i = 0; i < charIndex; i++) {
      if (content[i] === '\n') {
        lineNumber++;
        lineStartIndex = i + 1;
      }
    }
    const lineEndIndex = content.indexOf('\n', lineStartIndex);
    const line = content.substring(lineStartIndex, lineEndIndex === -1 ? content.length : lineEndIndex);
    return { lineNumber, line };
  }

  // Method to prompt for placeholder replacements
  private async promptForPlaceholderReplacements(projectDirName: string): Promise<void> {
    const projectFullPath = path.resolve(projectDirName);
    this.log(ux.colorize('blue', `\nScanning for '{{...}}' placeholders in 'values' YAML files within '${projectDirName}'...`));

    const placeholderRegex = /{{\s*([^}]+?)\s*}}/g; // Regex to find {{ placeholder }}
    const allFiles = await this.getAllFiles(projectFullPath);
    let anyPlaceholdersFoundInAnyFile = false;

    for (const filePath of allFiles) {
      try {
        const originalContent = await fs.readFile(filePath, 'utf8');
        let currentFileContent = originalContent;
        let newFileContentParts: string[] = [];
        let lastIndexProcessed = 0;
        let madeChangesToFile = false;
        let instanceInFile = 0;
        let match;

        // Check if the file initially contains any placeholders to avoid unnecessary processing
        if (!placeholderRegex.test(currentFileContent)) {
          // Reset regex for next file if test() was used
          placeholderRegex.lastIndex = 0;
          continue;
        }
        // Ensure regex is reset before exec loop for current file
        placeholderRegex.lastIndex = 0;


        const relativeFilePath = path.relative(projectFullPath, filePath);
        this.log(ux.colorize('magenta', `\nProcessing file: ${relativeFilePath}`));

        while ((match = placeholderRegex.exec(currentFileContent)) !== null) {
          anyPlaceholdersFoundInAnyFile = true;
          instanceInFile++;

          const fullMatch = match[0]; // e.g., "{{ some_value }}"
          const placeholderIndex = match.index;

          newFileContentParts.push(currentFileContent.substring(lastIndexProcessed, placeholderIndex));

          const { line } = this.getLineContext(currentFileContent, placeholderIndex);
          this.log(`File: ${ux.colorize('cyan', relativeFilePath)}`);
          this.log(line.trim()); // Log the content of the line

          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'replacement',
              message: `Replace '${fullMatch}' with (leave empty to skip):`,
              default: '',
            },
          ]);
          const userInput = answers.replacement;

          if (userInput && userInput.trim() !== '') {
            newFileContentParts.push(userInput.trim());
            madeChangesToFile = true;
            this.log(ux.colorize('green', `  Replaced with: "${userInput.trim()}"`));
          } else {
            newFileContentParts.push(fullMatch); // Keep original placeholder
            this.log(ux.colorize('dim', `  Skipped.`));
          }
          lastIndexProcessed = placeholderIndex + fullMatch.length;
        }

        if (lastIndexProcessed < currentFileContent.length) {
          newFileContentParts.push(currentFileContent.substring(lastIndexProcessed));
        }

        if (madeChangesToFile) {
          const finalContent = newFileContentParts.join('');
          await fs.writeFile(filePath, finalContent, 'utf8');
          this.log(ux.colorize('green', `✔ Updated file: ${relativeFilePath}`));
        } else if (instanceInFile > 0) { // Had placeholders but none were changed
          this.log(ux.colorize('dim', `No changes made to: ${relativeFilePath} (all placeholders skipped)`));
        }
        // If instanceInFile is 0 (after initial check passed), it means regex found something initially
        // but loop didn't run, which is unlikely given the check.
        // If file had no placeholders initially, it's skipped before this point.

      } catch (error) {
        // Log error for specific file and continue with others
        this.warn(`Could not process file ${filePath} for placeholders: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && (error.message.includes('EISDIR') || error.message.includes('EINVAL'))) {
          this.log(ux.colorize('dim', `Skipping likely binary or problematic file: ${filePath}`));
        }
      }
    }

    if (!anyPlaceholdersFoundInAnyFile) {
      this.log(`No '{{...}}' placeholders found in any 'values' YAML files within '${projectDirName}'.`);
    } else {
      this.log(ux.colorize('green', `\n✔ Placeholder update process complete for '${projectDirName}'.`));
    }
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(CreateKubernetes)
    this.log(ux.colorize('blue', `Creating Kubernetes project: ${ux.colorize('cyan', args.name)}`))

    let actionRunning = false;

    try {
      ux.action.start('Fetching Kubernetes Kit details')
      actionRunning = true;
      const token = await this.getStoredToken()
      const endpoint = '/kit/kubernetes'
      const url = `${API_BASE_URL}${endpoint}`

      // Prepare fetch options
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
      };

      // Use the wrapper function for the API call
      const { response, responseText } = await fetchWithVerboseLogging(
        url,
        fetchOptions,
        flags.verbose,
        this.log.bind(this)
      );

      if (flags.verbose) {
        this.log(`Response status: ${response.status}`)
      }

      if (!response.ok) {
        const errorBody = responseText ?? await response.text();
        if (flags.verbose) {
          this.log(`Error Body: ${errorBody}`);
        }
        throw new Error(`Failed to fetch Kubernetes Kit: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
      }

      // Parse JSON data
      let data: KubernetesKitResponse;
      try {
        const bodyToParse = responseText ?? await response.json();
        data = typeof bodyToParse === 'string' ? JSON.parse(bodyToParse) as KubernetesKitResponse : bodyToParse as KubernetesKitResponse;
      } catch (error) {
        const bodyContent = responseText ?? '[Response body not available or already consumed]';
        throw new Error(`Failed to parse Kubernetes Kit response JSON: ${error}. Body was: ${bodyContent}`);
      }
      ux.action.stop(ux.colorize('green', '✔ Fetched details'))
      actionRunning = false;

      // Fetch the zip file from the download URL
      ux.action.start('Downloading Kubernetes Kit')
      actionRunning = true;
      const zipResponse = await fetch(data.downloadUrl)
      if (!zipResponse.ok) {
        throw new Error(`Failed to download zip file: ${zipResponse.statusText}`)
      }

      if (!zipResponse.headers.get('Content-Type')?.includes('application/zip')) {
        throw new Error('Expected zip file from download URL, but received different content type.')
      }
      ux.action.stop(ux.colorize('green', '✔ Downloaded'))
      actionRunning = false;

      ux.action.start('Extracting and setting up project')
      actionRunning = true;

      await extractAndRenameProject(args.name, zipResponse)
      ux.action.stop(ux.colorize('green', '✔ Project set up'))
      actionRunning = false;

      // New: Prompt for placeholder replacements
      await this.promptForPlaceholderReplacements(args.name);

      this.log(ux.colorize('green', `\n🎉 Successfully created Kubernetes project '${ux.colorize('cyan', args.name)}'!`))

      // Add link to Hungrimind docs
      this.log(`Find documentation for the Kubernetes Kit at: ${ux.colorize('blue', 'https://hungrimind.com/kit/kubernetes/introduction')}`)

      // --- Start: Prompt to run first_install.sh ---
      const firstInstallScriptPath = path.join(args.name, 'first_install.sh');
      try {
        await fs.access(firstInstallScriptPath, fs.constants.F_OK); // Check if script exists

        this.log(ux.colorize('yellow', '\n--- Optional Next Step ---'));
        const { runScript } = await inquirer.prompt([
          {
            name: 'runScript',
            type: 'confirm',
            message: `A 'first_install.sh' script is available. This script can help set up k3s, Helm, and other required services on your cluster. Would you like to run it now?`,
            default: false,
          },
        ]);

        if (runScript) {
          this.log(ux.colorize('blue', `Attempting to run 'first_install.sh'...`));
          try {
            // Ensure the script is executable
            await fs.chmod(firstInstallScriptPath, 0o755);
            this.log(ux.colorize('dim', `Ensured '${firstInstallScriptPath}' has execute permissions.`));

            // Run the script
            ux.action.start(ux.colorize('blue', `Executing 'first_install.sh' in '${args.name}'`));
            const scriptExecution = childProcess.spawn(firstInstallScriptPath, [], {
              cwd: path.resolve(args.name), // Run from within the project folder
              stdio: 'inherit', // Stream stdout/stderr to console
              shell: true, // Use shell to execute, handles shebangs etc.
            });

            await new Promise<void>((resolve, reject) => {
              scriptExecution.on('close', (code) => {
                if (code === 0) {
                  ux.action.stop(ux.colorize('green', `✔ 'first_install.sh' executed successfully.`));
                  resolve();
                } else {
                  ux.action.stop(ux.colorize('red', `✖ 'first_install.sh' failed with exit code ${code}.`));
                  reject(new Error(`Script failed with exit code ${code}. Check output above for details.`));
                }
              });
              scriptExecution.on('error', (err) => {
                ux.action.stop(ux.colorize('red', `✖ Failed to start 'first_install.sh'.`));
                reject(err);
              });
            });

          } catch (scriptError) {
            if (ux.action.running) {
              ux.action.stop(ux.colorize('red', '✖ failed'));
            }
            this.warn(ux.colorize('red', `Could not execute 'first_install.sh': ${scriptError instanceof Error ? scriptError.message : String(scriptError)}`));
            this.log(ux.colorize('dim', `You may need to run it manually: cd ${args.name} && ./first_install.sh`));
          }
        } else {
          this.log(ux.colorize('dim', `Skipped execution of 'first_install.sh'. You can run it later from the '${args.name}' directory.`));
        }
      } catch (error) {
        // fs.access throws if file doesn't exist - this is fine, just means no script to run.
        this.log(ux.colorize('dim', `No 'first_install.sh' script found in '${args.name}', skipping this step.`));
      }
      // --- End: Prompt to run first_install.sh ---

      this.log('\nNext steps:')
      this.log(`  $ cd ${ux.colorize('cyan', args.name)}`)
      this.log(`  Commit your changes to version control and setup environment variables.`)

    } catch (error) {
      if (actionRunning) {
        ux.action.stop(ux.colorize('red', '✖ failed'))
      }
      this.error(ux.colorize('red', `Project creation failed: ${(error as Error).message}`), { exit: 1 })
    }
  }
}
