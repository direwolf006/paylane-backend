// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
pragma experimental ABIEncoderV2;

contract Transaction {
    
    uint count=0;
    struct transaction {
        uint transactionID;
        string empID;
        string datetimes;
        string bank;
        string split;
        uint bonus;
    }
    mapping (uint => transaction) AllTransactions;

    function SetTransactionInfo(string memory _datetimes, string memory _empID, string memory _bank,
     string memory _split, uint _bonus) public {
        AllTransactions[count].datetimes = _datetimes;
        AllTransactions[count].transactionID = count;
        AllTransactions[count].empID = _empID;
        AllTransactions[count].bank = _bank;
        AllTransactions[count].split = _split;
        AllTransactions[count].bonus = _bonus;
        count=count+1;
        
}

    function GetSpecEmpTransHistory(string memory _empID) public view returns (transaction[] memory)
    {
        uint trasnsIndex=0;
        transaction[] memory transactions = new transaction[](count);
        for (uint i = 0; i <count; i++) {
            if(keccak256(bytes(_empID)) == keccak256(bytes(AllTransactions[i].empID))){
                transactions[trasnsIndex] = AllTransactions[i];
                trasnsIndex++;
            }
        }
        return transactions;
    }

    function GetAllTransactions() public view returns (transaction[] memory){
        transaction[] memory transactions = new transaction[](count);
        for (uint i = 0; i <count; i++) {

            transactions[i] = AllTransactions[i];
        }
        return transactions;
    }
}