const HomeAMB = artifacts.require('HomeAMB.sol')
const ForeignAMB = artifacts.require('ForeignAMB.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const Box = artifacts.require('Box.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const { sign, ether, expectEventInLogs, getEvents } = require('../helpers/helpers')

const requiredBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
const twoEther = ether('2')
const ZERO = toBN(0)
const HOME_CHAIN_ID = 1337
const HOME_CHAIN_ID_HEX = `0x${HOME_CHAIN_ID.toString(16).padStart(4, '0')}`
const FOREIGN_CHAIN_ID = 1234567890
const FOREIGN_CHAIN_ID_HEX = `0x${FOREIGN_CHAIN_ID.toString(16).padStart(8, '0')}`

contract('HomeAMB', async accounts => {
  let validatorContract
  let authorities
  let owner
  let validatorsRequiredSignatures
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    validatorsRequiredSignatures = 1
    await validatorContract.initialize(validatorsRequiredSignatures, authorities, owner)
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async () => {
      const homeContract = await HomeAMB.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)

      const { major, minor, patch } = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const homeBridge = await HomeAMB.new()

      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await homeBridge.isInitialized()).to.be.equal(false)

      const { logs } = await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))
      expect(await homeBridge.owner()).to.be.equal(owner)
      expect(await homeBridge.isInitialized()).to.be.equal(true)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requiredBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
    })
    it('should fail with invalid arguments', async () => {
      const homeBridge = await HomeAMB.new()

      expect(await homeBridge.isInitialized()).to.be.equal(false)

      await homeBridge
        .initialize(
          '0x00',
          FOREIGN_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(
          FOREIGN_CHAIN_ID_HEX,
          FOREIGN_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(
          HOME_CHAIN_ID_HEX,
          FOREIGN_CHAIN_ID_HEX,
          ZERO_ADDRESS,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(
          HOME_CHAIN_ID_HEX,
          FOREIGN_CHAIN_ID_HEX,
          accounts[0],
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(HOME_CHAIN_ID_HEX, FOREIGN_CHAIN_ID_HEX, validatorContract.address, oneEther, gasPrice, 0, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(
          HOME_CHAIN_ID_HEX,
          FOREIGN_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          0,
          requiredBlockConfirmations,
          ZERO_ADDRESS
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        0,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      expect(await homeBridge.isInitialized()).to.be.equal(true)
    })
    it('can update variables', async () => {
      const alternativeGasPrice = web3.utils.toWei('2', 'gwei')
      const alternativeBlockConfirmations = 1
      const homeBridge = await HomeAMB.new()

      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))

      await homeBridge.setGasPrice(0).should.be.fulfilled
      await homeBridge.setRequiredBlockConfirmations(0).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setMaxGasPerTx(twoEther).should.be.fulfilled
      await homeBridge.setGasPrice(alternativeGasPrice).should.be.fulfilled
      await homeBridge.setRequiredBlockConfirmations(alternativeBlockConfirmations).should.be.fulfilled

      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(twoEther)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(alternativeGasPrice)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(alternativeBlockConfirmations))

      await homeBridge.setMaxGasPerTx(0).should.be.fulfilled
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)
    })
  })
  describe('upgradeable', async () => {
    it('can be upgraded', async () => {
      // homeBridge V1 Contract
      const homeBridgeV1 = await HomeAMB.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      const homeBridgeProxy = await HomeAMB.at(proxy.address)
      await homeBridgeProxy.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      // Deploy V2
      const homeBridgeV2 = await HomeAMB.new()
      await proxy.upgradeTo('2', homeBridgeV2.address).should.be.fulfilled

      homeBridgeV2.address.should.be.equal(await proxy.implementation())
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()

      const data = homeBridgeV1.contract.methods
        .initialize(
          HOME_CHAIN_ID_HEX,
          FOREIGN_CHAIN_ID_HEX,
          validatorContract.address,
          '1',
          '1',
          requiredBlockConfirmations,
          owner
        )
        .encodeABI()
      await proxy.upgradeToAndCall('1', homeBridgeV1.address, data).should.be.fulfilled

      const homeBridgeProxy = await HomeAMB.at(proxy.address)
      expect(await homeBridgeProxy.isInitialized()).to.be.equal(true)
    })
    it('can transfer ownership', async () => {
      // homeBridge V1 Contract
      const homeBridgeV1 = await HomeAMB.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      const homeBridgeProxy = await HomeAMB.at(proxy.address)
      await homeBridgeProxy.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled
      expect(await proxy.upgradeabilityOwner()).to.be.equal(owner)

      const newOwner = accounts[1]
      await proxy.transferProxyOwnership(newOwner).should.be.fulfilled
      expect(await proxy.upgradeabilityOwner()).to.be.equal(newOwner)
    })
  })
  describe('requireToPassMessage & requireToConfirmMessage', () => {
    let homeBridge
    let bridgeId
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      homeBridge = await HomeAMB.at(proxy.address)
      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )
      const paddedChainId = `0x${HOME_CHAIN_ID.toString(16).padStart(64, '0')}`
      bridgeId = web3.utils.soliditySha3(paddedChainId + homeBridge.address.slice(2)).slice(10, 50)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      const tx = await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        1535604485,
        { from: accounts[3] }
      )

      tx.receipt.logs.length.should.be.equal(1)
      const { messageId, encodedData } = tx.receipt.logs[0].args
      expect(messageId).to.include(`${bridgeId}0000000000000000`)
      expect(encodedData.substr(2 + (32 + 20 + 20 + 4 + 1 + 1) * 2, 2)).to.be.equal('00')
    })
    it('call requireToConfirmMessage(address, bytes, uint256)', async () => {
      const tx = await homeBridge.requireToConfirmMessage(
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        1535604485,
        { from: accounts[3] }
      )

      tx.receipt.logs.length.should.be.equal(1)
      const { messageId, encodedData } = tx.receipt.logs[0].args
      expect(messageId).to.include(`${bridgeId}0000000000000000`)
      expect(encodedData.substr(2 + (32 + 20 + 20 + 4 + 1 + 1) * 2, 2)).to.be.equal('80')
    })
    it('call requireToPassMessage(address, bytes, uint256) should fail', async () => {
      // Should fail because gas < minimumGasUsage
      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        10,
        { from: accounts[3] }
      ).should.be.rejectedWith(ERROR_MSG)

      // Should fail because gas > maxGasPerTx
      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        twoEther,
        { from: accounts[3] }
      ).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setMaxGasPerTx(ZERO).should.be.fulfilled
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)

      // Should fail because maxGasPerTx = 0 so gas > maxGasPerTx
      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        oneEther,
        { from: accounts[3] }
      ).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setMaxGasPerTx(oneEther).should.be.fulfilled
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)

      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        oneEther,
        { from: accounts[3] }
      ).should.be.fulfilled
    })
    it('should generate different message ids', async () => {
      const user = accounts[8]

      const resultPassMessageTx1 = await homeBridge.requireToPassMessage(accounts[7], '0x11223344', 221254, {
        from: user
      })
      const resultPassMessageTx2 = await homeBridge.requireToPassMessage(accounts[7], '0x11223344', 221254, {
        from: user
      })
      const resultPassMessageTx3 = await homeBridge.requireToPassMessage(accounts[7], '0x11223344', 221254, {
        from: user
      })

      const messageId1 = resultPassMessageTx1.logs[0].args.messageId
      const messageId2 = resultPassMessageTx2.logs[0].args.messageId
      const messageId3 = resultPassMessageTx3.logs[0].args.messageId
      expect(messageId1).to.include(`${bridgeId}0000000000000000`)
      expect(messageId2).to.include(`${bridgeId}0000000000000001`)
      expect(messageId3).to.include(`${bridgeId}0000000000000002`)
    })
  })
  describe('executeAffirmation', () => {
    let homeBridge
    let foreignBridge
    let setValueData
    let box
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      homeBridge = await HomeAMB.at(proxy.address)
      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      foreignBridge = await ForeignAMB.new()

      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      setValueData = await box.contract.methods.setValue(3).encodeABI()
    })
    it('should succeed on Subsidized mode', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 221254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        messageId,
        status: true
      })

      expect(await homeBridge.messageCallStatus(messageId)).to.be.equal(true)

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.txHash()).to.be.equal(messageId)
      expect(await homeBridge.messageSender()).to.be.equal(ZERO_ADDRESS)
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContractWith3Signatures.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args
      const msgHash = web3.utils.soliditySha3(message)

      const { logs } = await homeBridgeWithThreeSigs.executeAffirmation(message, {
        from: authoritiesFiveAccs[0],
        gasPrice
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      })

      const notProcessed = await homeBridgeWithThreeSigs.numAffirmationsSigned(msgHash)
      notProcessed.should.be.bignumber.equal('1')

      await homeBridgeWithThreeSigs
        .executeAffirmation(message, { from: authoritiesFiveAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      const secondSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {
        from: authoritiesFiveAccs[1],
        gasPrice
      }).should.be.fulfilled

      expectEventInLogs(secondSignature.logs, 'SignedForAffirmation', {
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {
        from: authoritiesFiveAccs[2],
        gasPrice
      }).should.be.fulfilled

      expectEventInLogs(thirdSignature.logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        messageId,
        status: true
      })

      const senderHash = web3.utils.soliditySha3(authoritiesFiveAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash))

      const senderHash2 = web3.utils.soliditySha3(authoritiesFiveAccs[1], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash2))

      const senderHash3 = web3.utils.soliditySha3(authoritiesFiveAccs[2], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash3))

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.txHash()).to.be.equal(messageId)
      expect(await homeBridge.messageSender()).to.be.equal(ZERO_ADDRESS)
    })
    it('should not allow to double execute', async () => {
      const user = accounts[8]

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        messageId,
        status: true
      })

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: authorities[1], gasPrice }).should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow non-authorities to execute affirmation', async () => {
      const user = accounts[8]

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData

      await homeBridge.executeAffirmation(message, { from: user, gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: accounts[7], gasPrice }).should.be.rejectedWith(ERROR_MSG)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      logs[1].event.should.be.equal('AffirmationCompleted')
    })
    it('status of AffirmationCompleted should be false on contract failed call', async () => {
      const user = accounts[8]

      const methodWillFailData = box.contract.methods.methodWillFail().encodeABI()

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, methodWillFailData, 141647, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        messageId,
        status: false
      })

      expect(await homeBridge.messageCallStatus(messageId)).to.be.equal(false)
      expect(await homeBridge.failedMessageDataHash(messageId)).to.be.equal(web3.utils.soliditySha3(methodWillFailData))
      expect(await homeBridge.failedMessageReceiver(messageId)).to.be.equal(box.address)
      expect(await homeBridge.failedMessageSender(messageId)).to.be.equal(user)

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: authorities[1], gasPrice }).should.be.rejectedWith(ERROR_MSG)
    })
    it('status of AffirmationCompleted should be false on contract out of gas call', async () => {
      const user = accounts[8]

      const methodOutOfGasData = box.contract.methods.methodOutOfGas().encodeABI()

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, methodOutOfGasData, 1000, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        messageId,
        status: false
      })

      expect(await homeBridge.messageCallStatus(messageId)).to.be.equal(false)
      expect(await homeBridge.failedMessageDataHash(messageId)).to.be.equal(web3.utils.soliditySha3(methodOutOfGasData))
      expect(await homeBridge.failedMessageReceiver(messageId)).to.be.equal(box.address)
      expect(await homeBridge.failedMessageSender(messageId)).to.be.equal(user)

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: authorities[1], gasPrice }).should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow to process messages with different version', async () => {
      const user = accounts[8]

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = `0x99${encodedData.slice(4)}`

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejected
    })
    it('should not allow to process messages with different destination chain id', async () => {
      const user = accounts[8]

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData

      await homeBridge.setChainIds(FOREIGN_CHAIN_ID_HEX, HOME_CHAIN_ID_HEX)

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejected
    })
    it('should not allow to pass message back through the bridge', async () => {
      const user = accounts[8]

      const data = await homeBridge.contract.methods.requireToPassMessage(box.address, setValueData, 100000).encodeABI()
      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(homeBridge.address, data, 821254, {
        from: user
      })

      const { encodedData: message, messageId } = resultPassMessageTx.logs[0].args

      await homeBridge.executeAffirmation(message, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled

      // means that call to requireToPassMessage inside MessageProcessor reverted, since messageId flag was set up
      expect(await homeBridge.messageCallStatus(messageId)).to.be.equal(false)
    })
    it('should allow to pass message back through the bridge if configured', async () => {
      const user = accounts[8]
      await homeBridge.setAllowReentrantRequests(true, { from: user }).should.be.rejected
      await homeBridge.setAllowReentrantRequests(true, { from: owner }).should.be.fulfilled
      expect(await homeBridge.allowReentrantRequests()).to.be.equal(true)

      const data = await homeBridge.contract.methods.requireToPassMessage(box.address, setValueData, 100000).encodeABI()
      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(homeBridge.address, data, 821254, {
        from: user
      })

      const { encodedData: message, messageId } = resultPassMessageTx.logs[0].args

      await homeBridge.executeAffirmation(message, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled

      expect(await homeBridge.messageCallStatus(messageId)).to.be.equal(true)
    })
  })
  describe('submitSignature', () => {
    let homeBridge
    let setValueData
    let box
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      homeBridge = await HomeAMB.at(proxy.address)
      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      setValueData = await box.contract.methods.setValue(3).encodeABI()
    })
    it('allows a validator to submit a signature', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData
      const signature = await sign(authorities[0], message)
      const msgHash = web3.utils.soliditySha3(message)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be
        .fulfilled
      expectEventInLogs(logs, 'SignedForUserRequest', {
        signer: authorities[0],
        messageHash: msgHash
      })

      const signatureFromContract = await homeBridge.signature(msgHash, 0)
      const messageFromContract = await homeBridge.message(msgHash)
      signature.should.be.equal(signatureFromContract)
      messageFromContract.should.be.equal(message)

      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authorities[0])
      logs[1].args.messageHash.should.be.equal(msgHash)
      logs[1].args.NumberOfCollectedSignatures.should.be.bignumber.equal(toBN(validatorsRequiredSignatures))

      const hashMsg = web3.utils.soliditySha3(message)
      const hashSenderMsg = web3.utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridge.messagesSigned(hashSenderMsg))
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContractWith3Signatures.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      const user = accounts[8]

      const resultPassMessageTx = await homeBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        { from: user }
      )

      const message = resultPassMessageTx.logs[0].args.encodedData
      const signature1 = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const msgHash = web3.utils.soliditySha3(message)

      const { logs } = await homeBridgeWithThreeSigs.submitSignature(signature1, message, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForUserRequest', {
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      })

      const secondSignature = await homeBridgeWithThreeSigs.submitSignature(signature2, message, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      expectEventInLogs(secondSignature.logs, 'SignedForUserRequest', {
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled
      expectEventInLogs(thirdSignature.logs, 'SignedForUserRequest', {
        signer: authoritiesFiveAccs[2],
        messageHash: msgHash
      })

      const messageFromContract = await homeBridgeWithThreeSigs.message(msgHash)
      messageFromContract.should.be.equal(message)

      const signature1FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 0)
      signature1.should.be.equal(signature1FromContract)

      const signature2FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 1)
      signature2.should.be.equal(signature2FromContract)

      const signature3FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 2)
      signature3.should.be.equal(signature3FromContract)

      thirdSignature.logs[1].event.should.be.equal('CollectedSignatures')
      thirdSignature.logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
      thirdSignature.logs[1].args.messageHash.should.be.equal(msgHash)
      thirdSignature.logs[1].args.NumberOfCollectedSignatures.should.be.bignumber.equal('3')
    })
    it('should not allow to double submit', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData
      const signature = await sign(authorities[0], message)
      const signature2 = await sign(authorities[1], message)

      // can't submit signature with other validator signature
      await homeBridge.submitSignature(signature2, message, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForUserRequest')
      logs[1].event.should.be.equal('CollectedSignatures')

      await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.submitSignature(signature2, message, { from: authorities[1] }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow non-authorities to submit signatures', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData

      const signature = await sign(authorities[0], message)
      const userSignature = await sign(user, message)
      const user2Signature = await sign(accounts[7], message)

      await homeBridge.submitSignature(userSignature, message, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.submitSignature(user2Signature, message, { from: accounts[7] }).should.be.rejectedWith(ERROR_MSG)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForUserRequest')
      logs[1].event.should.be.equal('CollectedSignatures')
    })
  })
  describe('setChainIds', async () => {
    let homeContract
    const srcChainIdLengthStorageKey = web3.utils.soliditySha3(
      '0xe504ae1fd6471eea80f18b8532a61a9bb91fba4f5b837f80a1cfb6752350af44' +
        '0000000000000000000000000000000000000000000000000000000000000000'
    )
    const dstChainIdLengthStorageKey = web3.utils.soliditySha3(
      '0xfb792ae4ad11102b93f26a51b3749c2b3667f8b561566a4806d4989692811594' +
        '0000000000000000000000000000000000000000000000000000000000000000'
    )
    beforeEach(async () => {
      homeContract = await HomeAMB.new()
      await homeContract.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled
    })

    it('should allow to set chain id', async () => {
      expect(await homeContract.sourceChainId()).to.be.bignumber.equal(HOME_CHAIN_ID.toString())
      expect(await web3.eth.getStorageAt(homeContract.address, srcChainIdLengthStorageKey)).to.be.equal('0x02')
      expect(await homeContract.destinationChainId()).to.be.bignumber.equal(FOREIGN_CHAIN_ID.toString())
      expect(await web3.eth.getStorageAt(homeContract.address, dstChainIdLengthStorageKey)).to.be.equal('0x04')

      const newSrcChainId = '0x11000000000000'
      const newDstChainId = '0x22000000000000000000000000'
      await homeContract.setChainIds(newSrcChainId, newDstChainId, { from: owner }).should.be.fulfilled

      expect((await homeContract.sourceChainId()).toString(16)).to.be.equal(newSrcChainId.slice(2))
      expect(await web3.eth.getStorageAt(homeContract.address, srcChainIdLengthStorageKey)).to.be.equal('0x07')
      expect((await homeContract.destinationChainId()).toString(16)).to.be.equal(newDstChainId.slice(2))
      expect(await web3.eth.getStorageAt(homeContract.address, dstChainIdLengthStorageKey)).to.be.equal('0x0d')
    })

    it('should not allow to set invalid chain ids', async () => {
      await homeContract.setChainIds('0x00', '0x01', { from: owner }).should.be.rejected
      await homeContract.setChainIds('0x1122', '0x00', { from: owner }).should.be.rejected
      await homeContract.setChainIds('0x01', '0x01', { from: owner }).should.be.rejected
      await homeContract.setChainIds('0x1122', '0x1122', { from: owner }).should.be.rejected
    })

    it('should not allow to set chain id if not an owner', async () => {
      await homeContract.setChainIds('0x112233', '0x4455', { from: accounts[1] }).should.be.rejected
    })
  })
  describe('async information retrieval', () => {
    let homeContract
    let box
    let data

    const ethCallSelector = web3.utils.soliditySha3('eth_call(address,bytes)')

    beforeEach(async () => {
      homeContract = await HomeAMB.new()
      await homeContract.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        1000000,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled
      box = await Box.new()
      data = web3.eth.abi.encodeParameters(
        ['address', 'bytes'],
        [accounts[1], box.contract.methods.value().encodeABI()]
      )
    })

    it('should enable new selector', async () => {
      await homeContract.enableAsyncRequestSelector(ethCallSelector, true, { from: accounts[1] }).should.be.rejected
      await homeContract.enableAsyncRequestSelector(ethCallSelector, true, { from: owner }).should.be.fulfilled

      expect(await homeContract.isAsyncRequestSelectorEnabled(ethCallSelector)).to.be.equal(true)
    })

    it('should allow to request information from the other chain', async () => {
      await homeContract.requireToGetInformation(ethCallSelector, data).should.be.rejected
      await box.makeAsyncCall(homeContract.address, ethCallSelector, data).should.be.rejected
      await homeContract.enableAsyncRequestSelector(ethCallSelector, true).should.be.fulfilled
      await box.makeAsyncCall(homeContract.address, ethCallSelector, data).should.be.fulfilled

      const events = await getEvents(homeContract, { event: 'UserRequestForInformation' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.sender).to.be.equal(box.address)
      expect(events[0].returnValues.requestSelector).to.be.equal(ethCallSelector)
      expect(events[0].returnValues.data).to.be.equal(data)
    })

    it('should accept confirmations from a single validator', async () => {
      await homeContract.enableAsyncRequestSelector(ethCallSelector, true).should.be.fulfilled
      await box.makeAsyncCall(homeContract.address, ethCallSelector, data).should.be.fulfilled
      const events = await getEvents(homeContract, { event: 'UserRequestForInformation' })
      expect(events.length).to.be.equal(1)
      const { messageId } = events[0].returnValues
      const result = '0x0000000000000000000000000000000000000000000000000000000000000005'

      await homeContract.confirmInformation(messageId, true, result, { from: owner }).should.be.rejected
      const { logs } = await homeContract.confirmInformation(messageId, true, result, { from: authorities[0] }).should
        .be.fulfilled
      await homeContract.confirmInformation(messageId, true, result, { from: authorities[0] }).should.be.rejected
      await homeContract.confirmInformation(messageId, true, result, { from: authorities[1] }).should.be.rejected
      logs[0].event.should.be.equal('SignedForInformation')
      expectEventInLogs(logs, 'InformationRetrieved', {
        messageId,
        status: true,
        callbackStatus: true
      })

      expect(await box.data()).to.be.equal(result)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.status()).to.be.equal(true)
    })
    it('should accept confirmations from 2-of-3 validators', async () => {
      await homeContract.enableAsyncRequestSelector(ethCallSelector, true).should.be.fulfilled
      await validatorContract.setRequiredSignatures(2).should.be.fulfilled

      await box.makeAsyncCall(homeContract.address, ethCallSelector, data).should.be.fulfilled
      const events = await getEvents(homeContract, { event: 'UserRequestForInformation' })
      expect(events.length).to.be.equal(1)
      const { messageId } = events[0].returnValues
      const result = '0x0000000000000000000000000000000000000000000000000000000000000005'

      const { logs: logs1 } = await homeContract.confirmInformation(messageId, true, result, { from: authorities[0] })
        .should.be.fulfilled
      const { logs: logs2 } = await homeContract.confirmInformation(messageId, true, result, { from: authorities[1] })
        .should.be.fulfilled
      logs1[0].event.should.be.equal('SignedForInformation')
      logs2[0].event.should.be.equal('SignedForInformation')

      expectEventInLogs(logs2, 'InformationRetrieved', {
        messageId,
        status: true,
        callbackStatus: true
      })

      expect(await box.data()).to.be.equal(result)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.status()).to.be.equal(true)
    })
    it('should process failed calls', async () => {
      await homeContract.enableAsyncRequestSelector(ethCallSelector, true).should.be.fulfilled
      await validatorContract.setRequiredSignatures(1).should.be.fulfilled

      await box.makeAsyncCall(homeContract.address, ethCallSelector, data).should.be.fulfilled
      const events = await getEvents(homeContract, { event: 'UserRequestForInformation' })
      expect(events.length).to.be.equal(1)
      const { messageId } = events[0].returnValues
      const result = '0x0000000000000000000000000000000000000000000000000000000000000005'

      const { logs } = await homeContract.confirmInformation(messageId, false, result, { from: authorities[0] }).should
        .be.fulfilled
      logs[0].event.should.be.equal('SignedForInformation')
      expectEventInLogs(logs, 'InformationRetrieved', {
        messageId,
        status: false,
        callbackStatus: true
      })

      expect(await box.data()).to.be.equal(result)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.status()).to.be.equal(false)
    })
  })
  describe('requestMessageReconfirm', () => {
    let homeBridge
    let box
    let validatorContract
    let message
    let msgHash

    const user = accounts[8]

    beforeEach(async () => {
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled
      homeBridge = await HomeAMB.at(proxy.address)

      validatorContract = await BridgeValidators.new()
      await validatorContract.initialize(1, [accounts[1]], owner)

      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      box = await Box.new()

      const setValueData = box.contract.methods.setValue(3).encodeABI()
      const res = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, { from: user })
      message = res.logs[0].args.encodedData
      msgHash = web3.utils.soliditySha3(message)
    })

    it('should request and process message reconfirmations when required threshold is changed', async () => {
      const signature1 = await sign(accounts[1], message)

      await homeBridge.submitSignature(signature1, message, { from: accounts[1] }).should.be.fulfilled
      await homeBridge.requestMessageReconfirm(message).should.be.rejected
      await validatorContract.addValidator(accounts[2]).should.be.fulfilled
      await validatorContract.setRequiredSignatures(2).should.be.fulfilled
      const { logs } = await homeBridge.requestMessageReconfirm(message).should.be.fulfilled
      expectEventInLogs(logs, 'UserRequestForSignature', {
        messageId: message.slice(0, 66),
        encodedData: message
      })

      expect(await homeBridge.message(msgHash)).to.be.equal(message)
      expect(await homeBridge.signature(msgHash, 0)).to.be.equal(signature1)
      expect(await homeBridge.numMessagesSigned(msgHash)).to.be.bignumber.equal('1')

      const signature2 = await sign(accounts[2], message)
      await homeBridge.submitSignature(signature2, message, { from: accounts[2] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: accounts[2] }).should.be.rejected

      expect(await homeBridge.signature(msgHash, 0)).to.be.equal(signature1)
      expect(await homeBridge.signature(msgHash, 1)).to.be.equal(signature2)
      expect(await homeBridge.numMessagesSigned(msgHash)).to.be.bignumber.gt('10000')

      expect(await homeBridge.messagesSigned(web3.utils.soliditySha3(accounts[1], msgHash))).to.be.equal(true)
      expect(await homeBridge.messagesSigned(web3.utils.soliditySha3(accounts[2], msgHash))).to.be.equal(true)
    })

    it('should request and process message reconfirmations when validator is removed', async () => {
      const signature1 = await sign(accounts[1], message)

      await homeBridge.submitSignature(signature1, message, { from: accounts[1] }).should.be.fulfilled
      await homeBridge.requestMessageReconfirm(message).should.be.rejected
      await validatorContract.addValidator(accounts[2]).should.be.fulfilled
      await validatorContract.removeValidator(accounts[1]).should.be.fulfilled
      const { logs } = await homeBridge.requestMessageReconfirm(message).should.be.fulfilled
      expectEventInLogs(logs, 'UserRequestForSignature', {
        messageId: message.slice(0, 66),
        encodedData: message
      })

      expect(await homeBridge.message(msgHash)).to.be.equal(message)
      expect(await homeBridge.signature(msgHash, 0)).to.be.equal(signature1)
      expect(await homeBridge.numMessagesSigned(msgHash)).to.be.bignumber.equal('0')

      const signature2 = await sign(accounts[2], message)
      await homeBridge.submitSignature(signature2, message, { from: accounts[2] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: accounts[2] }).should.be.rejected

      expect(await homeBridge.signature(msgHash, 0)).to.be.equal(signature2)
      expect(await homeBridge.numMessagesSigned(msgHash)).to.be.bignumber.gt('10000')

      expect(await homeBridge.messagesSigned(web3.utils.soliditySha3(accounts[1], msgHash))).to.be.equal(false)
      expect(await homeBridge.messagesSigned(web3.utils.soliditySha3(accounts[2], msgHash))).to.be.equal(true)
    })
  })
})
