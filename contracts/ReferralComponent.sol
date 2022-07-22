// SPDX-License-Identifier: MIT

import './Extras.sol';

pragma solidity ^0.8.7;


//REFERRALS
abstract contract ReferralComponent is Ownable, ReentrancyGuard, ExtraModifiers, EtherTransfer {

    address public referralsContract;

    mapping(address => uint) internal _referralFunds; // per wallet
    uint internal _totalReferralProgramFunds; // total amount for all wallets, in BNB

    event ReferralClaim(address indexed sender, uint256 amount);
    event NewReferralsContract(address newContract);


    function SetReferralsContract(address newContractAddress) external onlyOwner {
        require(newContractAddress != address(0), 'can not be zero address');
        require(newContractAddress != referralsContract, 'this address is already set as the current referrals contract');
        
        referralsContract = newContractAddress;
        emit NewReferralsContract(newContractAddress);
    }

    function ReferralRewardsAvailable(address user) external view returns (uint) {
        return _referralFunds[user];
    }


    function user_ReferralFundsClaim() external nonReentrant notContract {
        uint reward;

        reward = _referralFunds[msg.sender];
        _referralFunds[msg.sender] = 0;

        emit ReferralClaim(msg.sender, reward);

        if (reward > 0) 
        {
            _totalReferralProgramFunds -= reward;
            _safeTransferBNB(address(msg.sender), reward);
        }
    }

    function GetTotalReservedReferralFunds() external view returns (uint) {
        return _totalReferralProgramFunds;
}
}