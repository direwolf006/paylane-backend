const express = require('express');
const cors = require('cors');
const app = express();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')
const xss =require('xss-clean')
const helmet=require('helmet')
const rateLimit=require('express-rate-limit')
const mysql= require('mysql');
const jwt = require('jsonwebtoken');
const { uuid } = require('uuidv4');
const HDWalletProvider = require("@truffle/hdwallet-provider");
const mnemonicPhrase =process.env.MNEMONIC_PHRASE;

let provider = new HDWalletProvider({
  mnemonic: {
    phrase: mnemonicPhrase,
  },
  providerOrUrl: process.env.INFURA_URL,
});

let defaultData = {
  from: process.env.ACCOUT_ADDRESS,
  gas: 4000000,
  gasPrice: 2000000000,
};

var contract = require("@truffle/contract");

var DetailsContractJSON = require("./build/contracts/details.json");
var DetailsContract = contract(DetailsContractJSON);
DetailsContract.setProvider(provider);
DetailsContract.defaults(defaultData);

var TransactionContractJSON = require("./build/contracts/Transaction.json");
var TransactionContract = contract(TransactionContractJSON);
TransactionContract.setProvider(provider);
TransactionContract.defaults(defaultData);

const connection = mysql.createConnection({
    host     : 'localhost',
    user     : process.env.MYSQL_USERNAME,
    password : process.env.MYSQL_PASSWORD,
    database : 'paylane',
    multipleStatements: true,
});

connection.connect(function(err) {
    if (err) {
      res=err.stack;
      console.error('error connecting: ' + err.stack);
    }
  else{
    res=connection.threadId;
    console.log('connected as id ' + connection.threadId);
  } 
});

const limit = rateLimit({
    max: 500,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests',
    
    
});

app.use(xss());
app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '10kb' }));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

exports.verify = function(req, res, next){
    let accessToken = req.headers['x-access-token']

    if (!accessToken){
        return res.status(403).send()
    }

    let payload
    try{
        payload = jwt.verify(accessToken, process.env.JWT_SECRET_KEY)
        console.log('From verify')
        console.log(payload);
        next()
    }
    catch(e){
        return res.status(401).send()
    }
}

app.get('/test',(request,response)=>{
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash('testtest', salt, function(err, hash) {
            response.send(hash);

        });
    });
    console.log("hello world from server in function console")
});

app.post('/employee/register',async(request,response)=>{
    const {IFSCCode,accountNumber,allowance,bankName,base,branch,department,
    designation,email,name,password,specialAllowance}=request.body;

    let empID = uuid()
    let bankDetails = bankName+":"+branch+":"+accountNumber+":"+IFSCCode
    let logID = 'log_'+Math.floor(Math.random() * 10000000); 
    let statsData = [[logID,26,5,27,3],[logID,28,2,29,1],[logID,27,3,28,2],[logID,29,1,26,4],[logID,25,5,26,4]]
    let statsToInsrt = statsData[Math.floor(Math.random() * 4)]
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash) {
            connection.query("INSERT INTO employee VALUES (?,?,?,?,?,?)",
            [empID,name,designation,department,email,hash]
            ,function (error,result,fields){
                if(error){
                    return response.send({ auth: false, message: 'Error inserting employee in db.',error:error });
                }else{
                    connection.query("INSERT INTO statistics VALUES (?,?,?,?,?,?,?,?)",
                    [statsToInsrt[0],empID,4,2021,statsToInsrt[1],statsToInsrt[2],statsToInsrt[3],statsToInsrt[4]]
                    ,function (error,result,fields){
                        if(error){
                            console.log(error);
                            return response.send({ auth: false, message: 'Error inserting stats in db.',error:error });
                        }else{
                            DetailsContract.deployed().then(function (instance) {
                                return instance
                                .SetUserInfo(empID,name,bankDetails,base,allowance,specialAllowance)
                                .on("transactionHash", (hash) => {
                                    console.log("Transaction hash " + hash);
                                })
                                .on("receipt", (receipt) => {
                                    console.log("Transaction Receipt New User");
                                    console.log(receipt)
                                    response.status(200).send({code : 0,message:'User created and data also inserted in blockchain',data:receipt});
                                })
                                .on("error", (error) => {
                                    console.log("Error Happened ");
                                    console.log(error);
                                });
                            });
                        }
                    });
                }
            });
        });
    });
});

