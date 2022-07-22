// SPDX-License-Identifier: Proprietary

import './Extras.sol';


pragma solidity ^0.8.7;

contract ReferralData is Ownable {

    uint public referralFee = 10; // one-tenth of a percent; so 10 = 1%; 15 = 1.5%
    uint constant public maxReferralFee = 25; // 2.5%

    mapping (address => bool) internal _whitelistedContracts; // only these are allowed to add new referrals

    mapping (address => address[]) public referralMasterToSlaves; // one referrer per all of their referred wallets; shows who is referred to them
    mapping (address => address) public referralSlaveToMaster; // one referred wallet per their referrer; shows who referred them


    constructor(address[] memory predictionsContracts) {
        for (uint i; i < predictionsContracts.length; i++)
            _whitelistedContracts[predictionsContracts[i]] = true;
    }


    modifier onlyContract() {
        require(_isContract(msg.sender), 'only contracts can call this');
        _;
    }

    function _isContract(address addr) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }


    function SetReferralFee(uint newFeeInTenthOfPercent) external onlyOwner {
        require(newFeeInTenthOfPercent != 0, 'fee can not be 0; use DisableReferralFee() for this instead');
        require(0 < newFeeInTenthOfPercent && newFeeInTenthOfPercent <= maxReferralFee, 'fee can not exceed maxReferralFee');
        referralFee = newFeeInTenthOfPercent;
    }

    function DisableReferralFee() external onlyOwner {
        referralFee = 0;
    }

    function WhitelistContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), 'can not whitelist zero address');
        require(_whitelistedContracts[contractAddress] == false, 'address already whitelisted');
        _whitelistedContracts[contractAddress] = true;
    }

    function IsWhitelisted(address contractAddress) external view returns (bool) {
        return _whitelistedContracts[contractAddress];
    }


    function AreAlreadyConnected(address user1, address user2) public view returns (bool) {
        // makes it impossible to form this kinda referral relationship: wallet1 -> wallet2 -> wallet1
        // preventing wallet2 to refer those who already referred them
        return (referralSlaveToMaster[user1] == user2 || referralSlaveToMaster[user2] == user1);
    }

    function IsAlreadyReferred(address user) public view returns (bool) {
        return (referralSlaveToMaster[user] != address(0));
    }

    function GetReferrer(address referredUser) external view returns (address) {
        return referralSlaveToMaster[referredUser];
    }

    function CalculateReferralReward(uint betSize) external view returns (uint) {
        return betSize * referralFee / 1000;
    }

    function ReferTo(address referrer) public onlyContract {
        require(_whitelistedContracts[msg.sender] == true, 'not authorized');
        require(!IsAlreadyReferred(tx.origin), 'address is already associated with another referrer');
        require(tx.origin != referrer, 'can not refer self');

        referralMasterToSlaves[referrer].push(tx.origin);
        referralSlaveToMaster[tx.origin] = referrer;
    }

    function GetReferrals(address user) external view returns(address[] memory) {
        return referralMasterToSlaves[user];
    }

    // Designed for migration to a different referrals contract, in case such a need should arise
    function SetReferrals(address user, address[] calldata walletsReferredByUser) external onlyOwner {
        referralMasterToSlaves[user] = walletsReferredByUser;
        for (uint i = 0; i < walletsReferredByUser.length; i++) {
            referralSlaveToMaster[walletsReferredByUser[i]] = user;
        }
    }

}