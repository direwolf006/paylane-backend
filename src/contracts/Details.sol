// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
pragma experimental ABIEncoderV2;

contract details {

   struct empDetails {
        string employeeID;
        string name;
        string bank;
        uint BPay;
        uint allw;
        uint spallw;
    }
    mapping (string => empDetails) AllDetails;


    function SetUserInfo(string memory _empID, string memory _name, string memory _bank,
    uint _BPay, uint _allw, uint _spallw) public {
        AllDetails[_empID].bank = _bank;
        AllDetails[_empID].employeeID = _empID;
        AllDetails[_empID].name = _name;
        AllDetails[_empID].BPay = _BPay;
        AllDetails[_empID].allw = _allw;
        AllDetails[_empID].spallw = _spallw;
}


    function GetUserInfo(string memory _empID) public view returns (empDetails memory)
    {
        return AllDetails[_empID];
    }

    function GetAllUsers(string[] memory _empID,uint noOfEmps) public view returns (empDetails[] memory){

        empDetails[] memory employees = new empDetails[](noOfEmps);
        for (uint i = 0; i <noOfEmps; i++) {
            employees[i] = AllDetails[_empID[i]];
        }
        return employees;
    }

}
