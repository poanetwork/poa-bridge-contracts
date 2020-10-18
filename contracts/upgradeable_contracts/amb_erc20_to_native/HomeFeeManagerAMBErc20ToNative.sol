pragma solidity 0.4.24;

import "../BaseRewardAddressList.sol";

/**
* @title HomeFeeManagerAMBErc20ToNative
* @dev Implements the logic to distribute fees from the erc20 to native mediator contract operations.
* The fees are distributed in the form of native tokens to the list of reward accounts.
*/
contract HomeFeeManagerAMBErc20ToNative is BaseRewardAddressList {
    using SafeMath for uint256;

    event FeeUpdated(bytes32 feeType, uint256 fee);
    event FeeDistributed(uint256 fee, bytes32 indexed messageId);

    // This is not a real fee value but a relative value used to calculate the fee percentage
    uint256 internal constant MAX_FEE = 1 ether;
    bytes32 public constant HOME_TO_FOREIGN_FEE = 0x741ede137d0537e88e0ea0ff25b1f22d837903dbbee8980b4a06e8523247ee26; // keccak256(abi.encodePacked("homeToForeignFee"))
    bytes32 public constant FOREIGN_TO_HOME_FEE = 0x03be2b2875cb41e0e77355e802a16769bb8dfcf825061cde185c73bf94f12625; // keccak256(abi.encodePacked("foreignToHomeFee"))

    /**
    * @dev Throws if given fee percentage is >= 100%.
    */
    modifier validFee(uint256 _fee) {
        require(_fee < MAX_FEE);
        /* solcov ignore next */
        _;
    }

    /**
    * @dev Throws if given fee type is unknown.
    */
    modifier validFeeType(bytes32 _feeType) {
        require(_feeType == HOME_TO_FOREIGN_FEE || _feeType == FOREIGN_TO_HOME_FEE);
        /* solcov ignore next */
        _;
    }

    /**
    * @dev Updates the value for the particular fee type.
    * Only the owner can call this method.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _fee new fee value, in percentage (1 ether == 10**18 == 100%).
    */
    function setFee(bytes32 _feeType, uint256 _fee) external onlyOwner {
        _setFee(_feeType, _fee);
    }

    /**
    * @dev Retrieves the value for the particular fee type.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @return fee value associated with the requested fee type.
    */
    function getFee(bytes32 _feeType) public view validFeeType(_feeType) returns (uint256) {
        return uintStorage[_feeType];
    }

    /**
    * @dev Calculates the amount of fee to pay for the value of the particular fee type.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _value bridged value, for which fee should be evaluated.
    * @return amount of fee to be subtracted from the transferred value.
    */
    function calculateFee(bytes32 _feeType, uint256 _value) public view returns (uint256) {
        uint256 _fee = getFee(_feeType);
        return _value.mul(_fee).div(MAX_FEE);
    }

    /**
    * @dev Internal function for updating the fee value for the given fee type.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _fee new fee value, in percentage (1 ether == 10**18 == 100%).
    */
    function _setFee(bytes32 _feeType, uint256 _fee) internal validFeeType(_feeType) validFee(_fee) {
        uintStorage[_feeType] = _fee;
        emit FeeUpdated(_feeType, _fee);
    }

    /**
    * @dev Calculates a random number based on the block number.
    * @param _count the max value for the random number.
    * @return a number between 0 and _count.
    */
    function random(uint256 _count) internal view returns (uint256) {
        return uint256(blockhash(block.number.sub(1))) % _count;
    }

    /**
    * @dev Calculates and distributes the amount of fee proportionally between registered reward addresses.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _value bridged value, for which fee should be evaluated.
    * @return total amount of fee subtracted from the transferred value and distributed between the reward accounts.
    */
    function _distributeFee(bytes32 _feeType, uint256 _value) internal returns (uint256) {
        uint256 numOfAccounts = _addressCount();
        uint256 _fee = calculateFee(_feeType, _value);
        if (numOfAccounts == 0 || _fee == 0) {
            return 0;
        }
        uint256 feePerAccount = _fee.div(numOfAccounts);
        uint256 randomAccountIndex;
        uint256 diff = _fee.sub(feePerAccount.mul(numOfAccounts));
        if (diff > 0) {
            randomAccountIndex = random(numOfAccounts);
        }

        for (uint256 i = 0; i < numOfAccounts; i++) {
            uint256 feeToDistribute = feePerAccount;
            if (diff > 0 && randomAccountIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }

            onFeeDistribution(_feeType, _addressByIndex(i), feeToDistribute);
        }
        return _fee;
    }

    /* solcov ignore next */
    function onFeeDistribution(bytes32 _feeType, address _receiver, uint256 _value) internal;
}
