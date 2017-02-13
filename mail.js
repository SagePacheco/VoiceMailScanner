var inspect = require('util').inspect,
    fs      = require('fs'),
    base64  = require('base64-stream'),
    Imap = require('imap'),
    accounts = require('./accounts'),
    connections = accounts.connections,
    acceptedFormats = ['wav', 'mp3'];

function toUpper(thing) { return thing && thing.toUpperCase ? thing.toUpperCase() : thing;}

function findAttachmentParts(struct, attachments) {
      attachments = attachments ||  [];
      for (var i = 0, len = struct.length, r; i < len; ++i) {
        if (Array.isArray(struct[i])) {
          findAttachmentParts(struct[i], attachments);
        } else {
          if (struct[i].disposition && ['ATTACHMENT'].indexOf(toUpper(struct[i].disposition.type)) > -1) {
            attachments.push(struct[i]);
          }
        }
      }
      return attachments;
    }

 function buildAttMessageFunction(attachment, messageHeader, index, destination, fileType) {
      var fileName = '',
          encoding = attachment.encoding,
          messageDate = messageHeader.date[0],
          messageSubject = messageHeader.subject[0],

          // Cleans phone number
          // phonePattern = String.raw`\(\d{3}\) \d{3}[-]\d{4}`, // Old Phone Template
          phonePattern = String.raw`\+?(\d+) for`,
          phonePattern = new RegExp(phonePattern),
          phoneNumber = phonePattern.exec(messageSubject),

          // Cleans file name
          fileName = messageDate.replace(/ [^ ]+$/g, ""),
          fileName = fileName.replace(/,/g,""),
          fileName = fileName.replace(/:/g,"."),
          fileName = `${fileName} ${phoneNumber[1]}.${fileType}`;

          console.log(`Message Subject: ${messageSubject}`);

      return function (msg, seqno) {
        var prefix = '(#' + seqno + ') ';
        msg.on('body', function(stream, info) {
          // Create a write stream so that we can stream the attachment to file;
          console.log(prefix + 'Streaming this attachment to file', fileName, info);
          var writeStream = fs.createWriteStream(`${destination}${fileName}`);
          writeStream.on('finish', function() {
            console.log(prefix + 'Done writing to file %s', fileName);
          });

          // Write base64 data to the file. 
          if (toUpper(encoding) === 'BASE64') {
            stream.pipe(base64.decode()).pipe(writeStream);
          } else  {
            stream.pipe(writeStream);
          }
        });
        msg.once('end', function() {
          console.log(prefix + 'Finished attachment %s', fileName);
        });
      };
    }

connections.forEach(function(item, index, arr){

    function processEmails(){
      connections[index].seq.search(['UNSEEN'], function(err, results){
        if (results.length > 0){
          var f = connections[index].seq.fetch(results, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            markSeen: true,
            struct: true
          });
          f.on('message', function (msg, seqno) {
            var attachmentName = '';
            console.log('Message #%d', seqno);
            var prefix = '(#' + seqno + ') ';

            msg.on('body', function(stream, info) {
              var buffer = '';
              stream.on('data', function(chunk) {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', function() {
                var messageHeader = Imap.parseHeader(buffer);
                msg.once('attributes', function(attrs) {
                  var attachments = findAttachmentParts(attrs.struct);
                  console.log(prefix + 'Has attachments: %d', attachments.length);
                  for (var i = 0, len=attachments.length ; i < len; ++i) {
                    var attachment = attachments[i];
                    console.log(`Email from: ${messageHeader.from[0]}`);

                    // Cleans file type
                    var fileType = attachment.params.name,
                    fileTypePattern = String.raw`\.(\w+)`,
                    fileTypePattern = new RegExp(fileTypePattern),
                    fileType = fileTypePattern.exec(fileType);
                    console.log(`File Type: ${fileType[1]}`);

                    if (acceptedFormats.indexOf(fileType[1]) > -1){ // Check for accepted extensions
                      console.log(prefix + 'Fetching attachment %s', attachment.disposition.params.fileName);
                      var f = connections[index].fetch(attrs.uid , { //do not use connections[index].seq.fetch here
                        bodies: [attachment.partID],
                        struct: true
                      });
                      f.on('message', buildAttMessageFunction(attachment, messageHeader, i, connections[index].destination, fileType[1]));
                    } else {
                      console.log(`Attachment ${attachment.disposition.params.fileName} does not conform to expected file type`);
                    }
                  }
                });
              });
            });
            msg.once('end', function() {
              console.log(prefix + 'Finished email');
            });
          });

          f.once('error', function(err) {
            console.log('Fetch error: ' + err);
          });
          f.once('end', function() {
            console.log('Done fetching all messages!');
            connections[index].end();

            // connections[index].once('mail', function(newCount){
            //   console.log(`Your new count is ${newCount}... Processing...`);
            //   processEmails();
            // })
          });
        } else {
           console.log("No emails to process yet");
           connections[index].end();

           // console.log("Listening for new mail");
           // connections[index].once('mail', function(newCount){
           //    console.log(`Your new count is ${newCount}... Processing...`);
           //    processEmails();
           // })
        }
      });
    }

  connections[index].on('ready', function() {
  console.log(`Connection for account ${index} is ready.`);
    connections[index].openBox('INBOX', false, function(err, box) {
      if (err) throw err;
      processEmails();
    });
  });

  connections[index].on('error', function(err) {
	console.log("|||||||||||||||||||||||||||||||||||")
	console.log(err);
    console.log(`Connection Failed on account ${index} Moving on...`);
  });
	
	connections[index].on('close', function(err) {
      console.log(`Connection closed on account ${index}`);
	  setTimeout(function(){
        if(index < connections.length - 1){
          connections[index + 1].connect();  
        } else {
          connections[0].connect();
        }
      }, 10000);
    });

    connections[index].on('end', function() {
      console.log('Connection ended');
    });
})

connections[0].connect();

