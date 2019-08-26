const { web3Home, web3Foreign } = require('../web3')
const { ERC20_TOKEN_ADDRESS, HOME_AMB_BRIDGE, FOREIGN_AMB_BRIDGE } = require('../loadEnv')
const { isContract } = require('../deploymentUtils')

async function preDeploy() {
  const isERC20AContract = await isContract(web3Foreign, ERC20_TOKEN_ADDRESS)
  if (!isERC20AContract) {
    throw new Error(`ERC20_TOKEN_ADDRESS should be a contract address`)
  }

  const isHomeAMBAContract = await isContract(web3Home, HOME_AMB_BRIDGE)
  if (!isHomeAMBAContract) {
    throw new Error(`HOME_AMB_BRIDGE should be a contract address`)
  }

  const isForeignAMBAContract = await isContract(web3Foreign, FOREIGN_AMB_BRIDGE)
  if (!isForeignAMBAContract) {
    throw new Error(`FOREIGN_AMB_BRIDGE should be a contract address`)
  }
}

module.exports = preDeploy
