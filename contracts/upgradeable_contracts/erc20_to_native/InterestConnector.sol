pragma solidity 0.4.24;

import "../Ownable.sol";
import "../ERC20Bridge.sol";
import "../TokenSwapper.sol";
import "../../interfaces/IInterestReceiver.sol";

/**
 * @title InterestConnector
 * @dev This contract gives an abstract way of receiving interest on locked tokens.
 */
contract InterestConnector is Ownable, ERC20Bridge, TokenSwapper {
    event PaidInterest(address indexed token, address to, uint256 value);

    /**
     * @dev Throws if interest is bearing not enabled.
     * @param token address, for which interest should be enabled.
     */
    modifier interestEnabled(address token) {
        require(isInterestEnabled(token));
        /* solcov ignore next */
        _;
    }

    /**
     * @dev Tells if interest earning was enabled for particular token.
     * @return true, if interest bearing  is enabled.
     */
    function isInterestEnabled(address _token) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("interestEnabled", _token))];
    }

    /**
     * @dev Initializes interest receiving functionality.
     * Only owner can call this method.
     * @param _token address of the token for interest earning.
     * @param _minCashThreshold minimum amount of underlying tokens that are not invested.
     * @param _minInterestPaid minimum amount of interest that can be paid in a single call.
     * @param _maxInterestPaid maximum amount of interest that can be paid in a single call.
     */
    function initializeInterest(
        address _token,
        uint256 _minCashThreshold,
        uint256 _minInterestPaid,
        uint256 _maxInterestPaid,
        address _interestReceiver
    ) external onlyOwner {
        require(_isInterestSupported(_token));
        require(!isInterestEnabled(_token));

        boolStorage[keccak256(abi.encodePacked("interestEnabled", _token))] = true;

        _setMinCashThreshold(_token, _minCashThreshold);
        _setPaidInterestLimits(_token, _minInterestPaid, _maxInterestPaid);
        _setInterestReceiver(_token, _interestReceiver);
    }

    /**
     * @dev Sets minimum amount of tokens that cannot be invested.
     * Only owner can call this method.
     * @param _token address of the token contract.
     * @param _minCashThreshold minimum amount of underlying tokens that are not invested.
     */
    function setMinCashThreshold(address _token, uint256 _minCashThreshold) external onlyOwner {
        _setMinCashThreshold(_token, _minCashThreshold);
    }

    /**
     * @dev Tells minimum amount of tokens that are not being invested.
     * @param _token address of the invested token contract.
     * @return amount of tokens.
     */
    function minCashThreshold(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("minCashThreshold", _token))];
    }

    /**
     * @dev Sets limits for paid interest amount in a single call.
     * Only owner can call this method.
     * @param _token address of the token contract.
     * @param _minInterestPaid minimum amount of interest paid in a single call.
     * @param _maxInterestPaid maximum amount of interest paid in a single call.
     */
    function setPaidInterestLimits(address _token, uint256 _minInterestPaid, uint256 _maxInterestPaid)
        external
        onlyOwner
    {
        _setPaidInterestLimits(_token, _minInterestPaid, _maxInterestPaid);
    }

    /**
     * @dev Tells minimum amount of paid interest in a single call.
     * @param _token address of the invested token contract.
     * @return paid interest minimum limit.
     */
    function minInterestPaid(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("minInterestPaid", _token))];
    }

    /**
     * @dev Tells maximum amount of paid interest in a single call.
     * @param _token address of the invested token contract.
     * @return paid interest maximum limit.
     */
    function maxInterestPaid(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("maxInterestPaid", _token))];
    }

    /**
     * @dev Internal function that disables interest for locked funds.
     * Only owner can call this method.
     * @param _token of token to disable interest for.
     */
    function disableInterest(address _token) external onlyOwner {
        _withdraw(_token, uint256(-1));
        delete boolStorage[keccak256(abi.encodePacked("interestEnabled", _token))];
    }

    /**
     * @dev Tells configured address of the interest receiver.
     * @param _token address of the invested token contract.
     * @return address of the interest receiver.
     */
    function interestReceiver(address _token) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("interestReceiver", _token))];
    }

    /**
     * Updates the interest receiver address.
     * Only owner can call this method.
     * @param _token address of the invested token contract.
     * @param _receiver new receiver address.
     */
    function setInterestReceiver(address _token, address _receiver) external onlyOwner {
        _setInterestReceiver(_token, _receiver);
    }

    /**
     * @dev Pays collected interest for the specific underlying token.
     * Requires interest for the given token to be enabled.
     * @param _token address of the token contract.
     */
    function payInterest(address _token) external interestEnabled(_token) {
        uint256 interest = _clampInterest(_token, interestAmount(_token));

        _withdrawTokens(_token, interest);
        _transferInterest(_token, interest);
    }

    /**
     * @dev Tells the amount of underlying tokens that are currently invested.
     * @param _token address of the token contract.
     * @return amount of underlying tokens.
     */
    function investedAmount(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("investedAmount", _token))];
    }

    /**
     * @dev Internal function for transferring interest.
     * Calls a callback on the receiver, if it is a contract.
     * @param _token address of the underlying token contract.
     * @param _amount amount of collected tokens that should be sent.
     */
    function _transferInterest(address _token, uint256 _amount) internal {
        address receiver = interestReceiver(_token);
        require(receiver != address(0));

        ERC20(_token).transfer(receiver, _amount);

        if (AddressUtils.isContract(receiver)) {
            IInterestReceiver(receiver).onInterestReceived(_token);
        }

        emit PaidInterest(_token, receiver, _amount);
    }

    /**
     * @dev Internal function for setting the amount of underlying tokens that are currently invested.
     * @param _token address of the token contract.
     * @param _amount new amount of invested tokens.
     */
    function _setInvestedAmount(address _token, uint256 _amount) internal {
        uintStorage[keccak256(abi.encodePacked("investedAmount", _token))] = _amount;
    }

    /**
     * @dev Invests all excess tokens.
     * Requires interest for the given token to be enabled.
     * @param _token address of the token contract considered.
     */
    function invest(address _token) public interestEnabled(_token) {
        uint256 balance = _selfBalance(_token);
        uint256 minCash = minCashThreshold(_token);

        require(balance > minCash);
        uint256 amount = balance - minCash;

        _setInvestedAmount(_token, investedAmount(_token).add(amount));

        _invest(_token, amount);
    }

    /**
     * @dev Internal function for withdrawing some amount of the invested tokens.
     * Reverts if given amount cannot be withdrawn.
     * @param _token address of the token contract withdrawn.
     * @param _amount amount of requested tokens to be withdrawn.
     */
    function _withdraw(address _token, uint256 _amount) internal {
        if (_amount == 0) return;

        uint256 invested = investedAmount(_token);
        uint256 balance = _selfBalance(_token);
        uint256 withdrawal = _amount > invested ? invested : _amount;

        _withdrawTokens(_token, withdrawal);

        uint256 redeemed = _selfBalance(_token) - balance;

        // Make sure that at least withdrawal amount was indeed withdrawn
        require(redeemed >= withdrawal);

        _setInvestedAmount(_token, invested > redeemed ? invested - redeemed : 0);
    }

    /**
     * @dev Internal function for setting minimum amount of tokens that cannot be invested.
     * @param _token address of the token contract.
     * @param _minCashThreshold minimum amount of underlying tokens that are not invested.
     */
    function _setMinCashThreshold(address _token, uint256 _minCashThreshold) internal {
        uintStorage[keccak256(abi.encodePacked("minCashThreshold", _token))] = _minCashThreshold;
    }

    /**
     * @dev Internal function for setting limits for paid interest amount in a single call.
     * @param _token address of the token contract.
     * @param _minInterestPaid minimum amount of interest paid in a single call.
     * @param _maxInterestPaid maximum amount of interest paid in a single call.
     */
    function _setPaidInterestLimits(address _token, uint256 _minInterestPaid, uint256 _maxInterestPaid) internal {
        require(_minInterestPaid < _maxInterestPaid);
        uintStorage[keccak256(abi.encodePacked("minInterestPaid", _token))] = _minInterestPaid;
        uintStorage[keccak256(abi.encodePacked("maxInterestPaid", _token))] = _maxInterestPaid;
    }

    /**
     * @dev Internal function for setting interest receiver address.
     * @param _token address of the invested token contract.
     * @param _receiver address of the interest receiver.
     */
    function _setInterestReceiver(address _token, address _receiver) internal {
        require(_receiver != address(this));
        addressStorage[keccak256(abi.encodePacked("interestReceiver", _token))] = _receiver;
    }

    /**
     * @dev Internal function for clamping the available interest amount.
     * @param _token address of the invested token contract.
     * @param _amount amount of underlying tokens available to withdrawal.
     * @return amount in minInterestPaid...maxInterestPaid range.
     */
    function _clampInterest(address _token, uint256 _amount) internal view returns (uint256) {
        require(_amount >= minInterestPaid(_token));
        uint256 maxInterest = maxInterestPaid(_token);
        return _amount > maxInterest ? maxInterest : _amount;
    }

    /**
     * @dev Tells this contract balance of some specific token contract
     * @param _token address of the token contract.
     * @return contract balance.
     */
    function _selfBalance(address _token) internal view returns (uint256) {
        return ERC20(_token).balanceOf(address(this));
    }

    function _isInterestSupported(address _token) internal pure returns (bool);

    function _invest(address _token, uint256 _amount) internal;

    function _withdrawTokens(address _token, uint256 _amount) internal;

    function interestAmount(address _token) public view returns (uint256);
}