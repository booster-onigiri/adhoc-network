var fs = require('fs');
module.exports = write;

function write(path, buf){
	fs.appendFileSync(path, buf, function (err) {
		console.log(err);
	 });
}