app.post('/login', limit,(request, response)=>{
    const {email,password,userType}=request.body; 
    
    connection.query(`SELECT * from ${userType} where email_id=?;`
    ,[email],async function(error, result, fields){
        if(error){      

            return response.send({ auth: false, message: `Error Fetching the ${userType} details` });
        }else{
            
            if(result.length!==0){
                const match = await bcrypt.compare(password, result[0].password_hash);
                if(match){
                    const token = jwt.sign({ id: result[0].user_id }, process.env.JWT_SECRET_KEY, {
                        expiresIn: 3600
                    });
                    let authData = {
                        token  : token,
                        expiresIn : 3600
                    }
                    authData=(userType==="Employer")?{...authData,employee_id:result[0].employer_id}:{...authData,employee_id:result[0].employee_id}                    
                    response.send(JSON.stringify({message:`${userType} found`,code:0,authData : authData}))                    
                }
                else{
                    response.send(JSON.stringify({message:`Password Incorrect`,code:1}))                
                }
            }else{                
                response.send(JSON.stringify({message:`${userType} doesn't exist`,code:2}))                
            }
        }
    });
});

app.get('/employee', this.verify,(request, response)=>{
    
    const {id}=request.query;
    connection.query(`SELECT * from employee where employee_id=?;`
    ,[id],async function(error, result, fields){
        if(error){      
            console.log(error);
            return response.send({ auth: false, message: 'Error Fetching the Employee About details' });
        }else{
            if(result.length===0){
                response.send(JSON.stringify({message:"Employee not found",code:1}))
            }else{
                let lastMonth = new Date().getMonth();
                lastMonth = lastMonth===0 ? 11 : lastMonth
                connection.query(`SELECT * from statistics where employee_id=? and month=?;`
                ,[id,lastMonth],async function(error, result2, fields){
                    if(error){      
                        console.log(error);
                        return response.send({ auth: false, message: 'Error Fetching the Employee Statistic details' });
                    }else{
                        DetailsContract.deployed().then(function (instance) {
                            return instance.GetUserInfo(id).then((data) => {
                                const bankDetails =data[2].split(":")
                                const employeeData = {
                                    about : {
                                        id:result[0].employee_id,
                                        name:result[0].name,
                                        department:result[0].department,
                                        designation:result[0].designation,
                                        email_id:result[0].email_id
                                    },
                                    salary : {
                                        base : data[3], 
                                        allowance : data[4],
                                        specialAllowance : data[5],
                                        gross : parseInt(data[3])+parseInt(data[4])+parseInt(data[5])
                                    },
                                    leaveStats : {
                                        present : result2[0].present_days ,
                                        leave : result2[0].absent_days
                                    },
                                    arrivalTimings : {
                                        onTime : result2[0].on_time ,
                                        late : result2[0].late
                                    },
                                    bankDetails : {
                                        bankName : bankDetails[0],
                                        branch : bankDetails[1],
                                        accountNumber : bankDetails[2],
                                        IFSCCode : bankDetails[3]
                                    }
                                }
                                response.send(JSON.stringify({message:"Employee found",code:0,employeeData : employeeData}))
                                provider.engine.stop();
                            });
                          });
                    }
                })
            }
            
        }
    })
    
});

app.get('/employee/salary', async(request, response)=>{
    
    const {id}=request.query;
    console.log("From Fetching Employee Salary"+ id);
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    await TransactionContract.deployed().then(async function (instance) {
        await instance.GetSpecEmpTransHistory(id).then((salaryData) => {
            console.log(salaryData);
            let salaryEmp = []
            salaryData.forEach((data)=>{
                if(data[1]!==''){
                    let salaryBreakdown = data[4].split(":")
                    let salary_formatedData = {
                        monthYear : monthNames[new Date(parseInt(data[2])).getMonth()]+", "+new Date(parseInt(data[2])).getFullYear(),
                        base : salaryBreakdown[0],
                        allowance : salaryBreakdown[1],
                        specialAllowance : salaryBreakdown[2],
                        gross : parseInt(salaryBreakdown[0])+parseInt(salaryBreakdown[1])+parseInt(salaryBreakdown[2])+parseInt(data[5]),
                        bonus : data[5]
                    }  
                    salaryEmp.push(salary_formatedData);
                }
            })
            salaryEmp.reverse();
            provider.engine.stop();
            console.log(salaryEmp);
            return response.send(JSON.stringify({message:"Data Available",code:0,salaryData: salaryEmp}))
        });
      });
});

