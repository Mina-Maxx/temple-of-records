'use strict';
const fs=require('fs'),path=require('path');
if(!process.argv.includes('--confirm-local-reset')){console.error('Stop the server, keep a private backup, then rerun with --confirm-local-reset. Removes only admin credential and sessions.');process.exit(1)}
for(const name of ['admin.json','sessions.json']){const f=path.join(__dirname,'data',name);if(fs.existsSync(f))fs.unlinkSync(f)}
console.log('Local admin credential and sessions removed. Content unchanged. Start the server and open /admin/ to create a new local admin.');
