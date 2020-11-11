pragma solidity 0.4.24;

import "../upgradeable_contracts/multi_amb_erc20_to_erc677/modules/fee_manager/MultiTokenFeeManagerConnector.sol";
import "../upgradeable_contracts/multi_amb_erc20_to_erc677/modules/factory/TokenFactoryConnector.sol";
import "../upgradeable_contracts/multi_amb_erc20_to_erc677/modules/limits/MultiTokenBridgeLimitsConnector.sol";
import "../upgradeable_contracts/multi_amb_erc20_to_erc677/modules/forwarding_rules/MultiTokenForwardingRulesConnector.sol";

contract MultiTokenMediatorMock is
    MultiTokenFeeManagerConnector,
    TokenFactoryConnector,
    MultiTokenBridgeLimitsConnector,
    MultiTokenForwardingRulesConnector
{
    constructor() public {
        _setOwner(msg.sender);
    }

    function recordDeposit(address _token, uint256 _value) external {
        bridgeLimitsManager().recordDeposit(_token, _value);
    }

    function recordWithdraw(address _token, uint256 _value) external {
        bridgeLimitsManager().recordWithdraw(_token, _value);
    }
}