app.get('/employee/transaction', async(request, response)=>{
    
    const {id}=request.query;
    console.log("From Fetching Employee Transaction"+ id);

    let monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    await TransactionContract.deployed().then(async function(instance) {
        await instance.GetSpecEmpTransHistory(id).then((transactions) => {
            let transactionEmp=[]
            transactions.forEach((data)=>{
                if(data[1]!==''){
                    let bankDetails = data[3].split(":")
                    let salaryBreakdown = data[4].split(":")
                    let transactioninfo_formatedData = {
                        time : new Date(parseInt(data[2])).toLocaleTimeString(),
                        date : new Date(parseInt(data[2])).toLocaleDateString(),
                        monthYear : monthNames[new Date(parseInt(data[2])).getMonth()]+", "+new Date(parseInt(data[2])).getFullYear(),
                        bankName : bankDetails[0],
                        transactionId : "TRID"+data[0]+bankDetails[0][0]+bankDetails[1][0],
                        branch : bankDetails[1],
                        accountNumber : bankDetails[2],
                        IFSCCode : bankDetails[3],
                        amount : parseInt(salaryBreakdown[0])+parseInt(salaryBreakdown[1])+parseInt(salaryBreakdown[2]),
                        bonus : data[5]
                    }  
                    transactionEmp.push(transactioninfo_formatedData);
                }
            })
            transactionEmp.reverse()
            response.send(JSON.stringify({message:"Data Available",code:0,transactionData : transactionEmp}))
            provider.engine.stop();
        });
    })

});

app.get('/employer/transactions', (request, response)=>{

    let monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    TransactionContract.deployed().then(async function(instance) {
        await instance.GetAllTransactions().then((transactions) => {
            let allTransactions=[]
            transactions.forEach((data)=>{
                let bankDetails = data[3].split(":")
                let salaryBreakdown = data[4].split(":")
                let transactioninfo_formatedData = {
                    time : new Date(parseInt(data[2])).toLocaleTimeString(),
                    date : new Date(parseInt(data[2])).toLocaleDateString(),
                    monthYear : monthNames[new Date(parseInt(data[2])).getMonth()]+", "+new Date(parseInt(data[2])).getFullYear(),
                    bankName : bankDetails[0],
                    transactionId : "TRID"+data[0]+bankDetails[0][0]+bankDetails[1][0],
                    employeeId  : data[1],
                    branch : bankDetails[1],
                    accountNumber : bankDetails[2],
                    IFSCCode : bankDetails[3],
                    amount : parseInt(salaryBreakdown[0])+parseInt(salaryBreakdown[1])+parseInt(salaryBreakdown[2]),
                    bonus : data[5]
                }  
                allTransactions.push(transactioninfo_formatedData);
            })
            allTransactions.reverse()
            response.send(JSON.stringify({message:"Data Available",code:0,transactionData : allTransactions}))
            provider.engine.stop();
        });
    })
})

app.get('/employees/payment',async (request, response)=>{

    let monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    connection.query(`SELECT * from employee`
    ,async function(error, result, fields){
        if(error){      
            console.log(error);
            return response.send({ auth: false, message: 'Error Fetching the Employee Statistic details' });
        }else{
            console.log(result);
            let empIDs =[]
            result.forEach((emp)=>{
                empIDs.push(emp.employee_id)
            })
            DetailsContract.deployed().then(async function (instance) {
                await instance.GetAllUsers(empIDs,empIDs.length).then(async(employees) => {
                    let employeesData =[]
                    employees.forEach((employee)=>{
                        let bankDetails = employee[2].split(":")
                        let userinfo_formatedData = {
                            employee_id : employee[0],
                            name : employee[1],
                            bankName : bankDetails[0],
                            branchName : bankDetails[1],
                            accountNumber : bankDetails[2],
                            IFSCCode : bankDetails[3],
                            base : employee[3], 
                            allowance : employee[4],
                            specialAllowance : employee[5],
                        }
                        employeesData.push(userinfo_formatedData)
                    })
                    TransactionContract.deployed().then(async function(instance) {
                        await instance.GetAllTransactions().then((transactions)=>{
                            
                            let filteredTransactions = transactions.filter((transaction)=>{
                                let transactionMonthYear = monthNames[new Date(parseInt(transaction[2])).getMonth()]+", "+new Date(parseInt(transaction[2])).getFullYear();
                                let currentMonthYear = monthNames[new Date().getMonth()]+", "+new Date().getFullYear();
                                if(transactionMonthYear ===currentMonthYear){
                                    return true;
                                }else{
                                    return false;
                                }
                            })
                            let empIDsNotToPay =[]
                            filteredTransactions.forEach((transaction)=>{
                                empIDsNotToPay.push(transaction[1])
                            })
                            let filteredEmployees = employeesData.filter((employee)=>{
                                if(empIDsNotToPay.indexOf(employee.employee_id)===-1){
                                    return true
                                }else{
                                    return false;
                                }
                            })
                            provider.engine.stop();
                            return response.send(JSON.stringify({message:"Fetched Successfully",code:0,employeesPaymentData : filteredEmployees}))
                        })
                    })
                });
            })
        }
    })
    
});

