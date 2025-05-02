import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'

export async function extractAndRenameProject(projectName: string, zipResponse: Response) {
  const zipBuffer = await zipResponse.arrayBuffer();
  const targetPath = path.join(process.cwd(), projectName);

  const tempFile = path.join(os.tmpdir(), `flutter-kit-${Date.now()}.zip`);
  const tempDir = path.join(os.tmpdir(), `flutter-temp-${Date.now()}`);

  try {
    // Save zip to temp file
    await fs.writeFile(tempFile, Buffer.from(zipBuffer));

    // Extract to temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Use adm-zip to extract
    const zip = new AdmZip(tempFile);
    zip.extractAllTo(tempDir, /*overwrite*/ true);

    // Get the extracted folder (it should be the top-level folder)
    const extractedFiles = await fs.readdir(tempDir, { withFileTypes: true });
    const extractedFolder = extractedFiles.find(file => file.isDirectory())?.name;

    if (!extractedFolder) {
      throw new Error('No top-level directory found in the extracted ZIP file');
    }

    const extractedPath = path.join(tempDir, extractedFolder);

    // Ensure that the targetPath is not the same as extractedPath
    const targetDir = path.dirname(targetPath);
    if (extractedPath === targetDir) {
      throw new Error('Source and destination paths cannot be the same');
    }

    // Rename the folder to the new project name and move it to the target location
    const renamedPath = path.join(targetDir, projectName);

    // Use copy and remove instead of rename for cross-device compatibility
    await fs.cp(extractedPath, renamedPath, { recursive: true });
    // We can remove the original extracted path now that it's copied
    await fs.rm(extractedPath, { recursive: true, force: true });

    // Update project files in the new location
    await updateProjectFiles(renamedPath, projectName);

  } finally {
    // Cleanup
    await fs.unlink(tempFile).catch(() => { });
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
  }
}

async function updateProjectFiles(projectPath: string, newName: string) {
  const camelCaseName = newName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

  const processFile = async (filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const updated = content
        .replace(/flutter_kit/g, newName)
        .replace(/flutterKit/g, camelCaseName)
      if (content !== updated) {
        await fs.writeFile(filePath, updated, 'utf8')
      }
    } catch {
      // Skip binary files or files that can't be read as text
    }
  }

  const processDirectory = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
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