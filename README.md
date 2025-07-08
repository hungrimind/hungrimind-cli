hungrimind-cli
=================

A CLI created by the people over at Hungrimind


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/hungrimind-cli.svg)](https://npmjs.org/package/@hungrimind/hungrimind-cli)
[![Downloads/week](https://img.shields.io/npm/dw/hungrimind-cli.svg)](https://npmjs.org/package/@hungrimind/hungrimind-cli)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @hungrimind/hungrimind-cli
$ hungrimind COMMAND
running command...
$ hungrimind (--version)
@hungrimind/hungrimind-cli/0.0.13 linux-x64 node-v20.19.3
$ hungrimind --help [COMMAND]
USAGE
  $ hungrimind COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`hungrimind flutter create NAME`](#hungrimind-flutter-create-name)
* [`hungrimind help [COMMAND]`](#hungrimind-help-command)
* [`hungrimind kubernetes add app`](#hungrimind-kubernetes-add-app)
* [`hungrimind kubernetes configure [DIRECTORY]`](#hungrimind-kubernetes-configure-directory)
* [`hungrimind kubernetes create NAME`](#hungrimind-kubernetes-create-name)
* [`hungrimind kubernetes install [DIRECTORY]`](#hungrimind-kubernetes-install-directory)
* [`hungrimind login`](#hungrimind-login)

## `hungrimind flutter create NAME`

Create a new Flutter project with the Hungrimind Flutter Kit

```
USAGE
  $ hungrimind flutter create NAME [-v]

ARGUMENTS
  NAME  Name of the Flutter application (lowercase with underscores, e.g., my_app)

FLAGS
  -v, --verbose  Enable verbose output for debugging

DESCRIPTION
  Create a new Flutter project with the Hungrimind Flutter Kit
```

_See code: [src/commands/flutter/create.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.13/src/commands/flutter/create.ts)_

## `hungrimind help [COMMAND]`

Display help for hungrimind.

```
USAGE
  $ hungrimind help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for hungrimind.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.27/src/commands/help.ts)_

## `hungrimind kubernetes add app`

Create a new Kubernetes app with Helm chart and GitHub Actions workflow

```
USAGE
  $ hungrimind kubernetes add app

DESCRIPTION
  Create a new Kubernetes app with Helm chart and GitHub Actions workflow

EXAMPLES
  $ hungrimind kubernetes add app
```

_See code: [src/commands/kubernetes/add/app.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.13/src/commands/kubernetes/add/app.ts)_

## `hungrimind kubernetes configure [DIRECTORY]`

Configure placeholders in a Kubernetes project (allows skipping any placeholder)

```
USAGE
  $ hungrimind kubernetes configure [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] The directory of the Kubernetes project to configure.

DESCRIPTION
  Configure placeholders in a Kubernetes project (allows skipping any placeholder)
```

_See code: [src/commands/kubernetes/configure.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.13/src/commands/kubernetes/configure.ts)_

## `hungrimind kubernetes create NAME`

Create a new Kubernetes project with the Hungrimind Kubernetes Kit and configure required settings

```
USAGE
  $ hungrimind kubernetes create NAME [-v]

ARGUMENTS
  NAME  Name of the Kubernetes folder (lowercase with underscores, e.g., hungrimind_infrastructure)

FLAGS
  -v, --verbose  Enable verbose output for debugging

DESCRIPTION
  Create a new Kubernetes project with the Hungrimind Kubernetes Kit and configure required settings
```

_See code: [src/commands/kubernetes/create.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.13/src/commands/kubernetes/create.ts)_

## `hungrimind kubernetes install [DIRECTORY]`

Install/deploy a Kubernetes project after validating required configuration

```
USAGE
  $ hungrimind kubernetes install [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] The directory of the Kubernetes project to install.

DESCRIPTION
  Install/deploy a Kubernetes project after validating required configuration
```

_See code: [src/commands/kubernetes/install.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.13/src/commands/kubernetes/install.ts)_

## `hungrimind login`

Authenticate with GitHub

```
USAGE
  $ hungrimind login

DESCRIPTION
  Authenticate with GitHub
```

_See code: [src/commands/login.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.13/src/commands/login.ts)_
<!-- commandsstop -->
