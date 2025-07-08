# Kubernetes Add Docker Build Command - Implementation Plan

## Overview
Create a `hungrimind kubernetes add docker-build` command that scaffolds Docker build workflows that automatically trigger Kubernetes deployments when images are built.

## Command Signature
```bash
hungrimind kubernetes add docker-build <app-name>
```

## What It Does
Creates a GitHub Actions workflow that:
1. Builds and pushes Docker image for Go applications
2. Triggers the Kubernetes deployment workflow via repository dispatch
3. Works for single-app repositories (not monorepos)

## Integration with App Command
This complements the `kubernetes add app` command:
- `add app` → creates Kubernetes manifests + deployment workflow
- `add docker-build` → creates Docker build workflow that triggers the deployment

## Tasks

### 1. Create Command
- [ ] Create `src/commands/kubernetes/add/docker-build.ts`
- [ ] Require app name argument (to match existing Kubernetes app)
- [ ] Interactive prompts for:
  - [ ] Repository type (organization or personal)
  - [ ] Docker registry username (default from previous app creation)
  - [ ] Build context directory (default: `.`)

### 2. Create Go Template
- [ ] Create `src/templates/kubernetes/docker-build/` directory
- [ ] Go workflow template:
  - [ ] `go.yaml.template` - Go applications

### 3. Template Processing
- [ ] Simple placeholder replacement:
  - [ ] `{{app-name}}` → user input
  - [ ] `{{docker-username}}` → user input  
  - [ ] `{{build-context}}` → user input
  - [ ] `{{github-token}}` → "ORG_TOKEN" or "PAT" based on repository type
  - [ ] `{{github-org-or-username}}` → organization name or username
  - [ ] `{{infrastructure-repo}}` → infrastructure repository name

### 4. Workflow Features
- [ ] **Triggers**:
  - [ ] Push to main branch
  - [ ] Manual workflow dispatch with custom tag
- [ ] **Versioning**: Use git SHA for image tags
- [ ] **Registry**: Push to Docker Hub (configurable)
- [ ] **Repository Dispatch**: Trigger Kubernetes deployment

### 5. Integration Logic
- [ ] Check if Kubernetes app with same name exists
- [ ] Use same Docker registry/username from app creation
- [ ] Generate correct repository dispatch event name: `{{app-name}}-build-completed`
- [ ] Reference correct infrastructure repository for deployment trigger

### 6. Template Content (Go)

#### .github/workflows/{{app-name}}-build.yaml
```yaml
name: Build and Deploy {{app-name}}

on:
  push:
    branches:
      - "main"
  workflow_dispatch:
    inputs:
      custom_tag:
        description: "Custom image tag (optional)"
        required: false
        type: string
        default: "latest"

env:
  REGISTRY: {{docker-username}}
  IMAGE: {{app-name}}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set version
        id: version
        run: |
          if [ "${{ github.event.inputs.custom_tag }}" != "" ]; then
            echo "VERSION=${{ github.event.inputs.custom_tag }}" >> $GITHUB_OUTPUT
          else
            echo "VERSION=${GITHUB_SHA::7}" >> $GITHUB_OUTPUT
          fi

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push {{app-name}}
        uses: docker/build-push-action@v5
        with:
          context: {{build-context}}
          file: {{build-context}}/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE }}:${{ steps.version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE }}:latest

      - name: Trigger Kubernetes deployment
        if: success() && github.ref == 'refs/heads/main'
        run: |
          curl -L \
            -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer ${{ secrets.{{github-token}} }}" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/{{github-org-or-username}}/{{infrastructure-repo}}/dispatches \
            -d '{"event_type":"{{app-name}}-build-completed","client_payload":{"image_tag":"${{ steps.version.outputs.VERSION }}"}}'
```

## User Flow
```bash
$ hungrimind kubernetes add docker-build my-api

✨ Adding Docker build workflow for 'my-api'

? Is this an organization repository or personal repository? Organization
? Build context directory: . 
? Docker registry username: my-username

📁 Creating build workflow...
✔ Created .github/workflows/my-api-build.yaml

🎉 Docker build workflow created successfully!

📋 Setup Required:
• Add DOCKER_USERNAME secret to repository
• Add DOCKER_PASSWORD secret to repository  
• Create Dockerfile for Go app in project root
• Ensure infrastructure repo has 'my-api' deployment workflow
• ORG_TOKEN should already be available (organization default)

Next steps:
  $ git add .
  $ git commit -m "Add Docker build workflow for my-api"
  $ git push
  
  # On next push to main → builds Docker image → triggers dev deployment
```

## Personal Repository Flow
```bash
$ hungrimind kubernetes add docker-build my-api

✨ Adding Docker build workflow for 'my-api'

? Is this an organization repository or personal repository? Personal
? Build context directory: . 
? Docker registry username: my-username

📁 Creating build workflow...
✔ Created .github/workflows/my-api-build.yaml

🎉 Docker build workflow created successfully!

📋 Setup Required:
• Add DOCKER_USERNAME secret to repository
• Add DOCKER_PASSWORD secret to repository  
• Create Dockerfile for Go app in project root
• Ensure infrastructure repo has 'my-api' deployment workflow
• Add PAT secret to repository (Personal Access Token with repo scope)

Next steps:
  $ git add .
  $ git commit -m "Add Docker build workflow for my-api"
  $ git push
  
  # On next push to main → builds Docker image → triggers dev deployment
```

## Go Support Only
- Simple Docker build and push workflow
- Git SHA-based versioning
- Repository dispatch to trigger Kubernetes deployment
- No testing included (focus on simplicity)

## Integration Notes

### With `kubernetes add app`
- Must be run AFTER creating the Kubernetes app
- Validates that app exists and uses same naming
- Automatically configures repository dispatch event

### Repository Structure
- **App Repository**: Contains source code + Docker build workflow
- **Infrastructure Repository**: Contains Kubernetes manifests + deployment workflows
- Build workflow triggers deployment via repository dispatch

### Required Secrets

#### Organization Repositories
- `DOCKER_USERNAME` - Docker registry username
- `DOCKER_PASSWORD` - Docker registry token/password
- `ORG_TOKEN` - GitHub organization token (should be pre-configured)

#### Personal Repositories
- `DOCKER_USERNAME` - Docker registry username
- `DOCKER_PASSWORD` - Docker registry token/password
- `PAT` - Personal Access Token with repo scope

This creates a simple CI/CD pipeline for Go apps: Code push → Docker build → Kubernetes deployment! 