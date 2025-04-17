hungrimind-cli
=================

A CLI created by the people over at Hungrimind


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/hungrimind-cli.svg)](https://npmjs.org/package/hungrimind-cli)
[![Downloads/week](https://img.shields.io/npm/dw/hungrimind-cli.svg)](https://npmjs.org/package/hungrimind-cli)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g hungrimind-cli
$ hungrimind COMMAND
running command...
$ hungrimind (--version)
hungrimind-cli/0.0.0 darwin-arm64 node-v23.6.0
$ hungrimind --help [COMMAND]
USAGE
  $ hungrimind COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`hungrimind hello PERSON`](#hungrimind-hello-person)
* [`hungrimind hello world`](#hungrimind-hello-world)
* [`hungrimind help [COMMAND]`](#hungrimind-help-command)
* [`hungrimind plugins`](#hungrimind-plugins)
* [`hungrimind plugins add PLUGIN`](#hungrimind-plugins-add-plugin)
* [`hungrimind plugins:inspect PLUGIN...`](#hungrimind-pluginsinspect-plugin)
* [`hungrimind plugins install PLUGIN`](#hungrimind-plugins-install-plugin)
* [`hungrimind plugins link PATH`](#hungrimind-plugins-link-path)
* [`hungrimind plugins remove [PLUGIN]`](#hungrimind-plugins-remove-plugin)
* [`hungrimind plugins reset`](#hungrimind-plugins-reset)
* [`hungrimind plugins uninstall [PLUGIN]`](#hungrimind-plugins-uninstall-plugin)
* [`hungrimind plugins unlink [PLUGIN]`](#hungrimind-plugins-unlink-plugin)
* [`hungrimind plugins update`](#hungrimind-plugins-update)

## `hungrimind hello PERSON`

Say hello

```
USAGE
  $ hungrimind hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ hungrimind hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.0/src/commands/hello/index.ts)_

## `hungrimind hello world`

Say hello world

```
USAGE
  $ hungrimind hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ hungrimind hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/hungrimind/hungrimind-cli/blob/v0.0.0/src/commands/hello/world.ts)_

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

## `hungrimind plugins`

List installed plugins.

```
USAGE
  $ hungrimind plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ hungrimind plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/index.ts)_

## `hungrimind plugins add PLUGIN`

Installs a plugin into hungrimind.

```
USAGE
  $ hungrimind plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into hungrimind.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the HUNGRIMIND_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the HUNGRIMIND_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ hungrimind plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ hungrimind plugins add myplugin

  Install a plugin from a github url.

    $ hungrimind plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ hungrimind plugins add someuser/someplugin
```

## `hungrimind plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ hungrimind plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ hungrimind plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/inspect.ts)_

## `hungrimind plugins install PLUGIN`

Installs a plugin into hungrimind.

```
USAGE
  $ hungrimind plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into hungrimind.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the HUNGRIMIND_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the HUNGRIMIND_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ hungrimind plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ hungrimind plugins install myplugin

  Install a plugin from a github url.

    $ hungrimind plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ hungrimind plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/install.ts)_

## `hungrimind plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ hungrimind plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ hungrimind plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/link.ts)_

## `hungrimind plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ hungrimind plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ hungrimind plugins unlink
  $ hungrimind plugins remove

EXAMPLES
  $ hungrimind plugins remove myplugin
```

## `hungrimind plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ hungrimind plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/reset.ts)_

## `hungrimind plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ hungrimind plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ hungrimind plugins unlink
  $ hungrimind plugins remove

EXAMPLES
  $ hungrimind plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/uninstall.ts)_

## `hungrimind plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ hungrimind plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ hungrimind plugins unlink
  $ hungrimind plugins remove

EXAMPLES
  $ hungrimind plugins unlink myplugin
```

## `hungrimind plugins update`

Update installed plugins.

```
USAGE
  $ hungrimind plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/update.ts)_
<!-- commandsstop -->
