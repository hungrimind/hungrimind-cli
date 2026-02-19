import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {execSync} from 'child_process'
import AdmZip from 'adm-zip'

/** Directories that flutter create generates and we should not overlay from the kit */
const NATIVE_PLATFORM_DIRS = ['android', 'ios', 'macos', 'linux', 'windows', 'web']

/** Files/dirs from the kit repo that should not be copied to the output project */
const EXCLUDED_FROM_OVERLAY = [
  ...NATIVE_PLATFORM_DIRS,
  '.git',
  '.github',
  '.dart_tool',
  '.metadata',
  '.flutter-plugins-dependencies',
  'build',
  'pubspec.lock',
]

/**
 * Extracts the kit ZIP to a temporary directory and returns the path to the extracted kit.
 */
export async function extractKitToTemp(zipResponse: Response): Promise<{kitPath: string; tempDir: string}> {
  const zipBuffer = await zipResponse.arrayBuffer()
  const tempFile = path.join(os.tmpdir(), `flutter-kit-${Date.now()}.zip`)
  const tempDir = path.join(os.tmpdir(), `flutter-temp-${Date.now()}`)

  try {
    await fs.writeFile(tempFile, Buffer.from(zipBuffer))
    await fs.mkdir(tempDir, {recursive: true})

    const zip = new AdmZip(tempFile)
    zip.extractAllTo(tempDir, true)

    const extractedFiles = await fs.readdir(tempDir, {withFileTypes: true})
    const extractedFolder = extractedFiles.find((file) => file.isDirectory())?.name

    if (!extractedFolder) {
      throw new Error('No top-level directory found in the extracted ZIP file')
    }

    return {kitPath: path.join(tempDir, extractedFolder), tempDir}
  } finally {
    await fs.unlink(tempFile).catch(() => {})
  }
}

/**
 * Runs `flutter create` to generate a fresh Flutter project with correct native platform setup.
 */
export function runFlutterCreate(projectName: string, org: string, cwd: string): void {
  execSync(`flutter create ${projectName} --org ${org}`, {
    cwd,
    stdio: 'pipe',
  })
}

/**
 * Overlays kit files on top of the flutter create output.
 * Copies only the kit-specific files (lib/, test/, pubspec.yaml, config files, etc.)
 * and skips native platform folders and build artifacts.
 */
export async function overlayKitFiles(projectPath: string, kitPath: string, projectName: string): Promise<void> {
  // Remove flutter create's default lib/ and test/ so they're fully replaced by the kit's versions.
  // This avoids leftover files like widget_test.dart that reference the default MyApp.
  for (const dir of ['lib', 'test']) {
    const defaultDir = path.join(projectPath, dir)
    await fs.rm(defaultDir, {recursive: true, force: true}).catch(() => {})
  }

  const entries = await fs.readdir(kitPath, {withFileTypes: true})

  for (const entry of entries) {
    if (EXCLUDED_FROM_OVERLAY.includes(entry.name)) continue
    // Skip hidden files that aren't relevant
    if (entry.name.startsWith('.') && !['.gitignore', '.vscode', '.claude', '.cursor'].includes(entry.name)) continue

    const srcPath = path.join(kitPath, entry.name)
    const destPath = path.join(projectPath, entry.name)

    if (entry.isDirectory()) {
      await fs.cp(srcPath, destPath, {recursive: true, force: true})
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }

  // Update project name references in all overlaid files
  await updateProjectReferences(projectPath, projectName)
}

/**
 * Replaces all `flutter_kit` / `flutterKit` references with the actual project name.
 */
async function updateProjectReferences(projectPath: string, newName: string): Promise<void> {
  const camelCaseName = newName.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

  const processFile = async (filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const updated = content.replace(/flutter_kit/g, newName).replace(/flutterKit/g, camelCaseName)
      if (content !== updated) {
        await fs.writeFile(filePath, updated, 'utf8')
      }
    } catch {
      // Skip binary files or files that can't be read as text
    }
  }

  const processDirectory = async (dir: string) => {
    const entries = await fs.readdir(dir, {withFileTypes: true})
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await processDirectory(fullPath)
      } else if (!entry.name.match(/\.(png|jpg|jpeg|gif|ttf|otf|woff|woff2|mp3|mp4|zip|jar)$/i)) {
        await processFile(fullPath)
      }
    }
  }

  await processDirectory(projectPath)
}

