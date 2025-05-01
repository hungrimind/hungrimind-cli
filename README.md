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
@hungrimind/hungrimind-cli/0.0.8 linux-x64 node-v20.19.1
$ hungrimind --help [COMMAND]
USAGE
  $ hungrimind COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`hungrimind create flutter NAME`](#hungrimind-create-flutter-name)
* [`hungrimind help [COMMAND]`](#hungrimind-help-command)
* [`hungrimind login`](#hungrimind-login)

## `hungrimind create flutter NAME`

Create a new Flutter project with Hungrimind boilerplate

```
USAGE
  $ hungrimind create flutter NAME [-v]

ARGUMENTS
  NAME  Name of the Flutter application (lowercase with underscores, e.g., my_app)

FLAGS
  -v, --verbose  Enable verbose output for debugging

DESCRIPTION
  Create a new Flutter project with Hungrimind boilerplate
```

_See code: [src/commands/create/flutter.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.8/src/commands/create/flutter.ts)_

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

## `hungrimind login`

Authenticate with GitHub

```
USAGE
  $ hungrimind login

DESCRIPTION
  Authenticate with GitHub
```

_See code: [src/commands/login.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.8/src/commands/login.ts)_
<!-- commandsstop -->