app.post('/employee/update/about', (request, response)=>{
    const {id, name , designation , department}=request.body;  
    
    connection.query(`UPDATE employee SET
    name = ?,
    designation = ?,
    department = ?
    WHERE employee_id = ?;`
    ,[name,designation,department,id],async function(error, result, fields){
        if(error){      
            console.log(error);
            
            return response.send(JSON.stringify({message:"Updation Failed",code:1}))
        }else{
            return response.send(JSON.stringify({message:"Updated Successfully",code:0}))
        }
    })
})

app.post('/employee/update/salary', (request, response)=>{
    const {employee_id,name,IFSCCode,accountNumber,allowance,bankName,base,branch,specialAllowance}=request.body;  
    let bankDetails = bankName+":"+branch+":"+accountNumber+":"+IFSCCode
    
    DetailsContract.deployed().then(function (instance) {
        return instance
          .SetUserInfo(employee_id,name,bankDetails,base,allowance,specialAllowance)
          .on("transactionHash", (hash) => {
            console.log("Transaction hash " + hash);
          })
          .on("receipt", (receipt) => {
            console.log("Transaction Receipt New User");
            console.log(receipt)
            response.status(200).send({code : 0,message:'User created and data also inserted in blockchain',data:receipt});
          })
          .on("error", (error) => {
            console.log("Error Happened ");
            console.log(error);
            return response.send(JSON.stringify({message:"Updation Failed",code:1}))
          });
      });
})

app.post('/employee/transaction/add', async(request, response)=>{
    const {datetime,employee_id,bankName,branchName,accountNumber,IFSCCode,base,
        allowance,specialAllowance,bonus}=request.body;  

    let bankDetails = bankName+":"+branchName+":"+accountNumber+":"+IFSCCode
    let split = base+":"+allowance+":"+specialAllowance;

    await TransactionContract.deployed().then(function (instance) {
        return instance
            .SetTransactionInfo(datetime, employee_id, bankDetails, split, bonus)

            .on("transactionHash", (hash) => {
            console.log("Transaction hash " + hash);
            })
            .on("receipt", (receipt) => {
            console.log("Transaction Receipt New transaction");
            console.log(receipt);
            return response.send(JSON.stringify({message:"Paid Employee Successfully",code:0}))
            })
            .on("error", (error) => {
            console.log("Error Happened ");
            console.log(error);
            return response.send(JSON.stringify({message:"Paid Employee Failed",code:1}))
            });
    });

})

app.get('/employees', this.verify,(request, response)=>{
    connection.query(`SELECT * from employee;`
    ,async function(error, result, fields){
        if(error){      
            console.log(error);            
            return response.send(JSON.stringify({message:"Fetching Employees Failed",code:1}))
        }else{
            const employeesData = [...result]
            return response.send(JSON.stringify({message:"Fetched Employees Successfully",code:0,employeesData:employeesData}))
        }
    })
})


app.get('/user/test', (request, response)=>{
    var token = request.headers['x-access-token'];
    if (!token){
        return response.send({ auth: false, message: 'No token provided.' });
    }else{
        jwt.verify(token, process.env.JWT_SECRET_KEY, function(err, decoded) {
            if (err) return response.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
            
            response.status(200).send(decoded);
          });
    }
});


app.listen(3005,()=>{
    console.log("Connected to port 3005");
});