/**
 * Patches the Android manifest to add required permissions.
 */
export async function patchAndroidManifest(projectPath: string): Promise<void> {
  const manifestPath = path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
  let content = await fs.readFile(manifestPath, 'utf8')

  const permissions = [
    '<uses-permission android:name="android.permission.INTERNET"/>',
    '<uses-permission android:name="android.permission.VIBRATE"/>',
  ]

  // Add permissions after the opening <manifest> tag if not already present
  for (const permission of permissions) {
    if (!content.includes(permission)) {
      content = content.replace(
        /(<manifest[^>]*>)/,
        `$1\n    ${permission}`,
      )
    }
  }

  await fs.writeFile(manifestPath, content, 'utf8')
}

/**
 * Patches the macOS DebugProfile.entitlements to add network client permission.
 * Required for the app to make outgoing HTTP requests on macOS.
 */
export async function patchMacOSEntitlements(projectPath: string): Promise<void> {
  const entitlementsPath = path.join(projectPath, 'macos', 'Runner', 'DebugProfile.entitlements')

  let content: string
  try {
    content = await fs.readFile(entitlementsPath, 'utf8')
  } catch {
    // macOS folder might not exist if flutter create didn't include it
    return
  }

  const networkClientEntry = '<key>com.apple.security.network.client</key>\n\t<true/>'

  if (!content.includes('com.apple.security.network.client')) {
    // Insert before the closing </dict> tag
    content = content.replace(
      '</dict>',
      `\t${networkClientEntry}\n</dict>`,
    )
    await fs.writeFile(entitlementsPath, content, 'utf8')
  }
}

/**
 * Runs `flutter pub get` in the project directory.
 */
export function runFlutterPubGet(projectPath: string): void {
  execSync('flutter pub get', {
    cwd: projectPath,
    stdio: 'pipe',
  })
}

/**
 * Full project creation flow:
 * 1. Extract kit ZIP to temp
 * 2. Run flutter create
 * 3. Overlay kit files
 * 4. Patch native platform files
 * 5. Run flutter pub get
 * 6. Cleanup
 */
export async function createFlutterProject(
  projectName: string,
  org: string,
  zipResponse: Response,
  cwd: string,
): Promise<string> {
  const projectPath = path.join(cwd, projectName)
  const {kitPath, tempDir} = await extractKitToTemp(zipResponse)

  try {
    // Generate native platform scaffold
    runFlutterCreate(projectName, org, cwd)

    // Overlay kit files on top
    await overlayKitFiles(projectPath, kitPath, projectName)

    // Patch native platform files
    await patchAndroidManifest(projectPath)
    await patchMacOSEntitlements(projectPath)

    // Resolve dependencies
    runFlutterPubGet(projectPath)

    return projectPath
  } finally {
    await fs.rm(tempDir, {recursive: true, force: true}).catch(() => {})
  }
}

/**
 * Same as createFlutterProject but uses a local kit path instead of a ZIP download.
 * Useful for local development and testing.
 */
export async function createFlutterProjectFromLocal(
  projectName: string,
  org: string,
  localKitPath: string,
  cwd: string,
): Promise<string> {
  const projectPath = path.join(cwd, projectName)

  // Generate native platform scaffold
  runFlutterCreate(projectName, org, cwd)

  // Overlay kit files on top
  await overlayKitFiles(projectPath, localKitPath, projectName)

  // Patch native platform files
  await patchAndroidManifest(projectPath)
  await patchMacOSEntitlements(projectPath)

  // Resolve dependencies
  runFlutterPubGet(projectPath)

  return projectPath
}
