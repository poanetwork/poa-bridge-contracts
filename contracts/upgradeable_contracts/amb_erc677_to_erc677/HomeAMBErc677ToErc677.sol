pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

/**
* @title HomeAMBErc677ToErc677
* @dev Home side implementation for erc677-to-erc677 mediator intended to work on top of AMB bridge.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract HomeAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    /**
     * @dev Executes action on the request to deposit tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _shiftValue(_value);
        bytes32 _messageId = messageId();
        //MOD: mint and then transferAndCall
        IBurnableMintableERC677Token(erc677token()).mint(address(this), value);
        require(erc677token().transferAndCall(_recipient, value, new bytes(0)), "transfer_failed");
        emit TokensBridged(_recipient, value, _messageId);
    }

    //MOD: allow token ownership to be transferred to facilitate upgrade
    function transferTokenOwnership(address newOwner) onlyOwner {
        Ownable(erc677token()).transferOwnership(newOwner);
    }

    /**
     * @dev Executes action on withdrawal of bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            IBurnableMintableERC677Token(_token).burn(_value);
            passMessage(_from, chooseReceiver(_from, _data), _value);
        }
    }

    /**
     * @dev Withdraws the erc20 tokens or native coins from this contract.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // For home side of the bridge, tokens are not locked at the contract, they are minted and burned instead.
        // So, its is safe to allow claiming of any tokens. Native coins are allowed as well.
        claimValues(_token, _to);
    }

    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, _value);
    }
}
