// accounts.js
// ========
var Imap = require('imap'),
    connections = [],
    accountList = [ // Add new account objects to this array
{
    user: '',
    password: '',
    destination: ''
},
{
    user: '',
    password: '',
    destination: ''
}
    ];

accountList.forEach(function(item, index, arr){
//    console.log(`Item Number ${index}`);
//    console.log(item);
    var connection = new Imap({
      user: item.user,
      password: item.password,
      host: 'outlook.office365.com',
      port: 993,
      tls: true
     //,debug: function(msg){console.log('imap:', msg);}
    });
	connection.destination = item.destination;
    connections.push(connection);
})

module.exports = {
  connections
};