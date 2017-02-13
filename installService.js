var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'VoiceMail Scanner',
  description: 'Monitors office 365 for voicemails to download to a shared drive.',
  script: 'C:\\Users\\sapacheco\\Dropbox\\Apps\\Active Development\\attachment-scanner\\mail.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();