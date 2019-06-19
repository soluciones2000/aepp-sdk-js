/* eslint-disable */
import { before, describe } from 'mocha'
import { configure, internalUrl, ready, url } from '.'
import { generateKeyPair } from '../../es/utils/crypto'
import { BASE_VERIFICATION_SCHEMA, SIGNATURE_VERIFICATION_SCHEMA } from '../../es/tx/builder/schema'
import { getContractInstance } from '../../es/contract/aci'
import { account } from './index'
import { UniversalWithAccounts } from '../../es/ae/universal'
import MemoryAccount from '../../es/account/memory'

const WARNINGS = [...SIGNATURE_VERIFICATION_SCHEMA, ...BASE_VERIFICATION_SCHEMA].reduce((acc, [msg, v, error]) => error.type === 'warning' ? [...acc, error.txKey] : acc, [])
const ERRORS = [...BASE_VERIFICATION_SCHEMA, ...SIGNATURE_VERIFICATION_SCHEMA,].reduce((acc, [msg, v, error]) => error.type === 'error' ? [...acc, error.txKey] : acc, [])
const stateContract = `
contract StateContract =
  record state = { value: string }
  public function init(value) : state = { value = value }
  public function retrieve() : string = state.value
`
describe('Verify Transaction', function () {
  configure(this)
  let client

  before(async () => {
    client = await ready(this)
    await client.spend(1234, 'ak_LAqgfAAjAbpt4hhyrAfHyVg9xfVQWsk1kaHaii6fYXt6AJAGe')
  })
  it('validate params', async () => {
    return client.spendTx({}).should.be.rejectedWith({
      code: 'TX_BUILD_VALIDATION_ERROR',
      msg: 'Validation error'
    })
  })
  it('check warnings', async () => {
    const spendTx = await client.spendTx({
      senderId: await client.address(),
      recipientId: await client.address(),
      amount: '1242894753985394725983479583427598237459328752353245345',
      nonce: '100',
      ttl: 2,
      absoluteTtl: true
    })

    const { validation } = await client.unpackAndVerify(spendTx)
    const warning = validation
      .filter(({ type }) => type === 'warning')
      .map(({ txKey }) => txKey)

    JSON.stringify(WARNINGS).should.be.equals(JSON.stringify(warning))
  })
  it('check errors', async () => {
    const spendTx = await client.spendTx({
      senderId: await client.address(),
      recipientId: await client.address(),
      amount: 1,
      fee: '1000',
      nonce: '1',
      ttl: 2,
      absoluteTtl: true
    })

    client.setKeypair(generateKeyPair())
    // Sign using another account
    const signedTx = await client.signTransaction(spendTx)

    const { validation } = await client.unpackAndVerify(signedTx)
    const error = validation
      .filter(({ type, txKey }) => type === 'error') // exclude contract vm/abi, has separated test for it
      .map(({ txKey }) => txKey)

    JSON.stringify(ERRORS.filter(e => e !== 'gasPrice' && e !== 'ctVersion')).should.be.equals(JSON.stringify(error))
  })
  it('verify transaction before broadcast', async () => {
    client = await ready(this)
    const spendTx = await client.spendTx({
      senderId: await client.address(),
      recipientId: await client.address(),
      amount: 1,
      ttl: 2,
      absoluteTtl: true
    })

    try {
      await client.send(spendTx, { verify: true })
    } catch ({ errorData }) {
      const atLeastOneError = !!errorData.validation.length
      atLeastOneError.should.be.equal(true)
    }
  })
  it('Verify vmVersion/abiVersion for contract transactions', async () => {
    // Contract create transaction with wrong abi/vm version (vm: 3, abi: 0)
    const contractCreateTx = 'tx_+QSaKgGhASLDuRmSBJZv91HE219uqXb2L0adh+bilzBWUi93m5blArkD+PkD9UYCoI2tdssfNdXZOclcaOwkTNB2S/SXIVsLDi7KUoxJ3Jki+QL7+QEqoGjyZ2M4/1CIOaukd0nv+ovofvKE8gf7PZmYcBzVOIfFhG1haW64wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACg//////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPkBy6C5yVbyizFJqfWYeqUF89obIgnMVzkjQAYrtsG9n5+Z6oRpbml0uGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//////////////////////////////////////////+5AUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAP//////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////////////////////////////////////7jMYgAAZGIAAISRgICAUX+5yVbyizFJqfWYeqUF89obIgnMVzkjQAYrtsG9n5+Z6hRiAADAV1CAUX9o8mdjOP9QiDmrpHdJ7/qL6H7yhPIH+z2ZmHAc1TiHxRRiAACvV1BgARlRAFtgABlZYCABkIFSYCCQA2ADgVKQWWAAUVlSYABSYADzW2AAgFJgAPNbWVlgIAGQgVJgIJADYAAZWWAgAZCBUmAgkANgA4FSgVKQVltgIAFRUVlQgJFQUICQUJBWW1BQgpFQUGIAAIxWhTIuMS4wgwMAAIcF9clYKwgAAAAAgxgX+IQ7msoAuGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAILnJVvKLMUmp9Zh6pQXz2hsiCcxXOSNABiu2wb2fn5nqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABkansY'
    const { validation } = await client.unpackAndVerify(contractCreateTx)
    const vmAbiError = validation.find(el => el.txKey === 'ctVersion')
    vmAbiError.msg.split(',')[0].should.be.equal('Wrong abi/vm version')
  })
  it('test', async () => {
    const url = process.env.TEST_URL || 'http://localhost:3013'
    const internalUrl = process.env.TEST_INTERNAL_URL || 'http://localhost:3113'
    const compilerUrl = process.env.COMPILER_URL || 'http://localhost:3080'
    const client = await UniversalWithAccounts({
      url, internalUrl, process, compilerUrl,
      accounts: [MemoryAccount({ keypair: account })],
      address: account.publicKey
    })
    const contractInstance = await getContractInstance(stateContract, { client })
    await contractInstance.addAccount(MemoryAccount({
      keypair: {
        publicKey: 'ak_2a1j2Mk9YSmC1gioUq4PWRm3bsv887MbuRVwyv4KaUGoR1eiKi',
        secretKey: 'e6a91d633c77cf5771329d3354b3bcef1bc5e032c43d70b6d35af923ce1eb74dcea7ade470c9f99d9d4e400880a86f1d49bb444b62f11a9ebb64bbcfeb73fef3'
      }
    }))
    console.log(await contractInstance.methods.init('Test'))

    // console.log(await contractInstance.methods.retrieve())
    // console.log('--------------------------------')
    // console.log(await contractInstance.methods.retrieve.send({ forAccount: 'ak_2a1j2Mk9YSmC1gioUq4PWRm3bsv887MbuRVwyv4KaUGoR1eiKi' }))
    // console.log('--------------------------------')
    console.log(await contractInstance.methods.retrieve.get({ forAccount: 'ak_2a1j2Mk9YSmC1gioUq4PWRm3bsv887MbuRVwyv4KaUGoR1eiKi', top: 26226 }))
  })
})
