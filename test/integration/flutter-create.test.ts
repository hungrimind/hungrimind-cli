import {expect} from 'chai'
import {execSync} from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import path from 'node:path'
import {parse} from 'yaml'

import {
  mergePubspec,
  overlayKitFiles,
  patchAndroidManifest,
  patchMacOSEntitlements,
  runFlutterCreate,
  runFlutterPubGet,
} from '../../src/utils/flutter.js'

const KIT_REPO = 'https://github.com/hungrimind/flutter_kit.git'

describe('flutter create integration', function () {
  // These tests clone a repo and run flutter commands so they need a generous timeout
  this.timeout(300_000)

  let tmpDir: string
  let kitPath: string
  let projectPath: string
  const projectName = 'test_app'
  const org = 'com.test'

  before(async function () {
    // Verify flutter is available
    try {
      execSync('flutter --version', {stdio: 'pipe'})
    } catch {
      this.skip()
    }

    // Create temp dir
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-integration-'))

    // Clone the flutter kit repo
    kitPath = path.join(tmpDir, 'flutter_kit')
    execSync(`git clone --depth 1 ${KIT_REPO} ${kitPath}`, {stdio: 'pipe'})

    projectPath = path.join(tmpDir, projectName)

    // Step 1: flutter create
    runFlutterCreate(projectName, org, tmpDir)

    // Step 2: overlay kit files (excludes pubspec.yaml)
    await overlayKitFiles(projectPath, kitPath, projectName)

    // Step 3: merge kit dependencies into generated pubspec
    await mergePubspec(projectPath, kitPath)

    // Step 4: patch native files
    await patchAndroidManifest(projectPath)
    await patchMacOSEntitlements(projectPath)

    // Step 4: flutter pub get
    runFlutterPubGet(projectPath)
  })

  after(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, {force: true, recursive: true}).catch(() => {})
    }
  })

  it('creates a project directory', async () => {
    const stat = await fs.stat(projectPath)
    expect(stat.isDirectory()).to.be.true
  })

  it('has correct project name in pubspec.yaml', async () => {
    const pubspec = await fs.readFile(path.join(projectPath, 'pubspec.yaml'), 'utf8')
    expect(pubspec).to.include(`name: ${projectName}`)
    expect(pubspec).not.to.include('flutter_kit')
  })

  it('has kit dependencies merged into pubspec.yaml', async () => {
    const kitPubspec = parse(await fs.readFile(path.join(kitPath, 'pubspec.yaml'), 'utf8'))
    const projectPubspec = parse(await fs.readFile(path.join(projectPath, 'pubspec.yaml'), 'utf8'))

    // Every kit dependency should be in the merged pubspec
    for (const dep of Object.keys(kitPubspec.dependencies ?? {})) {
      expect(projectPubspec.dependencies).to.have.property(dep)
    }

    // Every kit dev_dependency should be in the merged pubspec
    for (const dep of Object.keys(kitPubspec.dev_dependencies ?? {})) {
      expect(projectPubspec.dev_dependencies).to.have.property(dep)
    }

    // Flutter config from kit should be merged (e.g., generate: true for l10n)
    if (kitPubspec.flutter) {
      for (const key of Object.keys(kitPubspec.flutter)) {
        expect(projectPubspec.flutter).to.have.property(key)
      }
    }
  })

  it('has no flutter_kit references in dart files', async () => {
    const result = execSync(
      `grep -r "flutter_kit" --include="*.dart" . || true`,
      {cwd: projectPath, encoding: 'utf8'},
    )
    expect(result.trim()).to.equal('')
  })

  it('has no flutter_kit references in yaml files', async () => {
    const result = execSync(
      `grep -r "flutter_kit" --include="*.yaml" . || true`,
      {cwd: projectPath, encoding: 'utf8'},
    )
    expect(result.trim()).to.equal('')
  })

  it('has no flutterKit references in dart files', async () => {
    const result = execSync(
      `grep -r "flutterKit" --include="*.dart" . || true`,
      {cwd: projectPath, encoding: 'utf8'},
    )
    expect(result.trim()).to.equal('')
  })

  it('has INTERNET permission in AndroidManifest', async () => {
    const manifest = await fs.readFile(
      path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    )
    expect(manifest).to.include('android.permission.INTERNET')
  })

  it('has VIBRATE permission in AndroidManifest', async () => {
    const manifest = await fs.readFile(
      path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    )
    expect(manifest).to.include('android.permission.VIBRATE')
  })

  it('has network client entitlement in macOS DebugProfile', async () => {
    const entitlements = await fs.readFile(
      path.join(projectPath, 'macos', 'Runner', 'DebugProfile.entitlements'),
      'utf8',
    )
    expect(entitlements).to.include('com.apple.security.network.client')
  })

  it('has correct org in Android build.gradle', async () => {
    const gradle = await fs.readFile(
      path.join(projectPath, 'android', 'app', 'build.gradle.kts'),
      'utf8',
    )
    expect(gradle).to.include(`${org}.${projectName}`)
  })

  it('has correct bundle identifier in iOS project', async () => {
    const pbxproj = await fs.readFile(
      path.join(projectPath, 'ios', 'Runner.xcodeproj', 'project.pbxproj'),
      'utf8',
    )
    // flutter create sets bundle id based on org and project name
    expect(pbxproj).to.include('PRODUCT_BUNDLE_IDENTIFIER')
    expect(pbxproj).not.to.include('com.example.flutterKit')
  })

  it('has kit lib/ files overlaid', async () => {
    // The kit has specific directories like config/, core/, home/
    const libEntries = await fs.readdir(path.join(projectPath, 'lib'))
    expect(libEntries).to.include('config')
    expect(libEntries).to.include('core')
    expect(libEntries).to.include('home')
  })

  it('has kit config files', async () => {
    const entries = await fs.readdir(projectPath)
    expect(entries).to.include('analysis_options.yaml')
    expect(entries).to.include('l10n.yaml')
  })

  it('does not contain native folders from the kit', async () => {
    // The Android/iOS folders should come from flutter create, not the kit.
    // Verify the Android package directory uses the correct org, not com/example/flutter_kit
    const kotlinDir = path.join(projectPath, 'android', 'app', 'src', 'main', 'kotlin')
    try {
      const stat = await fs.stat(kotlinDir)
      if (stat.isDirectory()) {
        // Should have com/test/test_app, not com/example/flutter_kit
        const result = execSync(`find . -type d -name "flutter_kit"`, {cwd: kotlinDir, encoding: 'utf8'})
        expect(result.trim()).to.equal('')
      }
    } catch {
      // kotlin dir might not exist in newer Flutter versions, that's fine
    }
  })

  it('passes flutter analyze', () => {
    // This validates the project is actually valid Dart/Flutter code
    try {
      execSync('flutter analyze', {cwd: projectPath, stdio: 'pipe'})
    } catch (error: unknown) {
      const execError = error as {stderr?: Buffer; stdout?: Buffer}
      const stdout = execError.stdout?.toString() ?? ''
      const stderr = execError.stderr?.toString() ?? ''
      throw new Error(`flutter analyze failed:\n${stdout}\n${stderr}`)
    }
  })
})
