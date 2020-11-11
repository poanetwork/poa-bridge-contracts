pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "./BasicMultiAMBErc20ToErc677.sol";
import "./modules/factory/TokenFactoryConnector.sol";
import "./modules/forwarding_rules/MultiTokenForwardingRulesConnector.sol";
import "./modules/fee_manager/MultiTokenFeeManagerConnector.sol";

/**
* @title HomeMultiAMBErc20ToErc677
* @dev Home side implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract HomeMultiAMBErc20ToErc677 is
    BasicMultiAMBErc20ToErc677,
    MultiTokenFeeManagerConnector,
    TokenFactoryConnector,
    MultiTokenForwardingRulesConnector
{
    event NewTokenRegistered(address indexed foreignToken, address indexed homeToken);

    /**
    * @dev Stores the initial parameters of the mediator.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _requestGasLimit the gas limit for the message execution.
    * @param _owner address of the owner of the mediator contract.
    * @param _limitsManager of the contract responsible for limits management.
    * @param _tokenFactory address of the TokenFactory contract that will be used for the deployment of new tokens.
    */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256 _requestGasLimit,
        address _owner,
        address _limitsManager,
        address _tokenFactory
    ) external onlyRelevantSender returns (bool) {
        _setTokenFactory(_tokenFactory);

        return _initialize(_bridgeContract, _mediatorContract, _requestGasLimit, _owner, _limitsManager);
    }

    /**
    * @dev Handles the bridged tokens for the first time, includes deployment of new TokenProxy contract.
    * Checks that the value is inside the execution limits and invokes the method
    * to execute the Mint or Unlock accordingly.
    * @param _token address of the bridged ERC20/ERC677 token on the foreign side.
    * @param _name name of the bridged token, " on xDai" will be appended, if empty, symbol will be used instead.
    * @param _symbol symbol of the bridged token, if empty, name will be used instead.
    * @param _decimals decimals of the bridge foreign token.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function deployAndHandleBridgedTokens(
        address _token,
        string _name,
        string _symbol,
        uint8 _decimals,
        address _recipient,
        uint256 _value
    ) external onlyMediator {
        string memory name = _name;
        string memory symbol = _symbol;
        if (bytes(name).length == 0) {
            require(bytes(symbol).length > 0);
            name = symbol;
        } else if (bytes(symbol).length == 0) {
            symbol = name;
        }
        name = string(abi.encodePacked(name, " on xDai"));
        address homeToken = tokenFactory().deploy(name, symbol, _decimals, bridgeContract().sourceChainId());
        _setTokenAddressPair(_token, homeToken);
        _handleBridgedTokens(ERC677(homeToken), _recipient, _value);

        emit NewTokenRegistered(_token, homeToken);
    }

    /**
    * @dev Handles the bridged tokens. Checks that the value is inside the execution limits and invokes the method
    * to execute the Mint or Unlock accordingly.
    * @param _token bridged ERC20 token.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function handleBridgedTokens(ERC677 _token, address _recipient, uint256 _value) external onlyMediator {
        ERC677 homeToken = ERC677(homeTokenAddress(_token));
        require(isTokenRegistered(homeToken));
        _handleBridgedTokens(homeToken, _recipient, _value);
    }

    /**
    * @dev ERC677 transfer callback function.
    * @param _from address of tokens sender.
    * @param _value amount of transferred tokens.
    * @param _data additional transfer data, can be used for passing alternative receiver address.
    */
    function onTokenTransfer(address _from, uint256 _value, bytes _data) public returns (bool) {
        // if onTokenTransfer is called as a part of call to _relayTokens, this callback does nothing
        if (!lock()) {
            ERC677 token = ERC677(msg.sender);
            require(isTokenRegistered(token));
            bridgeLimitsManager().recordDeposit(token, _value);
            bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        }
        return true;
    }

    /**
    * @dev Validates that the token amount is inside the limits, calls transferFrom to transfer the tokens to the contract
    * and invokes the method to burn/lock the tokens and unlock/mint the tokens on the other network.
    * The user should first call Approve method of the ERC677 token.
    * @param token bridge token contract address.
    * @param _receiver address that will receive the native tokens on the other network.
    * @param _value amount of tokens to be transferred to the other network.
    */
    function _relayTokens(ERC677 token, address _receiver, uint256 _value) internal {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        address to = address(this);
        require(isTokenRegistered(token));
        bridgeLimitsManager().recordDeposit(token, _value);

        setLock(true);
        token.transferFrom(msg.sender, to, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, msg.sender, _value, abi.encodePacked(_receiver));
    }

    /**
     * @dev Executes action on the request to deposit tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _token, address _recipient, uint256 _value) internal {
        bytes32 _messageId = messageId();
        uint256 valueToMint = _value;
        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, address(0), _token, _value);
        if (fee > 0) {
            valueToMint = valueToMint.sub(fee);
            emit FeeDistributed(fee, _token, _messageId);
        }
        IBurnableMintableERC677Token(_token).mint(_recipient, valueToMint);
        emit TokensBridged(_token, _recipient, valueToMint, _messageId);
    }

    /**
    * @dev Mints back the amount of tokens that were bridged to the other network but failed.
    * @param _token address that bridged token contract.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function executeActionOnFixedTokens(address _token, address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(_token).mint(_recipient, _value);
    }

    /**
    * @dev Checks if specified token was already bridged at least once.
    * @param _token address of the token contract.
    * @return true, if token was already bridged.
    */
    function isTokenRegistered(address _token) public view returns (bool) {
        return foreignTokenAddress(_token) != address(0);
    }

    /**
    * @dev Retrieves address of the home bridged token contract associated with a specific foreign token contract.
    * @param _foreignToken address of the created home token contract.
    * @return address of the home token contract.
    */
    function homeTokenAddress(address _foreignToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _foreignToken))];
    }

    /**
    * @dev Retrieves address of the foreign bridged token contract associated with a specific home token contract.
    * @param _homeToken address of the created home token contract.
    * @return address of the foreign token contract.
    */
    function foreignTokenAddress(address _homeToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _homeToken))];
    }

    /**
    * @dev Internal function for updating a pair of addresses for the bridged token.
    * @param _foreignToken address of bridged foreign token contract.
    * @param _homeToken address of created home token contract.
    */
    function _setTokenAddressPair(address _foreignToken, address _homeToken) internal {
        addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _foreignToken))] = _homeToken;
        addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _homeToken))] = _foreignToken;
    }

    /**
     * @dev Executes action on withdrawal of bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requested amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        uint256 fee = _distributeFee(HOME_TO_FOREIGN_FEE, _from, _token, _value);
        uint256 valueToBridge = _value.sub(fee);
        IBurnableMintableERC677Token(_token).burn(valueToBridge);
        bytes32 _messageId = passMessage(_token, _from, chooseReceiver(_from, _data), valueToBridge);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
        }
    }

    /**
    * @dev Call AMB bridge to require the invocation of handleBridgedTokens method of the mediator on the other network.
    * Store information related to the bridged tokens in case the message execution fails on the other network
    * and the action needs to be fixed/rolled back.
    * @param _token bridged ERC20 token
    * @param _from address of sender, if bridge operation fails, tokens will be returned to this address
    * @param _receiver address of receiver on the other side, will eventually receive bridged tokens
    * @param _value bridged amount of tokens
    * @return id of the created and passed message
    */
    function passMessage(ERC677 _token, address _from, address _receiver, uint256 _value) internal returns (bytes32) {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        address foreignToken = foreignTokenAddress(_token);
        bytes memory data = abi.encodeWithSelector(methodSelector, foreignToken, _receiver, _value);

        address executor = mediatorContractOnOtherSide();
        uint256 gasLimit = requestGasLimit();
        IAMB bridge = bridgeContract();

        // Address of the foreign token is used here for determining lane permissions.
        // Such decision makes it possible to set rules for tokens that are not bridged yet.
        bytes32 _messageId = _isOracleDrivenLaneAllowed(foreignToken, _from, _receiver)
            ? bridge.requireToPassMessage(executor, data, gasLimit)
            : bridge.requireToConfirmMessage(executor, data, gasLimit);

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, _value);
        setMessageRecipient(_messageId, _from);

        return _messageId;
    }
}
