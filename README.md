[![Join the chat at https://gitter.im/poanetwork/poa-bridge](https://badges.gitter.im/poanetwork/poa-bridge.svg)](https://gitter.im/poanetwork/poa-bridge?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://github.com/poanetwork/tokenbridge-contracts/workflows/tokenbridge-contracts/badge.svg?branch=master)](https://github.com/poanetwork/tokenbridge-contracts/workflows/tokenbridge-contracts/badge.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/poanetwork/tokenbridge-contracts/badge.svg?branch=master)](https://coveralls.io/github/poanetwork/tokenbridge-contracts?branch=master)

# POA Bridge Smart Contracts
These contracts provide the core functionality for the POA bridge. They implement the logic to relay assests between two EVM-based blockchain networks. The contracts collect bridge validator's signatures to approve and facilitate relay operations.

The POA bridge smart contracts are intended to work with [the bridge process implemented on NodeJS](https://github.com/poanetwork/token-bridge).
Please refer to the bridge process documentation to configure and deploy the bridge.

## Bridge Overview

The POA Bridge allows users to transfer assets between two chains in the Ethereum ecosystem. It is composed of several elements which are located in different POA Network repositories:

**Bridge Elements**
1. Solidity smart contracts, contained in this repository.
2. [TokenBridge](https://github.com/poanetwork/tokenbridge). A NodeJS oracle responsible for listening to events and sending transactions to authorize asset transfers.
3. [Bridge UI Application](https://github.com/poanetwork/bridge-ui). A DApp interface to transfer tokens and coins between chains.
4. [Bridge Monitor](https://github.com/poanetwork/bridge-monitor). A tool for checking balances and unprocessed events in bridged networks.
5. [Bridge Deployment Playbooks](https://github.com/poanetwork/deployment-bridge). Manages configuration instructions for remote deployments.

## Bridge Smart Contracts Summary

### Operations

Currently, the contracts support four types of relay operations:
* Tokenize the native coin in one blockchain network (Home) into an ERC20 token in another network (Foreign).
* Swap a token presented by an existing ERC20 contract in a Foreign network into an ERC20 token in the Home network, where one pair of bridge contracts corresponds to one pair of ERC20 tokens.
* to mint new native coins in Home blockchain network from a token presented by an existing ERC20 contract in a Foreign network.
* Transfer arbitrary data between two blockchain networks as so the data could be interpreted as an arbitrary contract method invocation.

### Components

The POA bridge contracts consist of several components:
* The **Home Bridge** smart contract. This is currently deployed in POA.Network.
* The **Foreign Bridge** smart contract. This is deployed in the Ethereum Mainnet.
* Depending on the type of relay operations the following components are also used:
  * in `AMB-ERC-TO-ERC` mode: the ERC20 token (in fact, the ERC677 extension is used) is deployed on the Home network;
  * in `ERC-TO-NATIVE` mode: The home network nodes must support consensus engine that allows using a smart contract for block reward calculation;
* The **Validators** smart contract is deployed in both the POA.Network and the Ethereum Mainnet.

### Bridge Roles and Responsibilities

Responsibilities and roles of the bridge:
- **Administrator** role (representation of a multisig contract):
  - add/remove validators
  - set daily limits on both bridges
  - set maximum per transaction limit on both bridges
  - set minimum per transaction limit on both bridges
  - upgrade contracts in case of vulnerability
  - set minimum required signatures from validators in order to relay a user's transaction
- **Validator** role:
  - provide 100% uptime to relay transactions
  - listen for `UserRequestForSignature` events on Home Bridge and sign an approval to relay assets on Foreign network
  - listen for `CollectedSignatures` events on Home Bridge. As soon as enough signatures are collected, transfer all collected signatures to the Foreign Bridge contract.
  - listen for `UserRequestForAffirmation` or `Transfer` (depending on the bridge mode) events on the Foreign Bridge and send approval to Home Bridge to relay assets from Foreign Network to Home
- **User** role:
  - sends assets to Bridge contracts:
    - in `ERC-TO-NATIVE` mode: send ERC20 tokens to the Foreign Bridge to receive native coins from the Home Bridge, send native coins to the Home Bridge to unlock ERC20 tokens from the Foreign Bridge;
    - in `ARBITRARY-MESSAGE` mode: Invoke Home/Foreign Bridge to send a message that will be executed on the other Network as an arbitrary contract method invocation;
    - in `AMB-ERC-TO-ERC` mode: transfer ERC20 tokens to the Foreign Mediator which will interact with Foreign AMB Bridge to mint ERC20 tokens on the Home Network, transfer ERC20 tokens to the Home Mediator which will interact with Home AMB Bridge to unlock ERC20 tokens on Foreign network.

## Usage

There are two ways to deploy contracts:
* install and use NodeJS
* use Docker to deploy

### Deployment with NodeJS

#### Install Dependencies
```bash
npm install
```
#### Deploy
Please read the [README.md](deploy/README.md) in the `deploy` folder for instructions and .env file configuration

#### Test
```bash
npm test
```

#### Run coverage tests
```bash
npm run coverage
```

The results can be found in the `coverage` directory.

#### Flatten
Fattened contracts can be used to verify the contract code in a block explorer like BlockScout or Etherscan.
The following command will prepare flattened version of the contracts:

```bash
npm run flatten
```
The flattened contracts can be found in the `flats` directory.

### Deployment in the Docker environment
[Docker](https://www.docker.com/community-edition) and [Docker Compose](https://docs.docker.com/compose/install/) can be used to deploy contracts without NodeJS installed on the system.
If you are on Linux, we recommend you [create a docker group and add your user to it](https://docs.docker.com/install/linux/linux-postinstall/), so that you can use the CLI without `sudo`.

#### Prepare the docker container
```bash
docker-compose up --build
```
_Note: The container must be rebuilt every time the code in a contract or deployment script is changed._

#### Deploy the contracts
1. Create the `.env` file in the `deploy` directory as described in the deployment [README.md](deploy/README.md).
2. Run deployment process:
   ```bash
   docker-compose run bridge-contracts deploy.sh
   ```
   or with Linux:
   ```bash
   ./deploy.sh
   ```

#### Copy flatten sources (if needed)
1. Discover the container name:
   ```bash
   docker-compose images bridge-contracts
   ```
2. In the following command, use the container name to copy the flattened contracts code to the current working directory. The contracts will be located in the `flats` directory.
   ```bash
   docker cp name-of-your-container:/contracts/flats ./
   ```

#### Test contract and run coverage (if needed)
```bash
$ docker-compose run bridge-contracts bash
$ npm test
$ npm run coverage
```

#### Shutdown the container
If the container is no longer needed, it can be shutdown:
```bash
docker-compose down
```

### Gas Consumption
The [GAS_CONSUMPTION](GAS_CONSUMPTION.md) file includes Min, Max, and Avg gas consumption figures for contracts associated with each bridge mode.

### Reward Management
The [REWARD_MANAGEMENT](REWARD_MANAGEMENT.md) file includes information on how rewards are distributed among the validators on each bridge mode.

### Testing environment
To test the bridge scripts in ERC20-to-ERC20 mode on a testnet like Sokol or Kovan, you must deploy an ERC20 token to the foreign network.
This can be done by running the following command:
```bash
cd deploy
node testenv-deploy.js token
```
or with Docker:
```bash
./deploy.sh token
```

## Contributing

See the [CONTRIBUTING](CONTRIBUTING.md) document for contribution, testing and pull request protocol.

## License

[![License: GPL v3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.



