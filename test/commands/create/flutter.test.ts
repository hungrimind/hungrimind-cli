import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('create/flutter', () => {
  it('runs create/flutter cmd', async () => {
    const {stdout} = await runCommand('create/flutter')
    expect(stdout).to.contain('hello world')
  })

  it('runs create/flutter --name oclif', async () => {
    const {stdout} = await runCommand('create/flutter --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
